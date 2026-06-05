# spica-cli

**AI Coding Agent CLI** - A powerful, self-improving coding agent with intelligent tool orchestration, automatic retry mechanisms, and code quality analysis.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/spica-cli)](https://nodejs.org)

---

## ✨ Unique Features

### 🔧 Intelligent Tool Orchestration
- **Automatic Conflict Detection**: Detects file/resource conflicts and executes tools in proper order (parallel vs sequential)
- **Auto-Retry Mechanism**: Bash/Test commands automatically retry in detached mode when timeout occurs
- **Interrupt Recovery**: Graceful interrupt handling with state preservation

### 📊 Code Quality Analysis (Industry-Standard)
Based on Martin Fowler's "Maintainability sensors for coding agents" and academic research:

| Tool | Purpose | Thresholds |
|------|---------|------------|
| `code_health` | Detect complexity, nesting, length issues | Score ≥ 9.5 for AI-friendly code |
| `test_quality_check` | Detect test anti-patterns (over-mocking, happy-path-only) | Score ≥ 7.0 |

### 🛡️ Safety Features
- **Syntax Auto-Check**: Automatic syntax validation for TS/JS/Python/Go/Rust/Shell
- **Shell Injection Detection**: Blocks dangerous command patterns
- **Permission Modes**: Strict/Bypass modes for different security needs

### 🚀 Performance Optimizations
- **Context Compression**: Smart message compression to maximize token usage
- **Token-Aware**: Real-time token counting and warnings
- **Progress Reporting**: Live progress updates for long-running operations

---

## Quick Start

```bash
# Install
npm install

# Build
npm run build

# Configure provider
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica use deepseek

# Run
spica              # Interactive mode
spica run "task"   # Single task mode
```

---

## Commands

| Command | Description |
|---------|-------------|
| `spica` | Start interactive TUI mode |
| `spica run <request>` | Execute single task |
| `spica set <name> <url> <key> <model>` | Add LLM provider |
| `spica use <name>` | Switch active provider |
| `spica list` | List all providers |
| `spica show [name]` | Show provider details |
| `spica remove <names...>` | Remove providers |
| `spica -p <name>` | Use specific provider for one session |

---

## 🛠️ Tools

### File Operations
| Tool | Description |
|------|-------------|
| `file_read` | Read file (required before write/edit) |
| `file_write` | Create/overwrite file with syntax check |
| `file_edit` | Exact text replacement with syntax check |
| `file_multi_edit` | Multiple edits at once |
| `file_replace` | Regex-based replacement |
| `file_insert` | Insert at specific line |
| `file_delete` | Delete file or directory |
| `file_copy` / `file_move` | Copy/move files |
| `file_exists` | Check path existence |

### Code Quality (NEW)
| Tool | Description |
|------|-------------|
| `code_health` | Analyze code maintainability (complexity, nesting, length) |
| `test_quality_check` | Detect test anti-patterns (TST-004, TST-005, TST-008) |
| `lint` | Run project linter (auto-detects tsc, eslint, golangci-lint, etc.) |
| `test` | Run tests with auto-retry (auto-detects vitest, pytest, go test, etc.) |

### Search & Shell
| Tool | Description |
|------|-------------|
| `glob` | Find files by pattern |
| `grep` | Search text patterns in files |
| `bash` | Run shell commands (auto-retry on timeout) |
| `git` | Git operations |

### Web & GitHub
| Tool | Description |
|------|-------------|
| `web_search` | Search web (DuckDuckGo/Tavily) |
| `web_fetch` | Fetch URL content |
| `gh` | GitHub CLI operations |

### Task Management
| Tool | Description |
|------|-------------|
| `todo` | Task tracking with persistence |
| `task` | Parallel subagent execution |
| `workspace` | Get/switch workspace |
| `question` | Ask user for clarification |

---

## Interactive Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear session history |
| `/history` | Show message history |
| `/compact` | Compress context to save tokens |
| `/bypass` | Auto-approve all operations |
| `/strict` | Require confirmation for risky operations |
| `/status` | Show current status |
| `/skills` | List available skills |
| `/init` | Generate AGENTS.md for project |

---

## 📖 Code Quality Standards

### code_health Thresholds (Martin Fowler's Recommendations)

| Metric | Threshold | Reason |
|--------|-----------|--------|
| Cyclomatic Complexity | ≤ 10 | McCabe complexity for AI readability |
| Nesting Depth | ≤ 4 | Deep nesting is hard to trace |
| Function Length | ≤ 50 lines | Long functions hide intent |
| File Length | ≤ 200 lines | Long files are hard to navigate |
| Parameters | ≤ 5 | Many parameters = confusing |

### test_quality_check Anti-Patterns (Research-Based)

| Pattern | ID | Problem |
|---------|-----|---------|
| Over-mocking | TST-004 | Mocks > 70% of calls = fake test |
| Happy-path-only | TST-005 | No error case tests = incomplete |
| Assertion-free | TST-008 | No assertions = useless test |
| Incomplete mock | TST-006 | Mock returns partial data |
| Test-only method | TST-007 | Production code pollution |

---

## Configuration

```
~/.spica/settings.json  # Global config (providers, MCP, skills, hooks)
<project>/.spica/       # Project session & tasks
```

---

## Development

```bash
npm run dev      # Development mode
npm run build    # Build CLI
npm test         # Run tests
npm run lint     # Run linter
```

---

## 📚 Documentation

- [MANUAL.md](docs/MANUAL.md) - Complete user manual
- [CONFIGURATION.md](docs/CONFIGURATION.md) - Configuration guide
- [SPEC-GAP-ANALYSIS.md](docs/SPEC-GAP-ANALYSIS.md) - Design analysis

---

## 🔗 Related Projects

- [Claude Code](https://github.com/anthropics/claude-code) - Anthropic's CLI
- [Aider](https://github.com/aider-ai/aider) - AI pair programming
- [OpenHands](https://github.com/All-Hands-AI/OpenHands) - Autonomous AI developer

---

## Keywords

`ai-coding-agent` `cli-tool` `code-quality` `test-quality` `automatic-retry` `llm-agent` `developer-tools` `code-analysis` `maintainability` `coding-assistant`

---

## License

MIT