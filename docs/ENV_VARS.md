# 环境变量配置

## 完整支持环境变量（已修复）

---

## 环境变量列表

### API Keys

```bash
# OpenAI
export OPENAI_API_KEY=sk-proj-xxx...

# Anthropic (via OpenAI-compatible)
export ANTHROPIC_API_KEY=sk-ant-xxx...

# Together AI
export TOGETHER_API_KEY=xxx...

# Groq
export GROQ_API_KEY=gsk_xxx...

# 通用（spica-cli 也会读取）
export SPICA_OPENAI_API_KEY=sk-xxx...
export SPICA_TOGETHER_API_KEY=xxx...
export SPICA_GROQ_API_KEY=xxx...
```

### 模型名（关键！）

```bash
# OpenAI 模型
export OPENAI_MODEL=gpt-4-turbo

# Together AI 模型（必须指定）
export TOGETHER_MODEL=meta-llama/Llama-3-70b-chat-hf

# Groq 模型（必须指定）
export GROQ_MODEL=llama-3-70b

# Anthropic 模型
export ANTHROPIC_MODEL=claude-3-opus

# 本地模型
export LOCAL_MODEL=llama-3-8b

# 通用
export SPICA_TOGETHER_MODEL=llama-3-70b
export SPICA_GROQ_MODEL=mixtral-8x7b
export MODEL=gpt-4  # fallback
```

### Base URLs

```bash
# 自定义 base URL
export OPENAI_BASE_URL=https://custom-endpoint.com/v1

export TOGETHER_BASE_URL=https://api.together.xyz/v1

export LOCAL_BASE_URL=http://localhost:8000/v1

export SPICA_CUSTOM_BASE_URL=https://your-api.com/v1
```

---

## 使用示例

### Together AI（开源模型）

```bash
export TOGETHER_API_KEY=xxx...
export TOGETHER_MODEL=meta-llama/Llama-3-70b-chat-hf

cd ~/development/spica/spica-cli
./bin/spica mvp "build hello world CLI"
```

**关键：必须指定模型名！**
- Together AI 支持多种开源模型
- 不指定会调用错误模型
- 模型列表：https://api.together.xyz/models

---

### Groq（快速推理）

```bash
export GROQ_API_KEY=gsk_xxx...
export GROQ_MODEL=llama-3-70b

./bin/spica cycle "fix bug" --provider groq
```

**模型选项：**
- `llama-3-70b` - Llama 3 70B
- `llama-3-8b` - Llama 3 8B  
- `mixtral-8x7b` - Mixtral 8x7B

---

### 本地模型

```bash
export SPICA_LOCAL_API_KEY=dummy
export LOCAL_BASE_URL=http://localhost:8000/v1
export LOCAL_MODEL=llama-3-8b

./bin/spica mvp "build app" --provider local
```

---

### 自定义 endpoint

```bash
export OPENAI_API_KEY=your-key
export OPENAI_BASE_URL=https://your-api.com/v1
export OPENAI_MODEL=your-model-name

./bin/spica mvp "build app"
```

---

## 配置优先级

spica-cli 读取顺序：

1. **配置文件** `~/.spica/config.json`（最高优先级）
2. **Provider 特定环境变量** `SPICA_{PROVIDER}_{VAR}`
3. **通用环境变量** `OPENAI_{VAR}`, `TOGETHER_{VAR}`
4. **Fallback 环境变量** `MODEL`
5. **默认值**（built-in）

---

## 示例：完整 Together AI 配置

**方式 1：环境变量（推荐）**

```bash
# .bashrc 或 .zshrc
export TOGETHER_API_KEY="your-key-here"
export TOGETHER_MODEL="meta-llama/Llama-3-70b-chat-hf"

# 使用
cd ~/development/spica/spica-cli
./bin/spica mvp "build file classifier"
```

**方式 2：配置文件**

```bash
./bin/spica providers set together YOUR_KEY \
  -m meta-llama/Llama-3-70b-chat-hf

# 使用
./bin/spica mvp "build app" --provider together
```

---

## 关键点

**为什么必须指定模型名？**

OpenAI-compatible API 调用第三方模型时：
- Base URL 指向第三方服务（Together/Groq）
- 模型名必须匹配该服务的模型列表
- 错误模型名 → API 错误或调用错误模型

**示例错误：**
```bash
# 错误：不指定模型名
export TOGETHER_API_KEY=xxx
./bin/spica mvp "build app"  # 会用 gpt-4 → Together API 报错

# 正确：指定 Together 模型
export TOGETHER_MODEL=llama-3-70b
./bin/spica mvp "build app"  # ✓ 正确调用 llama-3-70b
```

---

## 模型名列表

### Together AI
- `meta-llama/Llama-3-70b-chat-hf`
- `meta-llama/Llama-3-8b-chat-hf`
- `mistralai/Mixtral-8x7B-Instruct-v0.1`
- https://api.together.xyz/models

### Groq
- `llama-3-70b`
- `llama-3-8b`
- `mixtral-8x7b`

### Local（llama.cpp/vLLM）
- 模型名取决于本地加载的模型
- 通常：`llama-3`, `mistral`, `qwen` 等

---

## 现在可以

✅ 环境变量完整支持模型名
✅ 支持 OpenAI-compatible 调用第三方模型
✅ 配置文件和环境变量均可指定模型名

**立即测试：**

```bash
# 设置环境变量（示例）
export OPENAI_MODEL=gpt-4-turbo

cd ~/development/spica/spica-cli
./bin/spica providers show openai
```