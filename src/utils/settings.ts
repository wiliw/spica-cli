// Settings 系统 - 统一管理所有配置
// 全局 settings.json 包含 providers, mcp, skills, hooks
// 项目 .spica/ 只放 session.json 和可选的 skills.json/hooks.json

import fs from 'fs-extra';
import { homedir } from 'os';
import { join } from 'path';

// 全局配置目录
export const GLOBAL_DIR = join(homedir(), '.spica');
export const GLOBAL_SETTINGS_FILE = join(GLOBAL_DIR, 'settings.json');

// Provider 配置
export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  description?: string;
}

// MCP 配置
export interface MCPServerConfig {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  disabled?: boolean;
}

// Skills 配置
export interface SkillDefinition {
  name?: string;
  description: string;
  promptTemplate: string;
  allowedTools?: string[];
  timeout?: number;
  autoInvoke?: boolean;      // 是否允许AI自动调用
  paths?: string[];          // 路径匹配
  argumentHint?: string;     // 参数提示，如 "[name]"
}

// Hooks 配置
export interface HookMatcher {
  tool?: string;
  args?: Record<string, string>;
}

export interface HookDefinition {
  matcher: HookMatcher;
  action: 'block' | 'confirm' | 'log' | 'warn';
  message: string;
}

export interface HookResult {
  matched: boolean;
  action: 'block' | 'confirm' | 'log' | 'warn' | 'none';
  message: string;
}

// 统一 Settings 结构
export interface Settings {
  defaultProvider?: string;
  providers?: Record<string, ProviderConfig>;
  mcp?: {
    servers: MCPServerConfig[];
  };
  skills?: Record<string, SkillDefinition>;
  hooks?: {
    PreToolUse?: HookDefinition[];
    PostToolUse?: HookDefinition[];
  };
}

// 内置 Provider 模板
export const BUILTIN_PROVIDERS: Record<string, Partial<ProviderConfig>> = {
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

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4',
  anthropic: 'claude-3-opus',
  together: 'meta-llama/Llama-3-70b-chat-hf',
  groq: 'llama-3-70b',
  local: 'llama-3',
  custom: 'gpt-4',
};

// 默认 hooks
const DEFAULT_HOOKS: Settings['hooks'] = {
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

let settingsCache: Settings | null = null;

// 加载全局 settings
export async function loadGlobalSettings(): Promise<Settings> {
  if (settingsCache) {
    return settingsCache;
  }

  await fs.ensureDir(GLOBAL_DIR);

  // 如果 settings.json 不存在，创建默认配置
  if (!await fs.pathExists(GLOBAL_SETTINGS_FILE)) {
    const defaultSettings: Settings = {
      defaultProvider: 'openai',
      hooks: DEFAULT_HOOKS,
    };
    await fs.writeJson(GLOBAL_SETTINGS_FILE, defaultSettings, { spaces: 2 });
    settingsCache = defaultSettings;
    return settingsCache;
  }

  settingsCache = await fs.readJson(GLOBAL_SETTINGS_FILE) as Settings;
  return settingsCache;
}

// 保存全局 settings
export async function saveGlobalSettings(settings: Settings): Promise<void> {
  await fs.ensureDir(GLOBAL_DIR);
  await fs.writeJson(GLOBAL_SETTINGS_FILE, settings, { spaces: 2 });
  await fs.chmod(GLOBAL_SETTINGS_FILE, 0o600);
  await fs.chmod(GLOBAL_DIR, 0o700);
  settingsCache = settings;
}

// 加载项目 skills (覆盖全局)
export function loadProjectSkills(workspacePath: string): Record<string, SkillDefinition> | null {
  const projectSkillsPath = join(workspacePath, '.spica', 'skills.json');

  if (fs.existsSync(projectSkillsPath)) {
    try {
      const projectSkills = fs.readJsonSync(projectSkillsPath);
      return projectSkills.skills || projectSkills;
    } catch {
      return null;
    }
  }
  return null;
}

// 加载项目 hooks (追加全局)
export function loadProjectHooks(workspacePath: string): Settings['hooks'] | null {
  const projectHooksPath = join(workspacePath, '.spica', 'hooks.json');

  if (fs.existsSync(projectHooksPath)) {
    try {
      const projectHooks = fs.readJsonSync(projectHooksPath);
      return projectHooks.hooks || projectHooks;
    } catch {
      return null;
    }
  }
  return null;
}

// 合并全局 + 项目配置
export async function loadEffectiveSettings(workspacePath: string): Promise<Settings> {
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
        ...(effectiveHooks.PreToolUse || []),
        ...(projectHooks.PreToolUse || []),
      ],
      PostToolUse: [
        ...(effectiveHooks.PostToolUse || []),
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
export async function getProviderConfig(providerName?: string): Promise<ProviderConfig> {
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

export async function setProviderConfig(
  name: string,
  apiKey: string,
  baseUrl?: string,
  model?: string
): Promise<void> {
  const settings = await loadGlobalSettings();

  if (!settings.providers) settings.providers = {};

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

export async function listProviders(): Promise<string[]> {
  const settings = await loadGlobalSettings();
  return Object.keys(settings.providers || {});
}

export async function setDefaultProvider(name: string): Promise<void> {
  const settings = await loadGlobalSettings();

  if (!settings.providers?.[name]) {
    throw new Error(`Provider '${name}' not configured`);
  }

  settings.defaultProvider = name;
  await saveGlobalSettings(settings);
}