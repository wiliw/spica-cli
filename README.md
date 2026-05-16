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
```

---

## 核心特性

- ✅ **持续对话** - 多轮交互，自动保存历史
- ✅ **35种工具** - 文件/Shell/Git/GitHub/Web/搜索
- ✅ **Skills系统** - 自定义命令模板
- ✅ **MCP协议** - 连接外部工具服务器
- ✅ **Hooks系统** - 安全拦截和日志记录
- ✅ **Git Checkpoint** - 自动保存，错误恢复
- ✅ **会话持久化** - 断点续传，压缩优化
- ✅ **权限控制** - 危险操作检测，bypass/strict模式
- ✅ **输入队列** - 非阻塞输入，合并处理
- ✅ **多提供商** - OpenAI/Anthropic/Together/Groq/本地模型

---

## 命令

### 主命令

| 命令 | 说明 |
|------|------|
| `spica` | 启动交互模式 |
| `spica --fresh` | 清空历史启动 |
| `spica -p <name>` | 使用指定提供商 |
| `spica run <request>` | 单次执行任务 |

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
`bash` `git_status` `git_diff` `git_log` `git_add` `git_commit` `git_branch` `git_checkout`

### GitHub
`gh_pr_view` `gh_issue_list` `gh_issue_view` `gh_repo_view` `gh_run_list`

### 网络
`web_search` `web_fetch`

### 其他
`question` `todo_write` `task` `workspace` `checkpoint_restore` `lint` `test`

---

## 支持的提供商

| 提供商 | baseUrl | 默认model |
|--------|---------|-----------|
| OpenAI | `api.openai.com/v1` | `gpt-4` |
| Anthropic | `api.anthropic.com/v1` | `claude-3-opus` |
| Together AI | `api.together.xyz/v1` | `meta-llama/Llama-3-70b-chat-hf` |
| Groq | `api.groq.com/openai/v1` | `llama-3-70b` |
| Local | `localhost:8000/v1` | `llama-3` |

---

## 配置

### 配置文件位置

```
~/.spica/
├── settings.json    # 统一配置（providers, mcp, skills, hooks）

<project>/.spica/
├── session.json     # 会话历史（自动保存）
```

### CLI配置

```bash
# 设置API密钥
spica providers set openai sk-xxx...

# 设置模型
spica providers set openai sk-xxx --model gpt-4-turbo

# 设置API地址
spica providers set local dummy --url http://localhost:8000/v1 --model llama-3

# 设置默认提供商
spica providers default openai
```

### 环境变量

```bash
export OPENAI_API_KEY=sk-xxx...
export OPENAI_MODEL=gpt-4
export OPENAI_BASE_URL=https://api.openai.com/v1

# Provider专用
export SPICA_TOGETHER_API_KEY=xxx...
export SPICA_GROQ_API_KEY=gsk_xxx...
```

---

## 交互指令

交互模式中：

| 指令 | 说明 |
|------|------|
| `quit` / `exit` | 退出 |
| `help` | 显示帮助 |
| `/clear` | 清空历史 |
| `/history` | 显示历史消息 |
| `/compact` | 压缩上下文 |
| `/queue` | 显示输入队列 |
| `/undo` | 撤回排队输入 |
| `/bypass` | 自动批准模式 |
| `/strict` | 权限请求模式 |
| `/status` | 显示状态 |
| `/skills` | 列出skills |
| `/skill_name` | 调用skill |

**Tab补全：输入 `/` 后按 TAB**

---

## Skills系统

自定义命令模板：

```json
// ~/.spica/settings.json
{
  "skills": {
    "review": {
      "description": "代码审查",
      "promptTemplate": "审查代码: {files}",
      "allowedTools": ["file_read", "grep", "lint"],
      "argumentHint": "[files]"
    }
  }
}
```

使用：`/review src/auth.ts`

---

## MCP协议

连接外部工具服务器：

```json
// ~/.spica/settings.json
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
// ~/.spica/settings.json
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
spica providers set local dummy --url http://localhost:8000/v1 --model llama-3

# Ollama
ollama serve
spica providers set local dummy --url http://localhost:11434/v1 --model llama3

# vLLM
python -m vllm.entrypoints.openai.api_server --model llama-3
spica providers set local dummy --url http://localhost:8000/v1 --model llama-3
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [MANUAL.md](docs/MANUAL.md) | 完整用户手册 |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | 配置指南 |
| [STORAGE.md](docs/STORAGE.md) | 存储位置详解 |
| [CLAUDE.md](CLAUDE.md) | 开发者架构指南 |

---

## 开发

```bash
npm run dev      # 开发模式运行
npm run build    # 构建CLI
npm test         # 运行测试（watch）
npm run test:run # 单次测试
npx tsc --noEmit # 类型检查
```

---

## License

MIT