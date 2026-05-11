# spica-cli 简化使用（OpenAI-compatible）

## 只需要三个配置

调用任何 OpenAI-compatible API：

```bash
# API Key
export OPENAI_API_KEY=your-key

# Base URL（第三方服务地址）
export OPENAI_BASE_URL=https://api.together.xyz/v1

# Model Name（第三方模型名）
export OPENAI_MODEL=meta-llama/Llama-3-70b-chat-hf

# 运行
./bin/spica mvp "build hello world"
```

---

## 支持的服务

所有 OpenAI-compatible API：

| 服务 | Base URL | 模型名示例 |
|------|----------|-----------|
| **Together AI** | https://api.together.xyz/v1 | llama-3-70b, mixtral-8x7b |
| **Groq** | https://api.groq.com/openai/v1 | llama-3-70b, mixtral-8x7b |
| **本地模型** | http://localhost:8000/v1 | llama-3, mistral |
| **Azure OpenAI** | https://YOUR_RESOURCE.openai.azure.com | gpt-4 |
| **OpenAI** | https://api.openai.com/v1 | gpt-4, gpt-3.5-turbo |
| **任何兼容服务** | https://your-api.com/v1 | your-model |

---

## 快速配置

### Together AI

```bash
export OPENAI_API_KEY=your-together-key
export OPENAI_BASE_URL=https://api.together.xyz/v1
export OPENAI_MODEL=meta-llama/Llama-3-70b-chat-hf

./bin/spica mvp "build CLI tool"
```

### Groq

```bash
export OPENAI_API_KEY=gsk-your-groq-key
export OPENAI_BASE_URL=https://api.groq.com/openai/v1
export OPENAI_MODEL=llama-3-70b

./bin/spica cycle "fix bug"
```

### 本地模型（llama.cpp）

```bash
# 启动 llama.cpp
llama-server -m llama-3-8b.Q4_K_M.gguf --port 8000

# 配置
export OPENAI_API_KEY=dummy
export OPENAI_BASE_URL=http://localhost:8000/v1
export OPENAI_MODEL=llama-3-8b

./bin/spica mvp "build app"
```

### OpenAI（默认）

```bash
export OPENAI_API_KEY=sk-proj-xxx...
# Base URL 和 Model 会自动使用默认值

./bin/spica mvp "build app"
```

---

## 配置文件（可选）

如果不想每次设置环境变量：

```bash
./bin/spica providers set custom YOUR_KEY \
  -b https://api.together.xyz/v1 \
  -m llama-3-70b

# 使用
./bin/spica mvp "build app"
```

---

## 为什么这样设计？

**OpenAI-compatible API 标准格式：**

```typescript
// 所有第三方服务使用相同格式
{
  baseURL: "https://api.together.xyz/v1",  // 只需改这里
  model: "llama-3-70b",                    // 只需改这里
  apiKey: "your-key"
}

// 调用方式完全相同
POST /chat/completions
{
  model: "llama-3-70b",
  messages: [...],
  tools: [...]
}
```

**好处：**
- ✅ 一个配置方式调用所有服务
- ✅ 不需要学习不同 API
- ✅ 切换服务只需改 Base URL + Model

---

## 实际使用

**场景 1：Together AI 开源模型**

```bash
export OPENAI_API_KEY=xxx...
export OPENAI_BASE_URL=https://api.together.xyz/v1
export OPENAI_MODEL=meta-llama/Llama-3-70b-chat-hf

cd ~/development/spica/spica-cli
./bin/spica mvp "build hello world CLI"
```

**场景 2：本地模型完全隐私**

```bash
# 启动本地模型
ollama serve

export OPENAI_API_KEY=dummy
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3

./bin/spica mvp "build private app"
```

**场景 3：快速推理（Groq）**

```bash
export OPENAI_API_KEY=gsk_xxx...
export OPENAI_BASE_URL=https://api.groq.com/openai/v1
export OPENAI_MODEL=llama-3-70b

./bin/spica cycle "quick fix"  # Groq 超快
```

---

## 总结

**你只需要：**

1. **API Key** - 第三方服务的 key
2. **Base URL** - 第三方服务地址
3. **Model Name** - 第三方模型名

**设置环境变量或配置文件，然后直接运行。**

不需要 provider 选择，不需要复杂配置。

---

## 现在测试

```bash
# 设置你的真实配置
export OPENAI_API_KEY=YOUR_KEY
export OPENAI_BASE_URL=YOUR_SERVICE_URL
export OPENAI_MODEL=YOUR_MODEL_NAME

cd ~/development/spica/spica-cli
./bin/spica mvp "build hello world CLI"
```