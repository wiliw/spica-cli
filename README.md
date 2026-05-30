# spica-cli

AI coding agent CLI. 智能代码助手。

**OpenAI-compatible：支持任何第三方模型**

---

## 快速开始

```bash
# 安装
npm install
npm run build

# 配置API（方式1：CLI）
spica providers set openai sk-your-key

# 配置API（方式2：环境变量）
export OPENAI_API_KEY=your-key

# 启动交互模式
spica

# 单次执行
spica run "创建一个Hello World程序"

# 恢复上次会话
spica --continue
```

---

## 核心特性

- ✅ **持续对话** - 多轮交互，自动保存历史
- ✅ **24种工具** - 文件/Shell/Git/GitHub/Web/搜索
- ✅ **Skills系统** - 自定义命令模板
- ✅ **MCP协议** - 连接外部工具服务器
- ✅ **Hooks系统** - 安全拦截和日志记录
- ✅ **Git Checkpoint** - 自动保存，错误恢复
- ✅ **会话持久化** - 断点续传，压缩优化
- ✅ **权限控制** - 安全拦截和确认
- ✅ **Hooks 系统** - Pre/Post 工具拦截
- ✅ **MCP 协议** - 外部工具服务器
- ✅ **多提供商** - OpenAI/Anthropic/Together/Groq/本地模型

---

## 命令

### 主命令

| 命令 | 说明 |
|------|------|
| `spica` | 启动交互模式 |
| `spica run <request>` | 单次执行 |
| `spica -f/--fresh` | 清空历史启动 |
| `spica -p/--provider <name>` | 使用指定提供商 |
| `spica --version` | 显示版本 |
| `spica --no-tui` | 非交互模式 |

### 管理命令

| 命令 | 说明 |
|------|------|
| `spica providers [action]` | 管理API提供商 |
| `spica skills [action]` | 管理Skills |
| `spica mcp [action]` | 管理MCP服务器 |

---

## 内置工具

### 文件操作
`file_read` `file_write` `file_edit` `file_delete` `file_copy` `file_move` `file_exists`

### 目录操作
`directory_create` `directory_list`

### 搜索
`glob` `grep`

### Shell & Git
`bash` `git`

### GitHub
`gh`

### 网络
`web_search` `web_fetch`

### 其他
`question` `todo_write` `todo_read` `task` `workspace` `lint` `test`

---

## 支持的提供商

| 提供商 | baseUrl | 默认model |
|--------|---------|-----------|
| OpenAI | `api.openai.com/v1` | `gpt-4` |
| Anthropic | `api.anthropic.com/v1` | `claude-3-opus` |
| Together AI | `api.together.xyz/v1` | `llama-3-70b` |
| Groq | `api.groq.com/openai/v1` | `llama-3-70b` |
| Local | `localhost:8000/v1` | `llama-3` |
| Custom | 自定义 | `gpt-4` |

---

## 配置

### 配置文件位置

```
~/.spica/
├── settings.json  # 统一配置（providers, mcp, skills, hooks）

<project>/.spica/
├── session.json   # 会话历史
├── skills.json    # 项目 Skills（可选）
├── hooks.json     # 项目 Hooks（可选）
```

### CLI配置

```bash
# 设置API密钥
spica providers set openai sk-xxx...

# 设置模型
spica providers set openai -m gpt-4-turbo

# 设置API地址
spica providers set openai -b https://api.openai.com/v1

# 设置默认提供商
spica providers default openai
```

### 环境变量

```bash
export OPENAI_API_KEY=sk-xxx...
export OPENAI_MODEL=gpt-4
export OPENAI_BASE_URL=https://api.openai.com/v1
```

---

## 内置指令

交互模式中：

| 指令 | 说明 |
|------|------|
| `quit` / `exit` | 退出 |
| `clear` / `reset` | 清空历史 |
| `help` | 显示帮助 |
| `/bypass` | 自动批准模式 |
| `/strict` | 权限请求模式 |
| `/status` | 显示状态 |
| `/history` | 查看历史消息 |
| `/compact` | 压缩上下文 |
| `/init` | 分析代码库生成 AGENTS.md |
| `/queue` | 显示输入队列 |
| `/undo` | 撤回排队输入 |
| `/skills` | 列出已安装 skills |
| `/skill_name [args]` | 调用指定 skill |

---

## Skills系统

自定义命令模板：

```json
// ~/.spica/settings.json 的 skills 字段
{
  "skills": {
    "review": {
      "description": "代码审查",
      "promptTemplate": "审查代码: {files}",
      "allowedTools": ["file_read", "grep", "lint"]
    }
  }
}
```

使用：`/review src/auth.ts`

---

## MCP协议

连接外部工具服务器：

```json
// ~/.spica/settings.json 的 mcp.servers 字段
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path"]
      },
      {
        "name": "postgres",
        "command": "npx",
        "args": ["-y", "@anthropic-ai/mcp-server-postgres"],
        "env": { "POSTGRES_URL": "postgres://localhost/db" }
      }
    ]
  }
}
```

---

## Hooks系统

安全拦截：

```json
// ~/.spica/settings.json 的 hooks 字段
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": { "tool": "bash", "args": { "command": "*--force*" } },
        "action": "block",
        "message": "禁止使用 --force"
      }
    ]
  }
}
```

---

## 本地模型

```bash
# llama.cpp
llama-server -m llama-3.gguf --port 8000
spica providers set local dummy -b http://localhost:8000/v1 -m llama-3

# Ollama
ollama serve
spica providers set local dummy -b http://localhost:11434/v1 -m llama3

# vLLM
python -m vllm.entrypoints.openai.api_server --model llama-3
spica providers set local dummy -b http://localhost:8000/v1 -m llama-3
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [MANUAL.md](docs/MANUAL.md) | 完整用户手册 |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | 配置指南 |
| [STORAGE.md](docs/STORAGE.md) | 存储位置详解 |
| [providers.md](docs/providers.md) | 提供商说明 |
| [ENV_VARS.md](docs/ENV_VARS.md) | 环境变量 |
| [SECURITY.md](docs/SECURITY.md) | 安全说明 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构文档 |

---

## 开发

```bash
npm run dev      # 开发模式运行 (tsx)
npm run build    # 构建CLI
npm test         # 运行测试 (vitest watch)
npm run test:run # 单次测试
npx tsc --noEmit # 类型检查
```

---

## License

MIT