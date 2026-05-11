import fs from 'fs-extra';
import { homedir } from 'os';
import { join } from 'path';
const CONFIG_DIR = join(homedir(), '.spica');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
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
    replicate: {
        name: 'Replicate',
        baseUrl: 'https://api.replicate.com/v1',
        description: 'Various models via Replicate',
    },
    azure: {
        name: 'Azure OpenAI',
        baseUrl: '',
        description: 'Azure OpenAI Service',
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
    replicate: 'llama-3-70b',
    azure: 'gpt-4',
    local: 'llama-3',
    custom: 'gpt-4',
};
export async function loadConfig() {
    await fs.ensureDir(CONFIG_DIR);
    if (!await fs.pathExists(CONFIG_FILE)) {
        await fs.writeJson(CONFIG_FILE, { defaultProvider: 'openai' });
        return { defaultProvider: 'openai' };
    }
    return await fs.readJson(CONFIG_FILE);
}
export async function saveConfig(config) {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
    await fs.chmod(CONFIG_FILE, 0o600);
    await fs.chmod(CONFIG_DIR, 0o700);
}
export async function getProviderConfig(providerName) {
    const config = await loadConfig();
    const name = providerName || config.defaultProvider || 'openai';
    // 优先级 1: 配置文件
    if (config.providers?.[name]) {
        return config.providers[name];
    }
    // 优先级 2: 环境变量（完整支持）
    const envKey = process.env[`SPICA_${name.toUpperCase()}_API_KEY`] ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.TOGETHER_API_KEY ||
        process.env.GROQ_API_KEY;
    if (envKey) {
        const builtin = BUILTIN_PROVIDERS[name];
        const envModel = process.env[`SPICA_${name.toUpperCase()}_MODEL`] ||
            process.env.OPENAI_MODEL ||
            process.env.MODEL ||
            DEFAULT_MODELS[name] ||
            'gpt-4';
        const envBaseUrl = process.env[`SPICA_${name.toUpperCase()}_BASE_URL`] ||
            process.env.OPENAI_BASE_URL ||
            builtin?.baseUrl ||
            'https://api.openai.com/v1';
        return {
            name: builtin?.name || name,
            apiKey: envKey,
            baseUrl: envBaseUrl,
            model: envModel,
            description: builtin?.description,
        };
    }
    throw new Error(`Provider '${name}' not configured. Run: spica providers set ${name} YOUR_API_KEY`);
}
export async function setProviderConfig(name, apiKey, baseUrl, model) {
    const config = await loadConfig();
    if (!config.providers)
        config.providers = {};
    const builtin = BUILTIN_PROVIDERS[name];
    config.providers[name] = {
        name: builtin?.name || name,
        apiKey,
        baseUrl: baseUrl || builtin?.baseUrl || '',
        model: model || DEFAULT_MODELS[name] || 'gpt-4',
        description: builtin?.description,
    };
    if (!config.defaultProvider) {
        config.defaultProvider = name;
    }
    await saveConfig(config);
}
export async function listProviders() {
    const config = await loadConfig();
    return Object.keys(config.providers || {});
}
export async function setDefaultProvider(name) {
    const config = await loadConfig();
    if (!config.providers?.[name]) {
        throw new Error(`Provider '${name}' not configured`);
    }
    config.defaultProvider = name;
    await saveConfig(config);
}
export async function setConfigValue(key, value) {
    const config = await loadConfig();
    const parts = key.split('.');
    if (parts.length === 2) {
        const [provider, field] = parts;
        if (!config.providers)
            config.providers = {};
        if (!config.providers[provider]) {
            const builtin = BUILTIN_PROVIDERS[provider];
            config.providers[provider] = {
                name: builtin?.name || provider,
                apiKey: '',
                baseUrl: builtin?.baseUrl || '',
                model: DEFAULT_MODELS[provider] || 'gpt-4',
            };
        }
        if (field === 'apiKey') {
            config.providers[provider].apiKey = value;
        }
        else if (field === 'model') {
            config.providers[provider].model = value;
        }
        else if (field === 'baseUrl') {
            config.providers[provider].baseUrl = value;
        }
        await saveConfig(config);
    }
}
export async function getConfigValue(key) {
    const config = await loadConfig();
    const parts = key.split('.');
    if (parts.length === 2) {
        const [provider, field] = parts;
        if (config.providers?.[provider]) {
            if (field === 'apiKey') {
                return config.providers[provider].apiKey;
            }
            else if (field === 'model') {
                return config.providers[provider].model;
            }
            else if (field === 'baseUrl') {
                return config.providers[provider].baseUrl;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=config.js.map