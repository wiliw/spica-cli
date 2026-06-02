# AGENTS.md

## Project Overview

- **Type**: CLI tool (Node.js, ESM)
- **Purpose**: AI coding agent with three-step workflow (analyze → plan → execute). Runs in interactive TUI mode or single-task `run` mode.
- **Users**: Developers using spica as an AI pair programmer in the terminal.

## Tech Stack

- **Language**: TypeScript 5.x (strict mode, ES2022 target)
- **Runtime**: Node.js 20+
- **Key dependencies**: `commander` (CLI), `openai` (LLM API), `execa` (shell), `simple-git`, `node-pty` (TTY)
- **Test**: Vitest 1.6, 25 test files, 182 tests
- **Lint**: ESLint (typescript-eslint)

## Project Structure

| Directory/File | Purpose |
|----------------|---------|
| `src/index.ts` | CLI entry, Commander commands, interactive REPL, input queue |
| `src/agent.ts` | Core agent loop, compression, permissions, interrupt handling |
| `src/llm/` | LLMClient, providers (OpenAI-compatible), TokenCounter, RateLimiter |
| `src/tools/index.ts` | 24+ built-in tool definitions and execution |
| `src/tools/subAgent.ts` | Parallel sub-agent spawning (max 3) |
| `src/cli/` | UI layer: events, status, screenManager, colors, diff |
| `src/cli/ui/queue.ts` | Non-blocking input queue during AI processing |
| `src/core/RuntimeState.ts` | Unified runtime state (replaces scattered globals) |
| `src/storage/` | Persistence: projectState, checkpoint |
| `src/mcp/client.ts` | MCP protocol client (stdio + SSE transports) |
| `src/skills/index.ts` | 14 built-in superpowers skills, dynamic skill management |
| `src/hooks/index.ts` | Pre/post tool hooks for interception and logging |
| `src/utils/settings.ts` | Unified config in `~/.spica/settings.json` |
| `src/utils/messageCleaner.ts` | Shared message cleanup for compression |
| `src/prompts/system.ts` | System prompt (English) |
| `bin/spica` | Built executable entry point |

## Development Commands

```bash
npm run dev              # Development mode (tsx)
npm run build            # Build executable → bin/spica
npm run test:run         # Run all tests once (182 tests, 25 files)
npx vitest run <pattern> # Run specific test file
npx vitest run -t "<name>" # Run specific test
npx tsc --noEmit         # Type check (must pass)
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run lint:strict      # ESLint with zero warnings
./bin/spica --version    # Verify build
```

## Core Architecture

**Data flow**: User input → `SpicaAgent.runLoop()` → `LLMClient.generate()` → parse `tool_calls` → `executeTool()` → results back to LLM → final response.

Three layers:
```
Presentation (cli/) → Business (agent, tools/) → Infrastructure (llm/, mcp/, storage/)
```

### SpicaAgent (`src/agent.ts`)

EventEmitter-based orchestrator. Key methods:
- `init()` — Initialize LLM, MCP, project config (idempotent via `_initPromise`)
- `runLoop(prompt)` — Main execution loop with pre-compression check
- `compact()` — Token-based context compression (trigger at >60% context window or >20 messages)
- `interrupt()` — Abort current LLM call and tool execution via `InterruptError`

Key designs:
- **InterruptError**: Thrown on user interrupt. `callLLMWithRetry` catches it and re-throws without retry.
- **ContextWindow**: Dynamically adjusted per provider (GPT-4o 128K, GLM-5 200K, Claude-3 200K).
- **Permission queue**: Sequential confirmation for dangerous operations. Detects `sudo`, `doas`, `run0`, `su`, `pkexec`.
- **maxRetries: 0** on provider — spica manages retry internally via `callLLMWithRetry` (10 retries, exponential backoff).

### LLMClient (`src/llm/`)

- OpenAI-compatible streaming with AbortController for interrupt
- Rate limiting with interruptible sleep
- Temperature: 0.3
- TokenCounter: CJK-aware estimation (CJK chars ≈1.5 tokens, code-heavy content ≈0.7× chars)

### Tools (`src/tools/index.ts`)

`executeTool()` is the main dispatcher. Tools return `{ success, output?, error?, diff?, syntaxErrors? }`. Shell commands use array-based `execa` to prevent injection.
- `ToolResult.content` — for structured content (e.g., file read output)

## Built-in Tools

| Category | Tools |
|----------|-------|
| File | `file_read`, `file_write`, `file_edit`, `file_multi_edit`, `file_exists`, `file_delete`, `file_copy`, `file_move`, `file_patch` |
| Directory | `directory_create`, `directory_list` |
| Search | `glob`, `grep` |
| Shell | `bash` (timeout, tty, detached, interactive modes) |
| Git | `git` (status, diff, log, add, commit, branch, checkout, push, pull, reset, stash) |
| GitHub | `gh` (pr_view, pr_list, issue_list, etc.) |
| Web | `web_search`, `web_fetch` |
| Task | `task` (sub-agents, max 3), `question`, `todo_write`, `todo_read`, `workspace` |
| Quality | `lint`, `test` (auto-detect framework), `format` |
| Skills | `skill` (invoke built-in skills) |

## Built-in Skills (14)

`brainstorming`, `writing-plans`, `writing-skills`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `subagent-driven-development`, `dispatching-parallel-agents`, `using-git-worktrees`, `executing-plans`, `finishing-a-development-branch`, `using-superpowers`

Skills are in `src/builtin-skills/`. Dynamic skills managed via `/skill-add`, `/skill-remove`.

## Interactive Commands

`quit`, `exit`, `help`, `/clear`, `/history`, `/compact`, `/bypass`, `/strict`, `/status`, `/skills`, `/init`, `/queue`, `/undo`, `/sessions`, `/switch`, `/rename`

## Configuration

```bash
spica set <name> <url> <apiKey> <model>   # Add provider
spica use <name>                           # Switch default
spica list                                 # List providers
```

Config stored at `~/.spica/settings.json` (providers, mcp, skills, hooks). Project session at `.spica/session.json`.

## Development Notes

**Code style:**
- TypeScript strict mode, ESM imports only
- No comments unless explicitly requested
- Use `resolvePath()` for relative path resolution
- Tool results follow `{ success, output?, error?, content? }` shape

**Key patterns:**
- Agent uses EventEmitter for stream/tool/message events; UI subscribes via `setupAgentEvents()` in `src/cli/events.ts`
- Input queue (`src/cli/ui/queue.ts`) allows non-blocking input during AI processing
- Context compression keeps last 10 messages, summarizes older ones with LLM
- `RuntimeState` (`src/core/`) replaces global mutable state — always use it, never raw globals

**Modules needing care:**
- `src/agent.ts` — largest file, handles many concerns. Add new features in separate modules when possible.
- `src/tools/index.ts` — long switch statement. New tools go in separate files then wired in.
- `src/index.ts` — 953 lines, still carries REPL loop + all command handlers. Refactoring to `cli/interactive.ts` and `cli/commands/` is planned.

**When adding features:**
1. Tools → add to `src/tools/index.ts` switch case
2. CLI commands → add to Commander in `src/index.ts`
3. Settings → update `src/utils/settings.ts` interface
4. Hooks → `src/hooks/index.ts`
5. Docs → update `docs/MANUAL.md` and `docs/STORAGE.md`

**Testing:**
- Tests in `src/__tests__/` and `src/**/__tests__/`
- Run full suite before committing — all tests must pass
- Add or update tests for code you change
- Use `npx vitest run src/__tests__/` to exclude `node_modules` test files

**PR guidelines:**
- Title: `[spica] <description>` or `[spica-cli] <description>`
- Run `npm run lint` and `npm run test:run` before committing
- Verify build: `npm run build && ./bin/spica --version`
