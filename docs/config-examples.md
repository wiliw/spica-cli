# 配置示例

## Provider 配置

```bash
# 设置 provider（一次性）
spica set <name> <url> <apiKey> <model>

# 切换默认
spica use <name>

# 查看
spica list
spica show
```

## 示例

### DeepSeek

```bash
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica use deepseek
```

### 阿里云 GLM

```bash
spica set aliyun https://coding.dashscope.aliyuncs.com/v1 sk-xxx glm-5
spica use aliyun
```

### Together AI

```bash
spica set together https://api.together.xyz/v1 xxx llama-3-70b
spica run "创建应用" -p together
```

### Groq

```bash
spica set groq https://api.groq.com/openai/v1 gsk_xxx llama-3-70b
spica run "快速修复" -p groq
```

### 本地模型

```bash
# llama.cpp
llama-server -m llama-3.gguf --port 8000
spica set local http://localhost:8000/v1 dummy llama-3

# Ollama
ollama serve
spica set local http://localhost:11434/v1 dummy llama3
```

## 环境变量（可选）

```bash
export OPENAI_API_KEY=sk-xxx
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-4o
```

## MCP配置示例

`~/.spica/settings.json`:

```json
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/home/user/project"]
      }
    ]
  }
}
```

## Hooks配置示例

`~/.spica/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": { "tool": "bash", "args": { "command": "*--force*" } },
        "action": "block",
        "message": "Blocked: --force"
      }
    ]
  }
}
```