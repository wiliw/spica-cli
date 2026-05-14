# 配置示例

## 标准 OpenAI

```bash
# 设置API密钥
spica providers set openai sk-proj-xxx...

# 设置模型
spica providers set openai model gpt-4-turbo

# 设置API地址（可选）
spica providers set openai baseUrl https://api.openai.com/v1

# 设置为默认提供商
spica providers default openai
```

## Together AI（开源模型）

```bash
# 设置API密钥和模型
spica providers set together xxx... -m llama-3-70b

# 使用
spica run "创建应用" -p together
```

## Groq（快速推理）

```bash
# 设置API密钥
spica providers set groq gsk_xxx... -m llama-3-70b

# 使用
spica run "快速修复" -p groq
```

## 本地模型

### llama.cpp

```bash
# 启动服务
llama-server -m llama-3-8b.gguf --port 8000

# 配置
spica providers set local dummy \
  -b http://localhost:8000/v1 \
  -m llama-3-8b

# 使用
spica -p local
```

### vLLM

```bash
# 启动服务
python -m vllm.entrypoints.openai.api_server --model llama-3-8b

# 配置
spica providers set local dummy \
  -b http://localhost:8000/v1 \
  -m llama-3-8b
```

### Ollama

```bash
# 启动服务
ollama serve

# 配置
spica providers set local dummy \
  -b http://localhost:11434/v1 \
  -m llama3
```

## Azure OpenAI

```bash
# 配置
spica providers add azure your-azure-key \
  --url https://your-resource.openai.azure.com/openai/deployments/your-deployment \
  --model gpt-4

# 设置为默认
spica providers default azure
```

## 自定义提供商

```bash
# 添加自定义API
spica providers add myapi your-key \
  --url https://your-api.com/v1 \
  --model your-model

# 使用
spica -p myapi run "任务"
```

## 环境变量配置

```bash
# 标准变量
export OPENAI_API_KEY=sk-xxx...
export OPENAI_MODEL=gpt-4
export OPENAI_BASE_URL=https://api.openai.com/v1

# spica特定变量
export SPICA_TOGETHER_API_KEY=xxx...
export SPICA_GROQ_API_KEY=gsk_xxx...
export SPICA_LOCAL_BASE_URL=http://localhost:8000/v1
```

## 查看配置

```bash
# 列出所有提供商
spica providers

# 显示配置状态
# 在交互模式中输入：
/status
```

## Skills配置示例

`~/.spica/skills.json`:

```json
{
  "skills": {
    "review": {
      "description": "代码审查",
      "promptTemplate": "审查 {files} 的代码质量、安全性和性能",
      "allowedTools": ["file_read", "grep", "lint"]
    },
    "fix": {
      "description": "自动修复",
      "promptTemplate": "分析并修复 {file} 中的问题",
      "allowedTools": ["file_read", "file_edit", "bash"]
    },
    "search": {
      "description": "快速搜索",
      "promptTemplate": "在代码库中搜索: {query}",
      "allowedTools": ["glob", "grep", "file_read"]
    }
  }
}
```

## MCP配置示例

`~/.spica/mcp.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/home/user/project"]
    },
    {
      "name": "postgres",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-postgres"],
      "env": {
        "POSTGRES_URL": "postgres://localhost/mydb"
      }
    },
    {
      "name": "custom-api",
      "url": "http://localhost:3000/mcp"
    }
  ]
}
```

## Hooks配置示例

`~/.spica/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": { "tool": "bash", "args": { "command": "*--force*" } },
        "action": "block",
        "message": "禁止使用 --force 参数"
      },
      {
        "matcher": { "tool": "file_*", "args": { "path": "*.env*" } },
        "action": "confirm",
        "message": "确认修改环境配置文件？"
      },
      {
        "matcher": { "tool": "file_write", "args": { "path": "*package.json" } },
        "action": "confirm",
        "message": "确认修改 package.json？"
      }
    ],
    "PostToolUse": [
      {
        "matcher": { "tool": "file_*" },
        "action": "log",
        "message": "文件操作完成"
      }
    ]
  }
}
```

## 项目描述文件示例

`<project>/.spica.md`:

```markdown
# Spica Project Config

## Project Info
- Type: Node.js
- Framework: Express
- Language: TypeScript

## Commands
- Build: `npm run build`
- Test: `npm test`
- Dev: `npm run dev`

## Constraints
- No comments unless asked
- Use Vitest for testing
- Git commit messages in English
```