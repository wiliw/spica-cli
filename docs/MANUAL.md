# spica-cli User Manual

---

## Commands

### Provider

```bash
spica set <name> <url> <apiKey> <model>  # Add provider
spica use <name>                         # Switch default
spica list                               # List all
spica show [name]                        # Show details
spica remove <names...>                  # Remove
spica remove --all                       # Remove all
```

Example:
```bash
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica use deepseek
```

### Session

```bash
spica              # Start (auto-load history)
spica --fresh      # Fresh session
spica run "task"   # Single task
spica -p <name>    # Use specific provider
```

### Skills

```bash
spica skills list
spica skills install <url>
spica skills uninstall <name>
```

### MCP

```bash
spica mcp
spica mcp list
spica mcp tools
```

---

## Interactive Commands

| Command | Description |
|---------|-------------|
| `/help` | Help |
| `/clear` | Clear session |
| `/history` | Show messages |
| `/compact` | Compress context |
| `/bypass` | Auto-approve |
| `/strict` | Require permission |
| `/status` | Show status |
| `/skills` | List skills |
| `/init` | Generate AGENTS.md |
| `/queue` | Input queue |
| `/undo` | Undo queued input |

---

## Tools

| Category | Tools |
|----------|-------|
| File | read, write, edit, delete, copy, move, exists |
| Directory | create, list |
| Search | glob, grep |
| Shell | bash |
| Git | status, diff, log, add, commit, branch, checkout, push, pull |
| GitHub | gh |
| Web | search, fetch |
| Task | question, todo, task, workspace, lint, test |

---

## Bash Tool Modes

```json
// TTY mode
{ "command": "npm run dev", "tty": true }

// Detached (background)
{ "command": "npm run dev", "detached": true }

// Interactive (AI input/output)
{ "command": "npm run dev", "interactive": true, "inputs": ["hello", "exit"] }
```

---

## Config Location

```
~/.spica/settings.json     # Global (providers, mcp, skills, hooks)
<project>/.spica/session.json  # Session history
```

---

## Local Models

```bash
# llama.cpp
llama-server -m llama.gguf --port 8000
spica set local http://localhost:8000/v1 dummy llama

# Ollama
ollama serve
spica set local http://localhost:11434/v1 dummy llama3
```

---

## MCP Config

```json
{
  "mcp": {
    "servers": [
      { "name": "filesystem", "command": "npx", "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path"] }
    ]
  }
}
```

---

## Hooks Config

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": { "tool": "bash", "args": { "command": "*--force*" } }, "action": "block", "message": "Blocked" }
    ]
  }
}
```

---

## Skills Config

```json
{
  "skills": {
    "review": {
      "description": "Code review",
      "promptTemplate": "Review {files}",
      "allowedTools": ["file_read", "grep"]
    }
  }
}
```

---

## See Also

- [CONFIGURATION.md](CONFIGURATION.md) - Configuration guide
- [STORAGE.md](STORAGE.md) - Storage locations