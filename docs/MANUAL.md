# spica-cli 用户手册

> AI coding agent - 智能代码助手

---

## 目录

1. [快速开始](#快速开始)
2. [CLI 命令](#cli-命令)
3. [交互指令](#交互指令)
4. [输入队列](#输入队列)
5. [Skills 系统](#skills-系统)
6. [MCP 协议](#mcp-协议)
7. [Hooks 系统](#hooks-系统)
8. [配置存储](#配置存储)
9. [多开支持](#多开支持)
10. [环境变量](#环境变量)
11. [常见问题](#常见问题)

---

## 快速开始

### 安装

```bash
git clone https://github.com/your/spica-cli.git
cd spica-cli
npm install
npm run build
npm link  # 全局安装（可选）
```

### 配置

```bash
# 设置 API 密钥
spica providers set openai sk-your-key

# 或使用环境变量
export OPENAI_API_KEY=sk-your-key
```

### 使用

```bash
spica              # 启动交互模式（自动加载历史）
spica --fresh      # 清空历史启动
spica run "任务"   # 单次执行
```

---

## CLI 命令

### 基本命令

| 命令 | 说明 |
|------|------|
| `spica` | 启动交互模式（自动加载历史） |
| `spica --fresh` | 清空历史启动 |
| `spica -p <name>` | 使用指定 provider |
| `spica run <request>` | 单次执行任务 |

### Providers 管理

```bash
spica providers                    # 列出所有 providers
spica providers set <name> <key>   # 设置 provider
spica providers add <name> <key> --url <url> --model <model>  # 添加自定义 provider
spica providers default <name>     # 设置默认 provider
spica providers show <name>        # 显示 provider 详情
spica providers remove <name>      # 删除 provider
```

### Skills 管理

```bash
spica skills                       # 列出所有 skills
spica skills install <url-or-file> # 安装 skill 包
spica skills uninstall <package>   # 卸载 skill 包
spica skills packages              # 列出已安装包
```

### MCP 管理

```bash
spica mcp                          # 显示 MCP 状态
spica mcp init                     # 初始化 MCP 配置
spica mcp list                     # 列出已连接服务器
spica mcp tools                    # 列出可用工具
spica mcp disconnect               # 断开所有连接
```

---

## 交互指令

### 非 `/` 命令

| 命令 | 说明 |
|------|------|
| `quit` `exit` | 退出程序 |
| `help` | 显示帮助 |

### `/` 指令（Tab 自动补全）

**Session 管理：**

| 指令 | 说明 |
|------|------|
| `/clear` `/reset` | 清空会话 |
| `/history` | 显示全部消息历史 |
| `/compact` | 压缩上下文（显示进度） |

**输入队列：**

| 指令 | 说明 |
|------|------|
| `/queue` `/q` | 显示队列状态 |
| `/undo` | 撤回最后一个排队输入 |

**权限模式：**

| 指令 | 说明 |
|------|------|
| `/bypass` | 自动批准模式（危险操作自动执行） |
| `/strict` | 权限请求模式（每次确认） |
| `/status` | 显示当前状态 |

**Skills：**

| 指令 | 说明 |
|------|------|
| `/skills` | 列出已安装 skills |
| `/skill_name [args]` | 调用指定 skill |

**提示：输入 `/` 后按 TAB 自动补全**

---

## 输入队列

AI 处理时可以继续输入，不会阻塞。输入自动加入队列，AI 完成后合并处理。

**使用示例：**

```bash
> 分析代码结构
[processing] You can continue typing...
> 然后添加单元测试
[QUEUE] Added (1 pending)
> 使用 vitest
[QUEUE] Added (2 pending)

[OK] Done

[QUEUE] Processing 2 inputs...
Combined input:
然后添加单元测试
使用 vitest
```

**队列操作：**

| 指令 | 说明 |
|------|------|
| `/queue` `/q` | 查看队列状态 |
| `/undo` | 撤回最后一个输入 |

---

## Skills 系统

Skill 是用户自定义的命令模板，用于快速执行常用任务。

### 配置位置

- 全局：`~/.spica/settings.json` 的 `skills` 字段
- 项目：`.spica/skills.json`（覆盖全局）

### Skill 格式

```json
{
  "skills": {
    "review": {
      "description": "代码审查",
      "promptTemplate": "审查 {files} 的代码质量",
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

**字段说明：**

| 字段 | 必需 | 说明 |
|------|------|------|
| `description` | 是 | Skill 描述 |
| `promptTemplate` | 是 | 提示模板，`{var}` 为变量 |
| `allowedTools` | 否 | 允许使用的工具 |
| `argumentHint` | 否 | 参数提示，如 `[files]` |

### 安装 Skill 包

```bash
# 从 URL 安装
spica skills install https://example.com/skills.json

# 从 GitHub 安装
spica skills install https://github.com/user/skills-repo

# 从本地文件安装
spica skills install ./my-skills.json
```

Skill 包格式：

```json
{
  "name": "my-skills",
  "version": "1.0.0",
  "description": "My skill collection",
  "skills": {
    "review": { ... },
    "deploy": { ... }
  }
}
```

---

## MCP 协议

MCP (Model Context Protocol) 用于连接外部工具服务器。

### 配置位置

`~/.spica/settings.json` 的 `mcp.servers` 字段：

```json
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
      },
      {
        "name": "custom-api",
        "url": "http://localhost:3000/mcp"
      }
    ]
  }
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 服务器名称 |
| `command` | string | Stdio 模式启动命令 |
| `args` | string[] | 命令参数 |
| `url` | string | SSE 模式 HTTP 地址 |
| `env` | object | 环境变量 |
| `disabled` | boolean | 是否禁用 |

### MCP 工具调用

MCP 工具以 `server_name/tool_name` 格式暴露，如：

- `filesystem/read_file`
- `postgres/query`

---

## Hooks 系统

Hooks 用于拦截工具调用，阻止危险操作或记录日志。

### 配置位置

- 全局：`~/.spica/settings.json` 的 `hooks` 字段
- 项目：`.spica/hooks.json`（追加全局）

### Hooks 格式

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": { "tool": "bash", "args": { "command": "*--force*" } },
        "action": "block",
        "message": "禁止使用 --force"
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

**字段说明：**

| 字段 | 说明 |
|------|------|
| `matcher.tool` | 工具名匹配（支持 `*` 通配符） |
| `matcher.args` | 参数匹配（支持 `*` 通配符） |
| `action` | `block` / `confirm` / `warn` / `log` |
| `message` | 提示消息 |

---

## 配置存储

### 全局配置

```
~/.spica/
├── settings.json       # 统一配置（providers, mcp, skills, hooks）
└── installed-skills/   # 已安装 skill 包
```

**settings.json 包含：**

```json
{
  "defaultProvider": "openai",
  "providers": { ... },
  "mcp": { "servers": [...] },
  "skills": { ... },
  "hooks": { ... }
}
```

### 项目配置

```
<project>/.spica/
├── session.json        # 会话状态（消息历史）
├── skills.json         # 项目 skills（可选，覆盖全局）
└── hooks.json          # 项目 hooks（可选，追加全局）
```

### 项目描述文件

```
<project>/AGENTS.md     # 项目描述（行业标准）
```

---

## 多开支持

使用 **Git Worktree** 可以同时运行多个 spica：

```bash
# 创建 worktree
git worktree add ../spica-auth feature-auth
git worktree add ../spica-api feature-api

# 在不同 worktree 启动 spica
cd ../spica-auth && spica
cd ../spica-api && spica

# 完成后合并
cd ../main-project
git merge feature-auth
git merge feature-api

# 清理 worktree
git worktree remove ../spica-auth
git worktree remove ../spica-api
```

**为什么使用 Git Worktree？**
- Git 原生功能，成熟可靠
- 每个 worktree 有独立的 `.spica/session.json`
- spica 保持轻量，不替代 git 操作

---

## 环境变量

### API 配置

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `OPENAI_BASE_URL` | API 地址 |
| `OPENAI_MODEL` | 模型名称 |

### Provider 专用

| 变量 | 说明 |
|------|------|
| `SPICA_<NAME>_API_KEY` | 指定 provider 密钥 |
| `SPICA_<NAME>_MODEL` | 指定 provider 模型 |
| `SPICA_<NAME>_BASE_URL` | 指定 provider 地址 |

示例：
```bash
export SPICA_TOGETHER_API_KEY=xxx...
export SPICA_GROQ_API_KEY=gsk_xxx...
```

---

## 常见问题

### Q: 如何查看历史消息？

```bash
/history    # 显示全部消息
```

### Q: 如何清空历史？

```bash
/clear          # 交互模式清空
spica --fresh   # 启动时清空
```

### Q: 会话如何保存？

- **自动加载**：启动时自动加载 `.spica/session.json`
- **自动保存**：每次 AI 处理完自动保存
- **手动压缩**：`/compact` 压缩上下文（超过 40 条自动压缩）
- **压缩动画**：压缩时显示进度

### Q: 如何切换模型？

```bash
spica providers set openai sk-xxx --model gpt-4-turbo
spica -p together run "任务"   # 使用其他 provider
```

### Q: 如何恢复错误修改？

```bash
# AI 会自动使用 checkpoint_restore
# 或手动 git 操作
git log --oneline
git reset --hard HEAD~1
```

### Q: 输入队列是什么？

AI 处理时可以继续输入，不会阻塞。所有输入加入队列，AI 完成后合并处理。

```bash
> 任务1
[processing] You can continue typing...
> 任务2
> 任务3

[OK] Done
[QUEUE] Processing 2 inputs... (任务2 + 任务3)
```

### Q: bypass 和 strict 模式有什么区别？

- **bypass**: 自动批准所有操作（包括危险操作）
- **strict**: 每个操作请求用户确认

```bash
/bypass    # 切换到自动批准模式
/strict    # 切换到权限请求模式
```

### Q: 如何添加自定义 Skill？

编辑 `~/.spica/settings.json`：

```json
{
  "skills": {
    "my-skill": {
      "description": "我的自定义 skill",
      "promptTemplate": "执行 {task}",
      "argumentHint": "[task]"
    }
  }
}
```

或创建项目 `.spica/skills.json`。

---

## 设计理念

**spica 保持轻量：**
- 不替代 git 原生功能（worktree, merge 等）
- 灵活调用成熟工具（MCP, hooks）
- 专注 agent 核心功能

**配置简洁：**
- 一个 `settings.json` 包含所有全局配置
- 项目只需 `.spica/session.json`
- 遵循行业标准（AGENTS.md）

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [CONFIGURATION.md](./CONFIGURATION.md) | 配置指南 |
| [STORAGE.md](./STORAGE.md) | 存储位置详解 |
| [CLAUDE.md](../CLAUDE.md) | 开发者架构指南