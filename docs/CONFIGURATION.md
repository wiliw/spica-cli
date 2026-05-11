# spica-cli 配置指南

## CLI 配置（推荐）

### 配置 Provider

```bash
cd ~/development/spica/spica-cli

# OpenAI（标准）
./bin/spica providers set openai sk-proj-xxx... -m gpt-4

# Anthropic（Claude）
./bin/spica providers set anthropic sk-ant-xxx... -m claude-3-opus

# Together AI（开源模型）
./bin/spica providers set together xxx... -m llama-3-70b

# Groq（快速推理）
./bin/spica providers set groq gsk_xxx... -m llama-3-70b

# 本地模型（llama.cpp/vLLM）
./bin/spica providers set local dummy \
  -b http://localhost:8000/v1 \
  -m llama-3

# 自定义 OpenAI-compatible endpoint
./bin/spica providers set custom your-key \
  -b https://your-api.com/v1 \
  -m your-model
```

### 管理配置

```bash
# 查看所有 providers
./bin/spica providers

# 查看详细配置
./bin/spica providers show openai

# 设置默认 provider
./bin/spica providers default openai

# 删除 provider（未实现）
./bin/spica providers delete openai
```

---

## TUI 配置（首次使用）

启动 TUI 后自动检测，未配置时显示欢迎界面：

```bash
./bin/spica
```

按 **S** 或 **C** 进入设置界面：
- ↑↓ 选择 provider
- Enter 输入 API key
- 输入 Base URL（可跳过，自动填充）
- 输入 Model（可跳过，自动填充）

---

## 配置文件位置

**全局配置：**
- `~/.spica/config.json`

**内容示例：**
```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "name": "OpenAI",
      "apiKey": "sk-proj-xxx...",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4"
    },
    "local": {
      "name": "Local Model",
      "apiKey": "dummy",
      "baseUrl": "http://localhost:8000/v1",
      "model": "llama-3"
    }
  }
}
```

---

## 本地模型设置

### llama.cpp

```bash
# 启动 server
llama-server -m llama-3-8b.Q4_K_M.gguf --port 8000

# 配置 spica-cli
./bin/spica providers set local dummy \
  -b http://localhost:8000/v1 \
  -m llama-3-8b

# 使用
./bin/spica mvp "build app" --provider local
```

### vLLM

```bash
# 启动 server
python -m vllm.entrypoints.openai.api_server --model llama-3-8b

# 配置 spica-cli
./bin/spica providers set local dummy \
  -b http://localhost:8000/v1 \
  -m llama-3-8b
```

### Ollama

```bash
# 启动 Ollama
ollama serve

# 配置 spica-cli
./bin/spica providers set local dummy \
  -b http://localhost:11434/v1 \
  -m llama3
```

---

## 环境变量（备用）

```bash
# 设置环境变量
export OPENAI_API_KEY=sk-xxx...

# spica-cli 会自动读取（fallback）
./bin/spica mvp "build app"
```

---

## 切换 Provider

### CLI 切换

```bash
# 使用特定 provider
./bin/spica mvp "build app" --provider together

# 使用本地模型
./bin/spica cycle "fix bug" --provider local
```

### TUI 切换（未来功能）

主界面按 **P** 弹出 provider 选择。

---

## 推荐配置

**开发阶段：**
- Together AI（开源模型，便宜）
- Groq（快速推理）
- Local（完全隐私）

**生产阶段：**
- OpenAI GPT-4（稳定）
- Anthropic Claude（高质量）

**隐私优先：**
- Local models（llama.cpp/vLLM）