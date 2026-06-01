# spica-cli

AI coding agent CLI.

---

## Quick Start

```bash
npm install
npm run build

# Configure provider
spica set <name> <url> <apiKey> <model>
spica use <name>

# Example
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica use deepseek

# Run
spica              # Interactive mode
spica run "task"   # Single task
```

---

## Commands

| Command | Description |
|---------|-------------|
| `spica` | Start interactive mode |
| `spica run <request>` | Execute single task |
| `spica set <name> <url> <key> <model>` | Add provider |
| `spica use <name>` | Switch provider |
| `spica list` | List providers |
| `spica show [name]` | Show provider details |
| `spica remove <names...>` | Remove providers |
| `spica -p <name>` | Use specific provider |

---

## Tools

File: read, write, edit, delete, copy, move, exists
Directory: create, list
Search: glob, grep
Shell: bash
Git: status, diff, log, add, commit, branch, checkout, push, pull
GitHub: gh
Web: search, fetch
Task: question, todo, task, workspace, lint, test

---

## Interactive Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/clear` | Clear session |
| `/history` | Show messages |
| `/compact` | Compress context |
| `/bypass` | Auto-approve mode |
| `/strict` | Permission mode |
| `/status` | Show status |
| `/skills` | List skills |
| `/init` | Generate AGENTS.md |

---

## Config Location

```
~/.spica/settings.json  # Global config (providers, mcp, skills, hooks)
<project>/.spica/       # Project session
```

---

## Environment Variables

```bash
export OPENAI_API_KEY=sk-xxx
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-4o
```

---

## Development

```bash
npm run dev      # Development
npm run build    # Build
npm test         # Test
```

---

## Docs

- [MANUAL.md](docs/MANUAL.md) - User manual
- [CONFIGURATION.md](docs/CONFIGURATION.md) - Configuration

---

## License

MIT