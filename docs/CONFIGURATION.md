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

### 全局配置（统一）

**位置**: `~/.spica/settings.json`

所有全局配置合并到一个文件：
- providers（API提供商）
- mcp（外部工具服务器）
- skills（自定义命令模板）
- hooks（安全拦截规则）

### 项目配置

| 文件 | 位置 | 用途 |
|------|------|------|
| `session.json` | `.spica/session.json` | 会话历史（自动保存） |
| `skills.json` | `.spica/skills.json` | 项目Skills（覆盖全局） |
| `hooks.json` | `.spica/hooks.json` | 项目Hooks（追加全局） |
| `AGENTS.md` | 项目根目录 | 项目描述（行业标准） |

---

## API提供商配置

### CLI配置

```bash
# 设置API密钥
spica providers set <name> <api-key>

# 设置baseUrl和model
spica providers set <name> <api-key> --url <url> --model <model>

# 添加自定义提供商
spica providers add <name> <api-key> --url <url> --model <model>

# 查看配置详情
spica providers show <name>

# 设置默认
spica providers default <name>

# 删除提供商
spica providers remove <name>
```

### settings.json格式

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
      "name": "Local Model",
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
| together | `https://api.together.xyz/v1` | `meta-llama/Llama-3-70b-chat-hf` |
| groq | `https://api.groq.com/openai/v1` | `llama-3-70b` |
| local | `http://localhost:8000/v1` | `llama-3` |
| custom | （需手动设置） | `gpt-4` |

### 环境变量

```bash
# 标准环境变量
export OPENAI_API_KEY=sk-xxx...
export OPENAI_MODEL=gpt-4
export OPENAI_BASE_URL=https://api.openai.com/v1

# Provider专用环境变量
export SPICA_TOGETHER_API_KEY=xxx...
export SPICA_GROQ_API_KEY=gsk_xxx...
export SPICA_LOCAL_BASE_URL=http://localhost:8000/v1
```

环境变量优先级最高，会覆盖配置文件。

---

## Skills配置

### 配置位置

- 全局: `~/.spica/settings.json` 的 `skills` 字段
- 项目: `.spica/skills.json`（**覆盖**全局）

### Skill格式

```json
{
  "skills": {
    "review": {
      "description": "代码审查",
      "promptTemplate": "审查代码: {files}",
      "allowedTools": ["file_read", "grep", "lint"],
      "argumentHint": "[files]"
    },
    "test": {
      "description": "运行测试",
      "promptTemplate": "运行测试并修复失败"
    }
  }
}
```

**字段说明**:

| 字段 | 必需 | 说明 |
|------|------|------|
| `description` | 是 | Skill描述 |
| `promptTemplate` | 是 | 提示模板，`{var}`为变量 |
| `allowedTools` | 否 | 允许使用的工具列表 |
| `argumentHint` | 否 | 参数提示，如 `[files]` |

### CLI管理

```bash
# 列出Skills
spica skills

# 安装Skill包
spica skills install https://example.com/skills.json

# 列出已安装包
spica skills packages

# 卸载Skill包
spica skills uninstall <package-name>
```

### 使用

交互模式中：

```
/review src/auth.ts
/test
```

---

## MCP配置

### 配置位置

`~/.spica/settings.json` 的 `mcp.servers` 字段

### MCP格式

```json
{
  "mcp": {
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
        "env": { "POSTGRES_URL": "postgres://localhost/db" }
      },
      {
        "name": "custom-api",
        "url": "http://localhost:3000/mcp"
      }
    ]
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 服务器名称 |
| `command` | string | Stdio模式启动命令 |
| `args` | string[] | 命令参数 |
| `url` | string | SSE模式HTTP地址 |
| `env` | object | 环境变量 |
| `disabled` | boolean | 是否禁用 |

### CLI管理

```bash
# 查看状态
spica mcp

# 列出服务器
spica mcp list

# 列出工具
spica mcp tools

# 初始化示例配置
spica mcp init

# 断开连接
spica mcp disconnect
```

### 常用MCP服务器

| 服务器 | 命令 | 用途 |
|--------|------|------|
| filesystem | `@anthropic-ai/mcp-server-filesystem` | 文件系统访问 |
| postgres | `@anthropic-ai/mcp-server-postgres` | PostgreSQL查询 |
| brave-search | `@anthropic-ai/mcp-server-brave-search` | Brave搜索 |
| slack | `@anthropic-ai/mcp-server-slack` | Slack集成 |

---

## Hooks配置

### 配置位置

- 全局: `~/.spica/settings.json` 的 `hooks` 字段
- 项目: `.spica/hooks.json`（**追加**全局）

### Hooks格式

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": {
          "tool": "bash",
          "args": { "command": "*--force*" }
        },
        "action": "block",
        "message": "禁止使用 --force"
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
        "message": "文件操作完成"
      }
    ]
  }
}
```

**Action类型**:

| Action | 说明 |
|--------|------|
| `block` | 阻止执行，返回错误 |
| `confirm` | 请求用户确认 |
| `warn` | 显示警告但继续执行 |
| `log` | 记录日志 |

**匹配规则**:
- `tool` 支持通配符 `*`（如 `file_*` 匹配所有文件工具）
- `args` 支持通配符 `*`（如 `*--force*` 匹配包含 --force 的命令）

---

## 本地模型配置

### llama.cpp

```bash
# 启动服务
llama-server -m llama-3.gguf --port 8000

# 配置spica
spica providers set local dummy -b http://localhost:8000/v1 -m llama-3

# 使用
spica run "创建应用" -p local
```

### vLLM

```bash
# 启动服务
python -m vllm.entrypoints.openai.api_server --model llama-3

# 配置spica
spica providers set local dummy -b http://localhost:8000/v1 -m llama-3
```

### Ollama

```bash
# 启动服务
ollama serve

# 配置spica（Ollama使用11434端口）
spica providers set local dummy -b http://localhost:11434/v1 -m llama3
```

---

## 配置优先级

从高到低：

1. **环境变量** - 最高优先级（`OPENAI_API_KEY`, `SPICA_*`）
2. **命令行参数** - `-p/--provider`
3. **项目配置** - `.spica/skills.json`, `.spica/hooks.json`
4. **全局配置** - `~/.spica/settings.json`
5. **内置默认值** - 最低优先级

**合并规则**:

| 配置类型 | 合并规则 |
|----------|----------|
| providers | 全局 + 环境变量覆盖 |
| mcp | 全局生效 |
| skills | 项目**覆盖**全局 |
| hooks | 项目**追加**全局 |

---

## 安全性

### 权限设置

```bash
chmod 700 ~/.spica/
chmod 600 ~/.spica/settings.json
```

保存配置时自动设置权限。

### Git忽略

确保 `.gitignore` 包含：

```
.spica/
*.env
```

---

## 常见问题

### Q: 如何查看当前配置？

```bash
spica providers
spica providers show openai
# 或交互模式中
/status
```

### Q: 配置文件在哪里？

- 全局: `~/.spica/settings.json`（统一配置）
- 项目: `.spica/session.json`（会话历史）

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

### Q: 如何查看MCP工具？

```bash
spica mcp tools
```

---

## 相关文档

- [MANUAL.md](./MANUAL.md) - 完整用户手册
- [STORAGE.md](./STORAGE.md) - 存储位置详解
- [CLAUDE.md](../CLAUDE.md) - 开发者架构指南