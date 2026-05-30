# spica-cli 用户手册

> AI coding agent - 智能代码助手

---

## 目录

1. [快速开始](#快速开始)
2. [CLI 命令](#cli-命令)
3. [交互指令](#交互指令)
4. [Skills 系统](#skills-系统)
5. [MCP 协议](#mcp-协议)
6. [Hooks 系统](#hooks-系统)
7. [配置存储](#配置存储)
8. [多开支持](#多开支持)
9. [环境变量](#环境变量)
10. [常见问题](#常见问题)

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
| `spica -f/--fresh` | 清空历史启动 |
| `spica -p <name>` | 使用指定 provider |
| `spica --no-tui` | 非交互模式（纯文本输出） |
| `spica run <request>` | 单次执行任务 |

### Providers 管理

```bash
spica providers                    # 列出所有 providers
spica providers set <name> <key>   # 设置 provider API密钥
spica providers set <name> model <model>  # 设置模型
spica providers set <name> baseUrl <url>  # 设置 API 地址
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

## Bash 工具高级模式

### TTY 模式

为需要终端环境的应用提供 TTY：

```json
{
  "name": "bash",
  "arguments": {
    "command": "npm run dev",
    "tty": true
  }
}
```

适用：Ink 框架、TUI 应用、需要 raw mode 的 CLI

### 分离模式

后台运行，用户可 attach 查看：

```json
{
  "name": "bash",
  "arguments": {
    "command": "npm run dev",
    "detached": true
  }
}
```

输出：
```
Session: spica_1234567890

To view:
  tmux attach -t spica_1234567890
```

### 交互式 PTY 模式

AI 可以实时输入/输出，自动完成交互测试：

```json
{
  "name": "bash",
  "arguments": {
    "command": "npm run dev",
    "interactive": true,
    "inputs": ["hello", "exit"]
  }
}
```

或使用 expect 模式（等待输出匹配后输入）：

```json
{
  "name": "bash",
  "arguments": {
    "command": "npm run dev",
    "interactive": true,
    "expect": [
      { "wait": "Enter name:", "input": "test" },
      { "wait": "Continue?", "input": "y" }
    ]
  }
}
```

**正则匹配**：`wait` 以 `^` 开头则使用正则匹配：

```json
{
  "expect": [
    { "wait": "^.*\\$", "input": "ls" }  // 匹配任意提示符
  ]
}
```

**适用场景**：
- TUI 应用自动化测试
- 需要用户输入的交互式 CLI
- Ink 框架应用调试

### 文件输入/输出

对于大量输入或输出，使用文件避免内存问题：

```json
{
  "name": "bash",
  "arguments": {
    "command": "cat",
    "interactive": true,
    "inputFile": "inputs.txt",
    "outputFile": "outputs.txt"
  }
}
```

- `inputFile`: 从文件读取输入（每行一个输入）
- `outputFile`: 将输出写入文件（避免返回大量数据）

**适用场景**：
- 大量输入数据（如批量测试）
- 输出过长需要保存到文件
- 日志记录

### 输出截断

防止大量输出导致内存溢出：

```json
{
  "name": "bash",
  "arguments": {
    "command": "cat large.log",
    "maxOutputLength": 100000
  }
}
```

默认截断长度 50000 字符。超长输出显示：
```
... [truncated, total 123456 chars]
```

### 会话管理

管理已启动的分离会话：

```bash
# 查看所有会话状态
bash action=status

# 杀死特定会话
bash action=kill session=spica_1234567890
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
| `/history` | 显示最近 10 条消息 |
| `/compact` | 压缩上下文 |

**输入队列：**

| 指令 | 说明 |
|------|------|
| `/queue` `/q` | 显示队列状态 |
| `/undo` | 撤回最后一个排队输入 |

**权限模式：**

| 指令 | 说明 |
|------|------|
| `/bypass` | 自动批准模式 |
| `/strict` | 权限请求模式 |
| `/status` | 显示当前状态 |

**Skills：**

| 指令 | 说明 |
|------|------|
| `/skills` | 列出已安装 skills |
| `/init` | 分析代码库并创建/更新 AGENTS.md |
| `/skill_name [args]` | 调用指定 skill |

**提示：输入 `/` 后按 TAB 自动补全**

### `/init` 指令详解

分析代码库并创建/更新 AGENTS.md，帮助 AI 更好理解项目。

**执行步骤：**
1. 读取项目配置（package.json、tsconfig.json 等）
2. 读取现有文档（README、CHANGELOG 等）
3. 查看目录结构和入口点
4. 检查测试和构建配置
5. 分析核心代码架构

**输出内容：**
- 项目概述（类型、功能、使用场景）
- 技术栈（语言、核心框架）
- 项目结构（目录表格）
- 开发命令（已验证可用）
- 核心架构（模块职责）
- 开发注意事项

**使用：**
```bash
/init    # 分析并创建/更新 AGENTS.md
```

---

## 输入队列（新特性）

AI 处理时可以继续输入，不会阻塞。输入自动加入队列，AI 完成后合并处理。

**使用示例：**

```bash
> 分析代码结构
[PROCESSING] You can continue typing...
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
      "allowedTools": ["read", "grep"],
      "argumentHint": "[files]"
    },
    "test": {
      "description": "运行测试",
      "promptTemplate": "运行测试并修复失败",
      "allowedTools": ["bash", "read", "edit"]
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
| `matcher.args` | 参数匹配 |
| `action` | `block` / `confirm` / `log` / `warn` |
| `message` | 提示消息 |

---

## 配置存储

### 全局配置

```
~/.spica/
├── settings.json       # 统一配置（providers, mcp, skills, hooks）
├── context.json        # 全局上下文缓存
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

---

## 常见问题

### Q: 如何查看历史消息？

```bash
/history    # 显示最近 10 条消息
```

### Q: 如何清空历史？

```bash
/clear          # 交互模式清空
spica --fresh   # 启动时清空
```

### Q: 会话如何保存？

- **自动加载**：启动时自动加载 `.spica/session.json`
- **自动保存**：每次 AI 处理完自动保存
- **智能压缩**：基于 token 数量自动压缩（目标 <60% 上下文窗口）
- **压缩策略**：保留最近 10 条消息，LLM 生成早期对话摘要
- **压缩动画**：压缩时显示进度（`[COMPRESS] 17 -> 11 messages (373k -> 120k tokens)`）

### Q: 如何切换模型？

```bash
spica providers set openai model gpt-4-turbo
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
[PROCESSING] You can continue typing...
> 任务2
> 任务3

[OK] Done
[QUEUE] Processing 2 inputs... (任务2 + 任务3)
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

---

## 设计理念

**spica 保持轻量：**
- 不替代 git 原生功能（worktree, merge 等）
- 灵活调用成熟工具（MCP, hooks）
- 专注 agent 核心功能

**配置简洁：**
- 一个 `settings.json` 包含所有配置
- 项目只需 `.spica/session.json`
- 遵循行业标准（AGENTS.md）