# spica-cli 存储位置

本文档详细说明所有配置文件和存储位置。

---

## 目录结构

### 全局目录

**路径**: `~/.spica/` (即 `/home/<user>/.spica/`)

```
~/.spica/
├── settings.json       # 主配置文件（包含 providers, mcp, skills, hooks）
└── installed-skills/   # 已安装的skill包目录（可选）
    └── package-name/    # 每个skill包的目录
```

**settings.json 包含所有全局配置：**

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "name": "OpenAI",
      "apiKey": "sk-xxx...",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4"
    }
  },
  "mcp": {
    "servers": [
      { "name": "filesystem", "command": "npx", "args": [...] }
    ]
  },
  "skills": {
    "search": {
      "description": "快速搜索",
      "promptTemplate": "搜索: {query}",
      "allowedTools": ["glob", "grep"]
    }
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": { "tool": "bash", "args": { "command": "*--force*" } }, "action": "block", "message": "禁止 --force" }
    ]
  }
}
```

### 项目目录

**路径**: `<project-root>/.spica/`

```
<project>/.spica/
├── session.json         # 会话状态（消息历史、todos、decisions）
├── skills.json          # 项目特定 skills（可选，覆盖全局）
└── hooks.json           # 项目特定 hooks（可选，追加全局）
```

**项目配置原则：**
- 全局 `settings.json` 包含所有通用配置，所有项目生效
- 项目 `.spica/` 只放项目特定信息
- 项目 `skills.json` **覆盖** 全局 skills
- 项目 `hooks.json` **追加** 全局 hooks

### 项目描述文件

**位置**: `<project-root>/AGENTS.md`（行业标准格式）

---

## 文件详解

### settings.json

**位置**: `~/.spica/settings.json`

**用途**: 统一的全局配置文件

**格式**:
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
      "apiKey": "dummy-key",
      "baseUrl": "http://localhost:8000/v1",
      "model": "llama-3"
    }
  },
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path"],
        "env": {},
        "disabled": false
      }
    ]
  },
  "skills": {
    "review": {
      "description": "代码审查",
      "promptTemplate": "审查以下代码：{files}",
      "allowedTools": ["file_read", "grep", "lint"]
    }
  },
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

### session.json

**位置**: `<project>/.spica/session.json`

**用途**: 存储会话消息历史和项目状态

**格式**:
```json
{
  "workspacePath": "/path/to/project",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "...", "toolCalls": [...] },
    { "role": "tool", "content": "...", "toolCallId": "..." }
  ],
  "todos": [
    { "content": "完成功能A", "status": "completed" },
    { "content": "修复bug B", "status": "in_progress" }
  ],
  "decisions": [
    "使用React作为前端框架",
    "选择SQLite作为数据库"
  ],
  "lastActivity": "2026-05-14T12:00:00Z",
  "recentFiles": ["src/index.ts", "src/utils/helper.ts"]
}
```

---

### skills.json（项目）

**位置**: `<project>/.spica/skills.json`

**用途**: 项目特定 skills 定义（覆盖全局）

**格式**:
```json
{
  "skills": {
    "review": {
      "description": "代码审查",
      "promptTemplate": "审查以下代码：{files}",
      "allowedTools": ["file_read", "grep", "lint"],
      "autoInvoke": false,
      "paths": ["src/**/*.ts"]
    }
  }
}
```

---

### hooks.json（项目）

**位置**: `<project>/.spica/hooks.json`

**用途**: 项目特定 hooks 规则（追加全局）

**格式**:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": {
          "tool": "file_*",
          "args": { "path": "*.env*" }
        },
        "action": "confirm",
        "message": "确认修改环境文件？"
      }
    ]
  }
}
```

---

### AGENTS.md（项目描述文件）

**位置**: `<project-root>/AGENTS.md`

**用途**: 项目描述文件，帮助AI理解项目（行业标准格式）

**格式**:
```markdown
# AGENTS.md

## Project
- Type: Node.js
- Language: TypeScript
- Framework: Express

## Dev environment
- Start: `npm run dev`

## Build
- Build: `npm run build`

## Testing
- Test: `npm test`
- Run tests before committing

## Code style
- No comments unless asked

## Constraints
- Use Vitest for testing
```

**自动生成**: 首次启动时根据项目类型自动检测生成 `AGENTS.md`。

---

## 配置优先级

优先级从高到低：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | 环境变量 | `OPENAI_API_KEY`, `SPICA_*` |
| 2 | 命令行参数 | `-p/--provider`, `--model` |
| 3 | 项目配置 | `.spica/skills.json`, `.spica/hooks.json` |
| 4 | 全局配置 | `~/.spica/settings.json` |
| 5 | 内置默认值 | BUILTIN_PROVIDERS |

**合并规则：**
- Providers: 全局 + 环境变量覆盖
- MCP: 全局生效
- Skills: 项目覆盖全局
- Hooks: 项目追加全局

---

## 安全性

### 文件权限

```bash
# 配置文件
chmod 600 ~/.spica/settings.json

# 配置目录
chmod 700 ~/.spica/
```

### Git忽略

确保 `.gitignore` 包含：

```
.spica/
*.env
```

### API密钥安全

- 密钥存储在本地文件，不传输到服务器
- 只有在API请求时才使用密钥
- 建议使用环境变量而非配置文件（更安全）

---

## 命令管理

### 查看配置

```bash
# 查看所有 providers
spica providers

# 查看 MCP 状态
spica mcp

# 查看 Skills
spica skills
```

### 清空配置

```bash
# 清空全局配置
rm -rf ~/.spica/

# 清空项目配置
rm -rf .spica/

# 只清空会话
rm .spica/session.json
```

### 备份配置

```bash
# 备份全局配置
cp -r ~/.spica/ ~/.spica.backup/

# 备份项目配置
cp -r .spica/ .spica.backup/
```

---

## 调试信息

查看实际加载的配置：

```bash
# 在交互模式中
/status
```

输出：
```
Current Status:
  Permission mode: STRICT (ask user)
  Messages in context: 12
  Workspace: /path/to/project
  Provider: openai
  Model: gpt-4
```