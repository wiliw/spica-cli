# AGENTS.md

## Project Overview
- **Type**: CLI tool
- **Purpose**: AI coding agent with three-step workflow (Think → Act → Respond), supporting multi-turn conversations, 33+ tools, and extensible skills system
- **Use case**: Developers who want an AI assistant to read/write/edit files, run shell commands, manage git, interact with GitHub, search web, and execute coding tasks

## Tech Stack
- **Language**: TypeScript (ES2022, ESM modules)
- **Runtime**: Node.js
- **Core dependencies**:
  - `commander` - CLI framework
  - `openai` - OpenAI API client
  - `node-pty` - PTY for interactive shell commands
  - `@modelcontextprotocol/sdk` - MCP protocol support
  - `execa` - Process execution
- **Dev tools**: `tsx`, `vitest`, `typescript`

## Project Structure

| Directory/File | Purpose |
|----------------|---------|
| `src/index.ts` | CLI entry point, command definitions, TUI setup |
| `src/agent.ts` | Core SpicaAgent class, main orchestration |
| `src/core/` | EventBus, StateManager, ErrorHandler, SessionManager, LogManager, ProcessMonitor, Heartbeat, RuntimeState |
| `src/tools/index.ts` | 33+ tool implementations (file, bash, git, web, etc.) |
| `src/tools/subAgent.ts` | Parallel subagent task execution |
| `src/llm/` | LLM client, providers (OpenAI, Anthropic, Local), rate limiter, token counter |
| `src/cli/` | CLI components (TUI, events, status, colors, commands) |
| `src/cli/ui/` | TUI components (screenManager, colors, queue) |
| `src/mcp/` | MCP (Model Context Protocol) client integration |
| `src/skills/` | Skills system for custom command templates |
| `src/hooks/` | Hooks system for tool call interception |
| `src/storage/` | Session and project state persistence |
| `src/prompts/` | System prompts for AI |
| `src/utils/` | Config, session, settings utilities |
| `src/builtin-skills/superpowers/` | 14 built-in superpowers skills |
| `src/llm/providers/` | LLM provider implementations (OpenAI, Anthropic, Local, OpenAICompatible) |
| `bin/spica` | CLI executable wrapper |
| `test/` | Manual test files |
| `docs/` | Documentation (MANUAL.md, CONFIGURATION.md, etc.) |

## Development Commands
- **Dev**: `npm run dev` or `tsx src/index.ts`
- **Build**: `npm run build:cli`
- **Test**: `npm test` (vitest watch mode)
- **Test run**: `npm run test:run` (single run) - **157 tests passing**
- **Type check**: `npx tsc --noEmit`

## Core Architecture

### Main Modules
1. **SpicaAgent** (`src/agent.ts`) - Central orchestrator managing LLM client, tools, permissions, and workflow
2. **Tools System** (`src/tools/index.ts`) - 33+ tools for file ops, shell, git, GitHub, web, etc.
3. **LLM Client** (`src/llm/`) - OpenAI-compatible client with rate limiting, streaming, and function calling
4. **CLI/TUI** (`src/cli/`) - Terminal UI with scroll regions, status bar, input handling

### Data Flow
User input → SpicaAgent.runLoop() → LLMClient (streaming) → Tool execution → Response → TUI output

### Key Design Patterns
- **EventEmitter pattern**: Agent emits events (stream, tool_call, tool_result, etc.) for UI updates
- **Plugin architecture**: Tools are self-contained, MCP allows external tool servers
- **Skills system**: User-defined prompt templates with restricted tool access
- **Hooks system**: Pre/Post tool use interception for security/logging

## Development Notes

### Code Style
- No comments unless explicitly requested
- Prefer concise, readable code
- Use TypeScript with `strict: false` (noImplicitAny: false)
- ESM modules with ES2022 target

### Key Files to Understand
- `src/index.ts` - All CLI commands and TUI setup (~1150 lines)
- `src/tools/index.ts` - All tool implementations (~1260 lines)
- `src/agent.ts` - Core agent logic with permission handling
- `src/cli/ui/screenManager.ts` - TUI with dynamic layout
- `src/prompts/system.ts` - System prompt with skill invocation rules

### Common Patterns
- Tools return `{ success: boolean, output?: string, error?: string }`
- Use `resolvePath()` for relative path resolution
- Permission checks before dangerous operations (file_delete, bash with rm -rf, etc.)
- AbortController for interruptible operations

### Testing
- Tests in `src/**/__tests__/` (16 test files, 157 tests)
- Run `npm run test:run` for single execution
- All tests passing ✓

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

| Provider | Context Window |
|----------|----------------|
| OpenAI (GPT-4o) | 128k |
| Anthropic (Claude-3) | 200k |
| GLM-5 | 200k |
| Local models | Varies |

## Current Status

### Completed
- ✅ Core architecture (80+ files)
- ✅ 33+ tools (file, bash, git, GitHub, web, etc.)
- ✅ Skills system with 14 built-in superpowers
- ✅ MCP protocol support
- ✅ Hooks system for security/logging
- ✅ Multi-provider support (OpenAI, Anthropic, Together, Groq, Local)
- ✅ Session persistence and compression
- ✅ TUI with scroll regions and status bar
- ✅ 157 tests passing

### Known Issues
- TUI not fully polished (per CURRENT-STATUS.md)
- Skills auto-invocation needs system prompt metadata injection
- Web search could be improved (DuckDuckGo HTML parsing or Tavily API)