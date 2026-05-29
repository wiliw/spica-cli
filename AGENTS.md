# AGENTS.md

## Project Overview
- **Type**: CLI tool
- **Purpose**: AI coding agent with multi-turn conversations, 24 tools, extensible skills system, and session persistence
- **Use case**: Developers who want an AI assistant to read/write/edit files, run shell commands, manage git, interact with GitHub, search web, and execute coding tasks

## Tech Stack
- **Language**: TypeScript (ES2022, ESM modules)
- **Runtime**: Node.js 18+
- **Core dependencies**:
  - `commander` - CLI framework
  - `openai` - OpenAI API client (supports multiple providers)
  - `node-pty` - PTY for interactive shell commands (requires native build tools)
  - `@modelcontextprotocol/sdk` - MCP protocol support
  - `execa` - Process execution
- **Dev tools**: `tsx`, `vitest`, `typescript`

## Setup Requirements
- Node.js 18+ required
- Native build tools may be needed for `node-pty` (Python, make, gcc/g++)
- API key setup: `spica providers set openai sk-your-key` or `export OPENAI_API_KEY=your-key`

## Project Structure

| Directory/File | Purpose |
|----------------|---------|
| `src/index.ts` | CLI entry point, command definitions, TUI setup (~1291 lines) |
| `src/agent.ts` | Core SpicaAgent class, main orchestration (~1062 lines) |
| `src/core/` | EventBus, StateManager, ErrorHandler, SessionManager, LogManager, ProcessMonitor, Heartbeat, RuntimeState |
| `src/tools/index.ts` | 24 tool implementations (file, bash, git, web, etc.) (~1854 lines) |
| `src/tools/subAgent.ts` | Parallel subagent task execution |
| `src/llm/` | LLM client, providers (OpenAI, Anthropic, Local), rate limiter, token counter |
| `src/cli/` | CLI components (TUI, events, status, colors, commands) |
| `src/cli/ui/` | TUI components (screenManager, colors, queue, input) |
| `src/mcp/` | MCP (Model Context Protocol) client integration |
| `src/skills/` | Skills system for custom command templates |
| `src/hooks/` | Hooks system for tool call interception |
| `src/storage/` | Session and project state persistence |
| `src/prompts/` | System prompts for AI |
| `src/utils/` | Config, session, settings utilities |
| `src/builtin-skills/superpowers/` | 14 built-in superpowers skills |
| `bin/spica` | CLI executable wrapper |
| `docs/` | Documentation (MANUAL.md, CONFIGURATION.md, etc.) |

## Development Commands
- **Dev**: `npm run dev` or `tsx src/index.ts`
- **Build**: `npm run build` (creates bin/spica executable wrapper)
- **Test**: `npm test` (vitest watch mode)
- **Test run**: `npm run test:run` (single run) - **273/274 tests passing** (1 flaky: ProcessMonitor.test.ts)
- **Test single file**: `npx vitest run <file-pattern>`
- **Type check**: `npx tsc --noEmit`
- **Lint**: `npm run lint` (ESLint)
- **Lint fix**: `npm run lint:fix`
- **Global install**: `npm link` (after build)

## Core Architecture

### Main Modules
1. **SpicaAgent** (`src/agent.ts`) - Central orchestrator managing LLM client, tools, permissions, todos, and workflow
2. **Tools System** (`src/tools/index.ts`) - 24 tools for file ops, shell, git, GitHub, web, etc.
3. **LLM Client** (`src/llm/`) - OpenAI-compatible client with rate limiting, streaming, and function calling
4. **CLI/TUI** (`src/cli/`) - Terminal UI with scroll regions, status bar, input handling

### Data Flow
User input → SpicaAgent.runLoop() → LLMClient (streaming) → Tool execution → Response → TUI output

### Key Design Patterns
- **EventEmitter pattern**: Agent emits events (stream, tool_call, tool_result, etc.) for UI updates
- **Plugin architecture**: Tools are self-contained, MCP allows external tool servers
- **Skills system**: User-defined prompt templates with restricted tool access
- **Hooks system**: Pre/Post tool use interception for security/logging

### 24 Tools
| Category | Tools |
|----------|-------|
| File | `file_read`, `file_write`, `file_edit`, `file_multi_edit`, `file_exists`, `file_delete`, `file_copy`, `file_move` |
| Directory | `directory_create`, `directory_list` |
| Search | `glob`, `grep` |
| Shell | `bash` |
| Git | `git` |
| GitHub | `gh` |
| Web | `web_search`, `web_fetch` |
| Other | `question`, `todo_write`, `todo_read`, `task`, `workspace`, `lint`, `test` |

## Development Notes

### Code Style
- No comments unless explicitly requested
- Prefer concise, readable code
- TypeScript with `strict: true` but `noImplicitAny: false`
- ESM modules with ES2022 target
- Test files use vitest globals (describe, it, expect, beforeEach, etc.)

### Key Files to Understand
- `src/index.ts` - All CLI commands and TUI setup (~1291 lines)
- `src/tools/index.ts` - All tool implementations (~1854 lines)
- `src/agent.ts` - Core agent logic with permission handling (~1062 lines)
- `src/cli/ui/screenManager.ts` - TUI with dynamic layout
- `src/prompts/system.ts` - System prompt with skill invocation rules

### Common Patterns
- Tools return `{ success: boolean, output?: string, error?: string, diff?: string, syntaxErrors?: string[], content?: string }`
  - `output`: Short summary for TUI display
  - `content`: Full content for LLM processing (e.g., file contents)
- Use `resolvePath()` for relative path resolution
- Permission checks before dangerous operations (file_delete, bash with rm -rf, etc.)
- AbortController for interruptible operations
- Session persistence in `.spica/session.json`

### Testing
- Tests in `src/**/__tests__/` (15 test files, 274 tests)
- Run `npm run test:run` for single execution
- Key test files:
  - `src/core/__tests__/EventBus.test.ts` - Event system tests
  - `src/core/__tests__/SessionManager.test.ts` - Session persistence tests
  - `src/hooks/__tests__/hooks.test.ts` - Hooks tests
  - `src/skills/__tests__/skills.test.ts` - Skills tests

## Built-in Skills (14 superpowers)

| Skill | Trigger |
|-------|---------|
| `brainstorming` | Before any creative work |
| `writing-plans` | Multi-step task before coding |
| `test-driven-development` | Before writing implementation |
| `systematic-debugging` | Any bug or test failure |
| `subagent-driven-development` | Executing plans with parallel tasks |
| `dispatching-parallel-agents` | 2+ independent tasks without shared state |
| `executing-plans` | Executing implementation plans with checkpoints |
| `finishing-a-development-branch` | Work complete, deciding integration approach |
| `receiving-code-review` | Before implementing review feedback |
| `requesting-code-review` | Before merging to verify work |
| `using-git-worktrees` | Starting feature work needing isolation |
| `using-superpowers` | At session start (bootstrap) |
| `verification-before-completion` | Before claiming work is complete |
| `writing-skills` | Creating/editing skills |

## Model Support

| Provider | Default Model | Context Window |
|----------|---------------|----------------|
| OpenAI | gpt-4 | 128k |
| Anthropic | claude-3-opus | 200k |
| Together | llama-3-70b | Varies |
| Groq | llama-3-70b | Varies |
| Local | llama-3 | Varies |

## Configuration Files
- `~/.spica/config.json` - API keys and provider settings
- `~/.spica/skills.json` - Custom skills
- `~/.spica/mcp.json` - MCP server configurations
- `~/.spica/hooks.json` - Hook rules
- `<project>/.spica/` - Project-specific session and state