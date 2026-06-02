# AGENTS.md

## Project Overview
- **Type**: CLI tool
- **Purpose**: AI coding agent with multi-turn conversations, 25 tools, extensible skills system, and session persistence
- **Use case**: Developers who want an AI assistant to read/write/edit files, run shell commands, manage git, interact with GitHub, search web, and execute coding tasks

## Tech Stack
- **Language**: TypeScript (ES2022, ESM modules)
- **Runtime**: Node.js 18+
- **Core dependencies**:
  - `commander` — CLI framework
  - `openai` — OpenAI API client (supports multiple providers)
  - `node-pty` — PTY for interactive shell commands (requires native build tools)
  - `@modelcontextprotocol/sdk` — MCP protocol support
  - `execa` — Process execution
- **Dev tools**: `tsx`, `vitest`, `typescript`, `eslint`

## Setup Requirements
- Node.js 18+ required
- Native build tools may be needed for `node-pty` (Python, make, gcc/g++)
- API key setup: `spica providers set openai sk-your-key` or `export OPENAI_API_KEY=your-key`

## Project Structure

| Directory/File | Purpose |
|----------------|---------|
| `src/index.ts` | CLI entry point, command definitions, TUI setup, input loop |
| `src/agent.ts` | Core SpicaAgent class — main orchestration, permission handling, event emission |
| `src/core/` | EventBus, RuntimeState |
| `src/tools/index.ts` | 25 tool implementations (file, bash, git, web, etc.) + tool definitions |
| `src/tools/subAgent.ts` | Parallel subagent task execution |
| `src/llm/` | LLM client, FunctionCaller, RateLimiter, TokenCounter, provider implementations |
| `src/llm/providers/` | OpenAI, Anthropic, OpenAICompatible, Local, BaseProvider |
| `src/cli/` | CLI components: events, init, queueDrain, skillGate, status, TUI |
| `src/cli/ui/` | TUI components: screenManager, colors, diff, fixedBox, input, queue, stringWidth, tuiInput |
| `src/mcp/` | MCP (Model Context Protocol) client integration |
| `src/skills/` | Skills system — install, uninstall, list, parse, build prompts |
| `src/hooks/` | Hooks system — Pre/Post tool call interception |
| `src/storage/` | Project state and task persistence |
| `src/prompts/` | System prompts for AI |
| `src/utils/` | Config, session, settings, history, logger, projectConfig |
| `src/external/` | Reserved for external integrations (currently empty) |
| `src/builtin-skills/superpowers/` | 14 built-in superpowers skills |
| `src/__tests__/` | Test files (22 test files, 272 tests) |
| `bin/spica` | CLI executable wrapper |
| `docs/` | Documentation (MANUAL.md, CONFIGURATION.md, ARCHITECTURE.md, etc.) |

## Development Commands
- **Dev**: `npm run dev` (runs `tsx src/index.ts`)
- **Build**: `npm run build` (creates `bin/spica` executable)
- **Test (watch)**: `npm test` (vitest watch mode)
- **Test (single run)**: `npm run test:run` — **272 tests, all passing**
- **Test single file**: `npx vitest run <file-pattern>`
- **Type check**: `npx tsc --noEmit`
- **Lint**: `npm run lint` (ESLint)
- **Lint fix**: `npm run lint:fix`
- **Lint strict**: `npm run lint:strict` (ESLint with --max-warnings 0)
- **Global install**: `npm link` (after build)

## Core Architecture

### Main Modules
1. **SpicaAgent** (`src/agent.ts`) — Central orchestrator managing LLM client, tools, permissions, todos, and workflow loop
2. **Tools System** (`src/tools/index.ts`) — 25 tools for file ops, shell, git, GitHub, web, search, skills; returns `{ success, output?, error?, diff?, syntaxErrors?, content? }`
3. **LLM Client** (`src/llm/`) — OpenAI-compatible client with streaming, function calling, rate limiting, and multi-provider support
4. **CLI/TUI** (`src/cli/`) — Terminal UI with scroll regions, status bar, input handling, queue management

### Data Flow
User input → SpicaAgent.runLoop() → LLMClient (streaming) → Tool execution → Response → TUI output

### Key Design Patterns
- **EventEmitter pattern**: Agent emits events (`stream`, `tool_call`, `tool_result`, etc.) consumed by TUI for updates
- **Plugin architecture**: Tools are self-contained; MCP allows external tool servers
- **Skills system**: User-defined prompt templates with restricted tool access
- **Skill chain enforcement**: When a skill's content references another skill by name, `REQUIRED_SKILL` messages are automatically injected to force the agent to invoke the referenced skill. Implemented in `src/agent.ts` (injection logic) and `src/prompts/system.ts` (SKILL CHAIN RULE). Tested in `src/__tests__/skillChain.test.ts`.
- **Hooks system**: Pre/Post tool use interception for security/logging
- **Queue auto-drain**: After processing completes, `autoDrainQueue()` in `src/cli/queueDrain.ts` checks for queued input and automatically processes it (no need to send an extra message)

### 25 Tools
| Category | Tools |
|----------|-------|
| File | `file_read`, `file_write`, `file_edit`, `file_multi_edit`, `file_exists`, `file_delete`, `file_copy`, `file_move` |
| Directory | `directory_create`, `directory_list` |
| Search | `glob`, `grep` |
| Shell | `bash` |
| Git | `git` |
| GitHub | `gh` |
| Web | `web_search`, `web_fetch` |
| Skill | `skill` |
| Other | `question`, `todo_write`, `todo_read`, `task`, `workspace`, `lint`, `test` |

## Development Notes

### Code Style
- No comments unless explicitly requested
- Prefer concise, readable code
- TypeScript with `strict: true` but `noImplicitAny: false`
- ESM modules with ES2022 target
- Test files use vitest globals (`describe`, `it`, `expect`, `beforeEach`, etc.)
- ESLint: `prefer-const`, `no-var`, unused vars error (with `_` prefix ignore)

### Key Files to Understand
- `src/index.ts` — All CLI commands and TUI setup
- `src/tools/index.ts` — All tool implementations and TOOLS_DEFINITIONS
- `src/agent.ts` — Core agent logic with permission handling
- `src/cli/ui/screenManager.ts` — TUI with dynamic layout
- `src/prompts/system.ts` — System prompt with skill invocation rules
- `src/cli/queueDrain.ts` — Auto-drains queued input after processing completes
- `src/utils/settings.ts` — Unified configuration management

### Common Patterns
- Tool results: `{ success: boolean, output?: string, error?: string, diff?: string, syntaxErrors?: string[], content?: string }`
  - `output`: Short summary for TUI display
  - `content`: Full content for LLM processing (e.g., file contents)
- Use `resolvePath()` for relative path resolution
- Permission checks before dangerous operations (file_delete, bash with rm -rf, etc.)
- AbortController for interruptible operations
- Session persistence in `.spica/session.json`

### Testing
- Tests in `src/**/__tests__/` (22 test files, 272 tests, all passing)
- Run `npm run test:run` for single execution, `npx vitest run <pattern>` for a single file
- Key test files:
  - `src/core/__tests__/EventBus.test.ts` — Event system tests
  - `src/hooks/__tests__/hooks.test.ts` — Hooks tests
  - `src/skills/__tests__/skills.test.ts` — Skills tests
  - `src/__tests__/compression.test.ts` — Context compression tests (12 tests)
  - `src/__tests__/queueDrain.test.ts` — Queue auto-drain tests
  - `src/__tests__/agent.test.ts` — Core agent workflow tests
  - `src/__tests__/tools.test.ts` — Tool implementation tests
  - `src/__tests__/skillChain.test.ts` — Skill chain enforcement tests (7 tests)
- Coverage: `npx vitest run --coverage` (v8 provider)

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