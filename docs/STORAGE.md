# spica-cli Storage

---

## Global Config

**Path**: `~/.spica/settings.json`

```json
{
  "defaultProvider": "deepseek",
  "providers": {
    "deepseek": {
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.deepseek.com/v1",
      "model": "deepseek-chat"
    }
  },
  "mcp": { "servers": [] },
  "skills": {},
  "hooks": {}
}
```

---

## Project Config

**Path**: `<project>/.spica/`

```
.spica/
├── session.json    # Session history
└── tasks.json      # Task persistence
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