# spica-cli 配置指南

完整的配置说明，涵盖所有配置类型。

---

## 快速配置

```bash
# 一键配置OpenAI
spica providers set openai sk-proj-xxx...

# 一键配置Together AI
spica providers set together xxx... -m llama-3-70b

# 一键配置本地模型
spica providers set local dummy -b http://localhost:8000/v1 -m llama-3

# 设置默认提供商
spica providers default openai
```

---

## 配置文件位置

### 全局配置

| 文件 | 位置 | 用途 |
|------|------|------|
| `config.json` | `~/.spica/config.json` | API提供商配置 |
| `skills.json` | `~/.spica/skills.json` | Skills定义 |
| `mcp.json` | `~/.spica/mcp.json` | MCP服务器配置 |
| `hooks.json` | `~/.spica/hooks.json` | Hooks规则（可选） |

### 项目配置

| 文件 | 位置 | 用途 |
|------|------|------|
| `session.json` | `.spica/session.json` | 会话历史 |
| `state.json` | `.spica/state.json` | 项目状态 |
| `hooks.json` | `.spica/hooks.json` | 项目Hooks（可选） |
| `.spica.md` | 项目根目录 | 项目描述 |

---

## API提供商配置

### CLI配置

```bash
# 设置API密钥
spica providers set <name> <api-key>

# 设置baseUrl
spica providers set <name> baseUrl <url>

# 设置model
spica providers set <name> model <model-name>

# 添加自定义提供商
spica providers add <name> <api-key> --url <url> --model <model>

# 设置默认
spica providers default <name>
```

### 配置文件格式

`~/.spica/config.json`:

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
      "model": "meta-llama/Llama-3-70b-chat-hf"
    },
    "local": {
      "name": "Local",
      "apiKey": "dummy",
      "baseUrl": "http://localhost:8000/v1",
      "model": "llama-3"
    }
  }
}
```

### 内置提供商

| 提供商 | baseUrl | 默认model |
|--------|---------|-----------|
| openai | `https://api.openai.com/v1` | `gpt-4` |
| anthropic | `https://api.anthropic.com/v1` | `claude-3-opus` |
| together | `https://api.together.xyz/v1` | `llama-3-70b` |
| groq | `https://api.groq.com/openai/v1` | `llama-3-70b` |
| replicate | `https://api.replicate.com/v1` | `llama-3` |
| azure | (需手动设置) | `gpt-4` |
| local | `http://localhost:8000/v1` | `llama-3` |
| custom | (需手动设置) | `gpt-4` |

### 环境变量

```bash
# 标准环境变量
export OPENAI_API_KEY=sk-xxx...
export OPENAI_MODEL=gpt-4
export OPENAI_BASE_URL=https://api.openai.com/v1

# spica特定环境变量
export SPICA_TOGETHER_API_KEY=xxx...
export SPICA_GROQ_API_KEY=gsk_xxx...
export SPICA_LOCAL_BASE_URL=http://localhost:8000/v1
```

---

## Skills配置

### 配置位置

- 全局: `~/.spica/skills.json`
- 项目: `.spica/skills.json`（优先级更高）

### 配置格式

```json
{
  "skills": {
    "review": {
      "name": "review",
      "description": "代码审查",
      "promptTemplate": "审查代码: {files}",
      "allowedTools": ["file_read", "grep", "lint"]
    },
    "fix": {
      "name": "fix",
      "description": "修复问题",
      "promptTemplate": "修复 {file} 中的bug",
      "allowedTools": ["file_read", "file_edit", "bash"]
    }
  }
}
```

### CLI管理

```bash
# 列出Skills
spica skills

# 安装Skill
spica skills install https://example.com/skills.json

# 卸载Skill
spica skills uninstall <name>
```

### 使用

在交互模式中：

```
/review src/auth.ts
/fix src/utils/helper.ts
```

---

## MCP配置

### 配置位置

`~/.spica/mcp.json`

### 配置格式

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path"],
      "disabled": false
    },
    {
      "name": "postgres",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-postgres"],
      "env": {
        "POSTGRES_URL": "postgres://localhost/db"
      }
    },
    {
      "name": "slack",
      "url": "http://localhost:3000/mcp"
    }
  ]
}
```

### CLI管理

```bash
# 查看状态
spica mcp

# 列出服务器
spica mcp list

# 列出工具
spica mcp tools

# 初始化配置
spica mcp init
```

### 常用MCP服务器

| 服务器 | 命令 | 用途 |
|--------|------|------|
| filesystem | `@anthropic-ai/mcp-server-filesystem` | 文件系统 |
| postgres | `@anthropic-ai/mcp-server-postgres` | PostgreSQL |
| brave-search | `@anthropic-ai/mcp-server-brave-search` | Brave搜索 |
| slack | `@anthropic-ai/mcp-server-slack` | Slack集成 |

---

## Hooks配置

### 配置位置

- 全局: `~/.spica/hooks.json`
- 项目: `.spica/hooks.json`（合并生效）

### 配置格式

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": {
          "tool": "bash",
          "args": { "command": "*rm -rf*" }
        },
        "action": "block",
        "message": "禁止删除整个目录"
      },
      {
        "matcher": {
          "tool": "file_*",
          "args": { "path": "*.env" }
        },
        "action": "confirm",
        "message": "确认修改环境文件？"
      }
    ],
    "PostToolUse": [
      {
        "matcher": { "tool": "file_*" },
        "action": "log",
        "message": "文件操作已记录"
      }
    ]
  }
}
```

### Action类型

| Action | 说明 |
|--------|------|
| `block` | 阻止执行 |
| `confirm` | 请求用户确认 |
| `warn` | 显示警告但继续 |
| `log` | 记录日志 |

---

## 本地模型配置

### llama.cpp

```bash
# 启动服务
llama-server -m llama-3.gguf --port 8000

# 配置spica
spica providers set local dummy \
  -b http://localhost:8000/v1 \
  -m llama-3

# 使用
spica run "创建应用" -p local
```

### vLLM

```bash
# 启动服务
python -m vllm.entrypoints.openai.api_server --model llama-3

# 配置spica
spica providers set local dummy \
  -b http://localhost:8000/v1 \
  -m llama-3
```

### Ollama

```bash
# 启动服务
ollama serve

# 配置spica
spica providers set local dummy \
  -b http://localhost:11434/v1 \
  -m llama3
```

---

## 项目描述文件

### 位置

`<project-root>/.spica.md`

### 格式

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
```

### 自动生成

首次启动时根据项目类型自动检测生成。

---

## 配置优先级

从高到低：

1. **环境变量** - 最高优先级
2. **命令行参数** - `-p/--provider`
3. **项目配置** - `.spica/*.json`
4. **全局配置** - `~/.spica/*.json`
5. **内置默认值** - 最低优先级

---

## 安全性

### 权限设置

```bash
chmod 700 ~/.spica/
chmod 600 ~/.spica/config.json
chmod 600 ~/.spica/skills.json
chmod 600 ~/.spica/mcp.json
```

### Git忽略

确保 `.gitignore`:

```
.spica/
*.env
```

---

## 常见问题

### Q: 如何查看当前配置？

```bash
spica providers
# 或交互模式中
/status
```

### Q: 配置文件在哪里？

- 全局: `~/.spica/`
- 项目: `.spica/`

### Q: 如何切换提供商？

```bash
# 临时切换
spica run "任务" -p together

# 永久切换
spica providers default together
```

### Q: 如何清空配置？

```bash
rm -rf ~/.spica/
```

---

## 相关文档

- [MANUAL.md](./MANUAL.md) - 完整用户手册
- [STORAGE.md](./STORAGE.md) - 存储位置详解
- [providers.md](./providers.md) - 提供商详细说明