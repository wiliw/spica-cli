# spica-cli

```
              _)              
   __|  __ \   |   __|   _` | 
 \__ \  |   |  |  (     (   | 
 ____/  .__/  _| \___| \__,_| 
       _|                     
```

A command-line tool for coding with LLMs. Works with any OpenAI-compatible API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/zison/spica-cli?style=social)](https://github.com/zison/spica-cli/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/zison/spica-cli)](https://github.com/zison/spica-cli/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/zison/spica-cli)](https://github.com/zison/spica-cli/commits)
[![Code Size](https://img.shields.io/github/languages/code-size/zison/spica-cli)](https://github.com/zison/spica-cli)

**English** | [中文](README_CN.md)

## Installation

```bash
npm install -g spica-cli
```

Or build from source:

```bash
git clone https://github.com/zison/spica-cli
cd spica-cli
npm install
npm run build
```

## Usage

```bash
# Configure a provider
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat

# Use a provider
spica use deepseek

# Start interactive mode
spica

# Run a single task
spica run "fix the bug in src/index.ts"
```

## Features

- **33 built-in tools**: file read/write/edit, bash, grep, glob, git, web fetch, etc.
- **Tool conflict detection**: automatically handles concurrent file operations
- **Auto-retry**: commands retry in background on timeout
- **Syntax validation**: automatic check for TS/JS/Python/Go/Rust/Shell
- **Code quality analysis**: cyclomatic complexity, nesting depth, function length
- **Test quality check**: detects over-mocking, happy-path-only tests
- **MCP support**: extend with external tools via Model Context Protocol
- **Context compression**: reduces token usage for long conversations

## Tools

### File Operations
`file_read` `file_write` `file_edit` `file_multi_edit` `file_replace` `file_insert` `file_delete` `file_copy` `file_move` `file_exists` `file_patch`

### Search
`glob` `grep` `directory_list`

### Shell & Git
`bash` `git`

### Code Quality
`code_health` `test_quality_check` `lint` `test`

### Web
`web_search` `web_fetch` `gh`

### Task Management
`todo` `task` `workspace` `question`

## Interactive Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear session history |
| `/compact` | Compress context |
| `/bypass` | Auto-approve operations |
| `/strict` | Require confirmation |
| `/init` | Generate AGENTS.md |

## Configuration

```
~/.spica/settings.json    # Global config
<project>/.spica/         # Project session
```

## Development

```bash
npm run dev      # Development mode
npm run build    # Build CLI
npm test         # Run tests
npm run lint     # Lint check
```

## Documentation

- [MANUAL.md](docs/MANUAL.md) - Complete user manual
- [CONTRIBUTING.md](docs/CONTRIBUTING.md) - Contributing guide

## License

MIT