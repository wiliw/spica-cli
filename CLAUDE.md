# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run CLI in development mode (tsx)
npm run build      # Generate executable bin/spica script
npm test           # Run tests with Vitest (watch mode)
npm run test:run   # Run tests once (no watch)
npx tsc --noEmit   # Type check
```

## Architecture Overview

### Core Components

**Entry Point** (`src/index.ts`):
- Commander CLI with interactive mode (default) and `run` command
- Options: `--fresh` (clear history), `-p/--provider`, `--version`
- Non-blocking REPL with input queue
- Tab completion for `/` commands
- TTY detection for pipe input compatibility

**SpicaAgent** (`src/agent.ts`):
- Orchestrates LLM client, tools, and project state
- EventEmitter-based architecture
- Key methods:
  - `init()`: Initialize LLM, MCP, project config
  - `runLoop()`: Main execution loop
  - `compact()`: Manual context compression
  - `checkNeedsPermission()`: Dangerous operation detection
  - `waitForPermission()`: Permission queue (serial processing)
- Events: `stream`, `reasoning`, `tool_call`, `tool_result`, `message`, `error_suggestion`, `diff_preview`, `permission_request`, `sub_agent_*`, `hook_*`

**LLMClient** (`src/llm/LLMClient.ts`):
- OpenAI-compatible provider with streaming
- Rate limiting (`RateLimiter.ts`), token counting (`TokenCounter.ts`)
- AbortController for interrupt
- Temperature: 0.3 (faster responses)
- Key methods: `generate()`, `continueWithAllToolResults()`, `checkConnection()`

**Tools** (`src/tools/index.ts`):
- 35 tools: file ops, bash, git, web, glob, grep, workspace, question, todo_write, task, lint, test, gh_*
- `getAllToolDefinitions()`: Includes MCP tools
- `executeTool()`: Main execution function with event callback

**Core Module** (`src/core/`):
- `EventBus`: Central event distribution
- `StateManager`: Project state persistence
- `SessionManager`: Session lifecycle management
- `ErrorHandler`: Error categorization and recovery
- `LogManager`: Structured logging with levels
- `ProcessMonitor`: External process tracking

**Settings System** (`src/utils/settings.ts`):
- Unified configuration in `~/.spica/settings.json`
- Contains: providers, mcp, skills, hooks
- `loadGlobalSettings()`, `saveGlobalSettings()`
- Project skills/hooks merge with global (skills override, hooks append)

**MCP Client** (`src/mcp/client.ts`):
- Stdio and SSE transport support
- `MCPManager`: Singleton manager for all servers
- Reads config from `settings.mcp`
- Tools exposed as `server_name/tool_name`

**Skills** (`src/skills/index.ts`):
- Load from `settings.skills` and `.spica/skills.json`
- `parseSkillInput()`: Parse `/skill_name args`
- `buildSkillPrompt()`: Replace `{var}` placeholders
- Install/uninstall from URL or local file

**Hooks** (`src/hooks/index.ts`):
- `runPreHooks()`: Pre-tool interception (block/confirm/warn)
- `runPostHooks()`: Post-tool logging
- Reads from `settings.hooks` + project hooks
- Matcher supports wildcard patterns

**Input Queue** (`src/utils/inputQueue.ts`):
- Non-blocking input during AI processing
- `add()`, `mergePending()`, `undoLast()`
- Auto-process queue after AI completes

### Key Patterns

**Tool Execution Loop**:
1. Load history from session.json
2. Pre-request compression (if > 40 messages)
3. Create git checkpoint
4. Generate with tools (temperature 0.3)
5. PreHooks check → Permission check → Execute tool → PostHooks log
6. Emit events via callback
7. Continue with results
8. Auto-save session after each turn
9. Process input queue if pending

**Interrupt Flow**:
`Ctrl+C` → `agent.interrupt()` → `llm.interrupt()` → `abortController.abort()`

**Context Compression**:
- Max 40 messages
- Tool results compressed to 15 chars
- Important keywords preserved: 决定/成功/失败
- Auto-compress when exceeded

**Permission Queue**:
- Serial processing of permission requests
- Bypass mode (`/bypass`) auto-approves dangerous operations
- Strict mode (`/strict`) prompts for each

### Configuration Merge

| Config Type | Global | Project | Merge Rule |
|-------------|--------|---------|------------|
| providers | settings.json | - | Global only |
| mcp | settings.json | - | Global only |
| skills | settings.json | .spica/skills.json | Project **overrides** |
| hooks | settings.json | .spica/hooks.json | Project **appends** |

### Storage Locations

```
~/.spica/
├── settings.json       # Unified config (providers, mcp, skills, hooks)
├── context.json        # Global context cache
└── installed-skills/   # Installed skill packages

<project>/.spica/
├── session.json        # Session history (auto-loaded/saved)
├── skills.json         # Project skills (optional)
└── hooks.json          # Project hooks (optional)

<project>/AGENTS.md     # Project description (industry standard)
```

## Important Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry, REPL loop, input handling, TTY detection |
| `src/agent.ts` | Agent loop, compression, permissions, subagent events |
| `src/utils/settings.ts` | Unified configuration system, provider defaults |
| `src/utils/inputQueue.ts` | Non-blocking input management |
| `src/tools/index.ts` | All tool definitions, execution logic |
| `src/tools/subAgent.ts` | Subagent configs (explore/review/fix/build) |
| `src/mcp/client.ts` | MCP client manager, stdio/SSE transport |
| `src/skills/index.ts` | Skills loader, parser, install/uninstall |
| `src/hooks/index.ts` | Hooks matching, pre/post execution |
| `src/llm/LLMClient.ts` | LLM client, rate limiting, streaming |
| `src/llm/providers/OpenAICompatible.ts` | OpenAI API implementation |
| `src/utils/session.ts` | Session persistence |
| `src/utils/projectConfig.ts` | AGENTS.md parser, auto-detection |
| `src/utils/colors.ts` | ANSI colors, banner animation, formatting |
| `src/prompts/system.ts` | System prompt, project context injection |
| `src/core/*.ts` | EventBus, StateManager, ErrorHandler, ProcessMonitor |

## Interactive Commands

**Non-`/` commands**: `quit`, `exit`, `help`

**`/` commands** (Tab autocomplete):
- Session: `/clear`, `/reset`, `/history`, `/compact`
- Queue: `/queue`, `/q`, `/undo`
- Mode: `/bypass`, `/strict`, `/status`
- Skills: `/skills`, `/skill_name [args]`

## SubAgent Types

Defined in `src/tools/subAgent.ts`:
- `explore`: Read-only (glob, grep, read), 30s timeout
- `review`: Code review (glob, grep, read, lint), 60s timeout
- `fix`: Bug fix (read, edit, bash, lint), 120s timeout
- `build`: Full implementation (all tools), 180s timeout

## When Adding New Features

1. **Tools**: Add to `TOOLS_DEFINITIONS` in `src/tools/index.ts`, add switch case
2. **CLI commands**: Add to Commander in `src/index.ts`
3. **Settings**: Update `Settings` interface in `src/utils/settings.ts`
4. **Hooks**: Add default hooks in `src/hooks/index.ts`
5. **Skills**: Skills auto-load from settings.json
6. **MCP**: Update `src/mcp/client.ts` for new transport types
7. **Colors/UI**: Update `src/utils/colors.ts`
8. **Tests**: Add test files to appropriate `__tests__/` directory
9. **Docs**: Update `docs/MANUAL.md` and `docs/STORAGE.md`

## Testing

```bash
npm run test:run  # Run all 64 tests
npx tsc --noEmit  # Type check
npm run build     # Build executable
```

Tests are located in `src/core/__tests__/` and use Vitest. Test files follow pattern `*.test.ts`.

**Test Coverage**:
- `SessionManager.test.ts`: 16 tests (session CRUD)
- `ErrorHandler.test.ts`: 12 tests (error handling, retry)
- `ProcessMonitor.test.ts`: 13 tests (process lifecycle, logs)
- `LogManager.test.ts`: 7 tests (log levels, filtering)
- `StateManager.test.ts`: 10 tests (state persistence)
- `EventBus.test.ts`: 6 tests (event distribution)

## TTY vs Pipe Input

The CLI detects TTY mode:
- TTY: Banner animation, raw mode, bracketed paste, Tab completion
- Pipe: No animation, standard readline, immediate processing

This allows both interactive use and scripted automation (e.g., `echo "task" | spica`).