# Spica Storage Locations

## Overview

Spica uses two levels of storage:
1. **Global** (~/.spica/) - User-wide configuration and history
2. **Project** (<project>/.spica/) - Project-specific session and state

---

## Global Storage (~/.spica/)

```
~/.spica/
├── settings.json            # Main configuration file
├── history.json             # Command history
├── sessions/                # Archived sessions (by date)
│   └── 2026-01-01/
│       └── session-xxx.json
├── learnings/               # Global learnings (markdown)
│   └── 2026-01-01-xxx.md
├── backups/                 # File backups
│   └── xxx-backup.json
└── skills/                  # Skill packages
    ├── review/
    │   └── SKILL.md
    ├── debug/
    │   └── SKILL.md
    └── skills.json          # Skills registry
```

### settings.json

```json
{
  "defaultProvider": "deepseek",
  "providers": {
    "deepseek": {
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.deepseek.com/v1",
      "model": "deepseek-chat"
    },
    "openai": {
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4"
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
  "hooks": {
    "PreToolUse": [
      {
        "matcher": { "tool": "bash" },
        "action": "confirm",
        "message": "Confirm bash command?"
      }
    ],
    "PostToolUse": []
  },
  "skills": {
    "review": {
      "name": "review",
      "description": "Code review",
      "promptTemplate": "Review {input}"
    }
  }
}
```

### history.json

```json
{
  "commands": [
    "spica run fix bug",
    "spica list",
    "/help",
    "/status"
  ]
}
```

---

## Project Storage (<project>/.spica/)

```
<project>/.spica/
├── session.json             # Current session (messages)
├── sessions/                # Archived sessions
│   ├── session-abc123.json
│   └── session-def456.json
├── state.json               # Project state
├── context.json             # Project context
├── tasks.json               # Task persistence
├── checkpoints.json         # Checkpoint metadata
├── snapshots/               # Checkpoint file backups
│   ├── cp-xxx/
│   │   └── file.ts
│   └── cp-yyy/
│   │   └── config.json
├── skills/                  # Project-level skills
│   └── my-skill/
│       └── SKILL.md
├── skills.json              # Project skills config
├── hooks.json               # Project hooks config
├── learnings/               # Project learnings (markdown)
│   └── 2026-01-01-fix.md
└── backups/                 # File backups
```

### session.json

```json
{
  "messages": [
    { "role": "user", "content": "Fix the bug" },
    { "role": "assistant", "content": "..." },
    { "role": "tool", "name": "file_read", "content": "..." }
  ],
  "lastActivity": "2026-01-01T12:00:00Z"
}
```

### state.json

```json
{
  "phase": "development",
  "todos": [
    { "content": "Implement feature", "status": "in_progress" }
  ],
  "decisions": [
    { "content": "Use TypeScript", "reason": "Better type safety" }
  ]
}
```

### tasks.json

```json
{
  "tasks": [
    {
      "id": "task-1",
      "content": "Fix bug",
      "status": "completed",
      "createdAt": "2026-01-01T12:00:00Z",
      "completedAt": "2026-01-01T13:00:00Z"
    }
  ]
}
```

### checkpoints.json

```json
{
  "checkpoints": [
    {
      "id": "cp-xxx",
      "timestamp": "2026-01-01T12:00:00Z",
      "prompt": "Fix bug in auth",
      "filesBackedUp": ["src/auth.ts", "src/config.ts"]
    }
  ]
}
```

---

## Session Files

### Archived Sessions (sessions/)

Each archived session file contains:
```json
{
  "id": "session-abc123",
  "name": "Bug fix session",
  "messages": [...],
  "messageCount": 25,
  "lastActivity": "2026-01-01T12:00:00Z",
  "createdAt": "2026-01-01T10:00:00Z"
}
```

Commands:
- `/sessions` - List archived sessions
- `/switch <id>` - Switch to session
- `/rename <id> <name>` - Rename session
- `/delete <id>` - Delete session

---

## Checkpoint System

### Purpose

Checkpoint creates file snapshots before modifications:
- Allows recovery from unwanted changes
- Does not pollute git history
- Only backs up git-tracked files that changed

### Storage

- `checkpoints.json` - Metadata (id, timestamp, files list)
- `snapshots/<checkpoint-id>/` - Actual file backups

### Commands

- `/checkpoint` - List checkpoints
- `/checkpoint show <id>` - Show details
- `/checkpoint restore <id>` - Restore files
- `/checkpoint clean` - Remove old checkpoints

---

## Learnings

### Purpose

Learnings record important findings for future reference:
- Bug fixes and solutions
- Architecture decisions
- Code patterns
- User preferences

### Format (Markdown)

```markdown
---
name: fix-auth-bug
type: fix
---

## Problem
Auth module had timing issue...

## Solution
Added retry mechanism...

## How to Apply
Use similar retry pattern in other API calls...
```

---

## Hooks

### Purpose

Hooks intercept tool execution:
- **PreToolUse** - Before tool runs
- **PostToolUse** - After tool completes

### Actions

| Action | Description |
|--------|-------------|
| `none` | Allow execution |
| `log` | Log message |
| `warn` | Show warning |
| `confirm` | Ask user confirmation |
| `block` | Prevent execution |

### Config Format

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": {
          "tool": "bash",
          "args": { "command": "*rm*" }
        },
        "action": "confirm",
        "message": "Confirm deletion?"
      }
    ],
    "PostToolUse": [
      {
        "matcher": { "tool": "file_write" },
        "action": "log",
        "message": "File saved"
      }
    ]
  }
}
```

---

## Skills

### Location

- **Global skills**: `~/.spica/skills/<name>/SKILL.md`
- **Project skills**: `<project>/.spica/skills/<name>/SKILL.md`

### SKILL.md Format

```markdown
---
name: review
description: Code review for files
allowedTools: file_read, grep, glob
---

Review these files: {input}

Check for:
- Bugs and errors
- Code style issues
- Potential improvements
```

---

## Priority

1. Environment variables (highest)
2. CLI args (`-p/--provider`)
3. Global config (`~/.spica/settings.json`)

---

## Security

```bash
chmod 700 ~/.spica/
chmod 600 ~/.spica/settings.json
```

Add to `.gitignore`:
```
.spica/
```

---

## See Also

- [CONFIGURATION.md](CONFIGURATION.md) - Configuration options
- [MANUAL.md](MANUAL.md) - User commands
- [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture details