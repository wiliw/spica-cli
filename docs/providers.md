# spica-cli 提供商配置

## 支持的 Provider

spica-cli 使用 **OpenAI API 兼容格式**，支持所有第三方模型。

### 内置 Providers

| Provider | Base URL | 描述 |
|----------|----------|------|
| **openai** | `https://api.openai.com/v1` | OpenAI GPT models (GPT-4, GPT-3.5) |
| **anthropic** | `https://api.anthropic.com/v1` | Claude models (via OpenAI-compatible) |
| **together** | `https://api.together.xyz/v1` | 开源模型 |
| **groq** | `https://api.groq.com/openai/v1` | 快速推理 |
| **local** | `http://localhost:8000/v1` | 本地模型 |
| **custom** | (自定义) | 任何 OpenAI-compatible endpoint |

---

## 配置方式

### 1. 配置 Provider

```bash
# OpenAI
spica providers set openai sk-xxx...

# Anthropic (via OpenAI-compatible)
spica providers set anthropic sk-ant-xxx...

# Together AI
spica providers set together xxx... -m llama-3-70b

# Groq
spica providers set groq gsk_xxx... -m llama-3-70b

# 本地模型
spica providers set local dummy-key -b http://localhost:8000/v1 -m llama-3

# 自定义服务
spica providers set custom your-key -b https://your-api.com/v1 -m your-model
```

### 2. 设置默认 Provider

```bash
# 设置默认
spica providers default openai

# 或
spica providers default together
```

### 3. 查看 Provider

```bash
# 列出所有配置的 provider
spica providers

# 显示详细信息
spica providers show openai
```

---

## 使用方式

### 默认 Provider

```bash
# 使用默认 provider
spica run "build file classifier"
```

### 指定 Provider

```bash
# 使用特定 provider
spica run "build file classifier" -p together

# 使用本地模型
spica run "add feature" -p local

# 使用 Groq（快速）
spica run "quick fix" -p groq
```

---

## 配置示例

**~/.spica/settings.json:**

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "name": "OpenAI",
      "apiKey": "sk-xxx...",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4",
      "description": "OpenAI GPT models"
    },
    "together": {
      "name": "Together AI",
      "apiKey": "xxx...",
      "baseUrl": "https://api.together.xyz/v1",
      "model": "meta-llama/Llama-3-70b-chat-hf",
      "description": "Open-source models"
    },
    "local": {
      "name": "Local Model",
      "apiKey": "dummy-key",
      "baseUrl": "http://localhost:8000/v1",
      "model": "llama-3-8b",
      "description": "Local models"
    }
  }
}
```

---

## 本地模型设置

### llama.cpp

```bash
# 启动 llama.cpp server
llama-server -m llama-3-8b.Q4_K_M.gguf --port 8000

# 配置 spica
spica providers set local dummy-key \
  -b http://localhost:8000/v1 \
  -m llama-3-8b

# 使用
spica run "build app" -p local
```

### vLLM

```bash
# 启动 vLLM server
python -m vllm.entrypoints.openai.api_server --model llama-3-8b

# 配置 spica
spica providers set local dummy-key \
  -b http://localhost:8000/v1 \
  -m llama-3-8b
```

### Ollama

```bash
# Ollama 自动提供 OpenAI-compatible API
ollama serve

# 配置 spica
spica providers set local dummy-key \
  -b http://localhost:11434/v1 \
  -m llama3
```

---

## 切换 Provider 的场景

| 场景 | 推荐 Provider |
|------|---------------|
| **生产环境** | OpenAI GPT-4, Anthropic Claude |
| **快速开发** | Groq (Llama-3, Mixtral) |
| **开源模型** | Together AI |
| **隐私优先** | Local (llama.cpp, vLLM) |
| **成本优化** | Together AI, Local |
| **速度优先** | Groq |

---

## Function Calling 支持

所有 OpenAI-compatible provider 都支持 function calling：

```typescript
// spica 自动使用 OpenAI function calling format
tools: [
  {
    type: 'function',
    function: {
      name: 'file_write',
      description: 'Write file',
      parameters: { ... }
    }
  }
]
```

**兼容性：**
- ✅ OpenAI: 完全支持
- ✅ Together AI: 支持 (Llama-3, Mistral)
- ✅ Groq: 支持
- ✅ Local: 支持 (如果模型支持)
- ⚠️ Anthropic: 部分 (需 OpenAI-compatible endpoint)

---

## 快速配置

```bash
# 一键配置多个 provider
spica providers set openai sk-xxx...
spica providers set together xxx... -m llama-3-70b
spica providers set local dummy-key -b http://localhost:8000/v1 -m llama-3

# 设置默认
spica providers default openai

# 查看配置
spica providers
```

---

## 核心优势

✅ **统一 API**: OpenAI API format，无需学习不同 API
✅ **多 Provider**: 支持 6 个 builtin + 自定义
✅ **灵活切换**: 命令行指定或配置默认
✅ **Function Calling**: 所有 provider 支持
✅ **本地模型**: 完整支持 llama.cpp/vLLM/Ollama
✅ **隐私控制**: 本地模型完全隐私
