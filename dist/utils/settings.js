// Settings 系统 - 统一管理所有配置
// 全局 settings.json 包含 providers, mcp, skills, hooks
// 项目 .spica/ 只放 session.json 和可选的 skills.json/hooks.json
import fs from 'fs-extra';
import { homedir } from 'os';
import { join } from 'path';
// 全局配置目录
export const GLOBAL_DIR = join(homedir(), '.spica');
export const GLOBAL_SETTINGS_FILE = join(GLOBAL_DIR, 'settings.json');
// 内置 Provider 模板
export const BUILTIN_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        description: 'OpenAI GPT models',
    },
    anthropic: {
        name: 'Anthropic (OpenAI-compatible)',
        baseUrl: 'https://api.anthropic.com/v1',
        description: 'Claude models via OpenAI-compatible endpoint',
    },
    together: {
        name: 'Together AI',
        baseUrl: 'https://api.together.xyz/v1',
        description: 'Open-source models (Llama, Mistral, etc)',
    },
    groq: {
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        description: 'Fast inference (Llama, Mixtral)',
    },
    local: {
        name: 'Local Model',
        baseUrl: 'http://localhost:8000/v1',
        description: 'Local models (llama.cpp, vLLM, etc)',
    },
    custom: {
        name: 'Custom',
        baseUrl: '',
        description: 'Any OpenAI-compatible endpoint',
    },
};
const DEFAULT_MODELS = {
    openai: 'gpt-4',
    anthropic: 'claude-3-opus',
    together: 'meta-llama/Llama-3-70b-chat-hf',
    groq: 'llama-3-70b',
    local: 'llama-3',
    custom: 'gpt-4',
};
// 默认 hooks
const DEFAULT_HOOKS = {
    PreToolUse: [
        {
            matcher: { tool: 'bash', args: { command: '*--force*' } },
            action: 'block',
            message: '禁止使用 --force 参数',
        },
        {
            matcher: { tool: 'bash', args: { command: '*rm -rf /*' } },
            action: 'block',
            message: '禁止删除根目录',
        },
    ],
};
let settingsCache = null;
// 加载全局 settings
export async function loadGlobalSettings() {
    if (settingsCache) {
        return settingsCache;
    }
    await fs.ensureDir(GLOBAL_DIR);
    // 如果 settings.json 不存在，创建默认配置
    if (!await fs.pathExists(GLOBAL_SETTINGS_FILE)) {
        const defaultSettings = {
            defaultProvider: 'openai',
            hooks: DEFAULT_HOOKS,
        };
        await fs.writeJson(GLOBAL_SETTINGS_FILE, defaultSettings, { spaces: 2 });
        settingsCache = defaultSettings;
        return settingsCache;
    }
    settingsCache = await fs.readJson(GLOBAL_SETTINGS_FILE);
    return settingsCache;
}
// 保存全局 settings
export async function saveGlobalSettings(settings) {
    await fs.ensureDir(GLOBAL_DIR);
    await fs.writeJson(GLOBAL_SETTINGS_FILE, settings, { spaces: 2 });
    await fs.chmod(GLOBAL_SETTINGS_FILE, 0o600);
    await fs.chmod(GLOBAL_DIR, 0o700);
    settingsCache = settings;
}
// 加载项目 skills (覆盖全局)
export function loadProjectSkills(workspacePath) {
    const skillsDir = join(workspacePath, '.spica', 'skills');
    const projectSkillsPath = join(workspacePath, '.spica', 'skills.json');
    const skills = {};
    // 方式1: 从 skills.json 文件加载
    if (fs.existsSync(projectSkillsPath)) {
        try {
            const projectSkills = fs.readJsonSync(projectSkillsPath);
            Object.assign(skills, projectSkills.skills || projectSkills);
        }
        catch { }
    }
    // 方式2: 从 skills/ 目录扫描（支持 superpowers 安装方式）
    if (fs.existsSync(skillsDir)) {
        try {
            const dirs = fs.readdirSync(skillsDir).filter(d => {
                const fullPath = join(skillsDir, d);
                return fs.statSync(fullPath).isDirectory() && !d.startsWith('_') && !d.startsWith('.');
            });
            for (const dir of dirs) {
                const skillFile = join(skillsDir, dir, 'SKILL.md');
                if (fs.existsSync(skillFile)) {
                    try {
                        const content = fs.readFileSync(skillFile, 'utf-8');
                        // 从 SKILL.md 解析 skill 定义
                        const skillDef = parseSkillMarkdown(dir, content);
                        if (skillDef) {
                            skills[dir] = skillDef;
                        }
                    }
                    catch { }
                }
            }
        }
        catch { }
    }
    return Object.keys(skills).length > 0 ? skills : null;
}
// 解析 SKILL.md 文件提取 skill 定义
function parseSkillMarkdown(name, content) {
    // 提取 description（第一个段落）
    const lines = content.split('\n');
    let description = '';
    let promptTemplate = '';
    // 找到标题后的第一个非空段落作为 description
    let foundTitle = false;
    for (const line of lines) {
        if (line.startsWith('#')) {
            foundTitle = true;
            continue;
        }
        if (foundTitle && line.trim()) {
            description = line.trim();
            break;
        }
    }
    // 整个内容作为 promptTemplate（LLM 会处理）
    promptTemplate = content;
    return {
        name,
        description: description || `Skill: ${name}`,
        promptTemplate,
    };
}
// 加载项目 hooks (追加全局)
export function loadProjectHooks(workspacePath) {
    const projectHooksPath = join(workspacePath, '.spica', 'hooks.json');
    if (fs.existsSync(projectHooksPath)) {
        try {
            const projectHooks = fs.readJsonSync(projectHooksPath);
            return projectHooks.hooks || projectHooks;
        }
        catch {
            return null;
        }
    }
    return null;
}
// 合并全局 + 项目配置
export async function loadEffectiveSettings(workspacePath) {
    const global = await loadGlobalSettings();
    // 项目 skills 覆盖全局
    const projectSkills = loadProjectSkills(workspacePath);
    const effectiveSkills = projectSkills || global.skills;
    // 项目 hooks 追加全局
    const projectHooks = loadProjectHooks(workspacePath);
    let effectiveHooks = global.hooks || DEFAULT_HOOKS;
    if (projectHooks) {
        effectiveHooks = {
            PreToolUse: [
                ...(effectiveHooks?.PreToolUse || []),
                ...(projectHooks.PreToolUse || []),
            ],
            PostToolUse: [
                ...(effectiveHooks?.PostToolUse || []),
                ...(projectHooks.PostToolUse || []),
            ],
        };
    }
    return {
        ...global,
        skills: effectiveSkills,
        hooks: effectiveHooks,
    };
}
// Provider 相关函数
export async function getProviderConfig(providerName) {
    const settings = await loadGlobalSettings();
    const name = providerName || settings.defaultProvider || 'openai';
    const builtin = BUILTIN_PROVIDERS[name];
    const fileConfig = settings.providers?.[name];
    // 环境变量优先
    const envApiKey = process.env[`SPICA_${name.toUpperCase()}_API_KEY`] ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.TOGETHER_API_KEY ||
        process.env.GROQ_API_KEY;
    const envModel = process.env[`SPICA_${name.toUpperCase()}_MODEL`] ||
        process.env.OPENAI_MODEL ||
        process.env.MODEL;
    const envBaseUrl = process.env[`SPICA_${name.toUpperCase()}_BASE_URL`] ||
        process.env.OPENAI_BASE_URL;
    const apiKey = envApiKey || fileConfig?.apiKey;
    const model = envModel || fileConfig?.model || DEFAULT_MODELS[name] || 'gpt-4';
    const baseUrl = envBaseUrl || fileConfig?.baseUrl || builtin?.baseUrl || 'https://api.openai.com/v1';
    if (!apiKey) {
        throw new Error(`Provider '${name}' not configured. Run: spica providers set ${name} YOUR_API_KEY`);
    }
    return {
        name: builtin?.name || fileConfig?.name || name,
        apiKey,
        baseUrl,
        model,
        description: builtin?.description || fileConfig?.description,
    };
}
export async function setProviderConfig(name, apiKey, baseUrl, model) {
    const settings = await loadGlobalSettings();
    if (!settings.providers)
        settings.providers = {};
    const builtin = BUILTIN_PROVIDERS[name];
    settings.providers[name] = {
        name: builtin?.name || name,
        apiKey,
        baseUrl: baseUrl || builtin?.baseUrl || '',
        model: model || DEFAULT_MODELS[name] || 'gpt-4',
        description: builtin?.description,
    };
    if (!settings.defaultProvider) {
        settings.defaultProvider = name;
    }
    await saveGlobalSettings(settings);
}
export async function listProviders() {
    const settings = await loadGlobalSettings();
    return Object.keys(settings.providers || {});
}
export async function setDefaultProvider(name) {
    const settings = await loadGlobalSettings();
    if (!settings.providers?.[name]) {
        throw new Error(`Provider '${name}' not configured`);
    }
    settings.defaultProvider = name;
    await saveGlobalSettings(settings);
}
//# sourceMappingURL=settings.js.map