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

**Read `AGENTS.md` first** for project context (tech stack, setup, development notes).

### Core Components

**Entry Point** (`src/index.ts`):
- Commander CLI with interactive mode (default) and `run` command
- Options: `--fresh` (clear history), `-p/--provider`, `--version`
- Non-blocking REPL with input queue
- Tab completion for `/` commands
- All prompts in English (system prompt, `/init`, `/compact`)

**SpicaAgent** (`src/agent.ts`):
- Orchestrates LLM client, tools, and project state
- EventEmitter-based architecture
- Key methods:
  - `init()`: Initialize LLM, MCP, project config
  - `runLoop()`: Main execution loop with pre-compression check
  - `compact()`: Token-based context compression (target <60% context window)
  - `generateSummary()`: LLM-generated history summary (English prompt)
- Events: `stream`, `reasoning`, `tool_call`, `tool_result`, `message`, `error_suggestion`, `diff_preview`, `permission_request`, `context_compressed`

**LLMClient** (`src/llm/`):
- OpenAI-compatible provider with streaming
- Rate limiting, token counting
- AbortController for interrupt
- Temperature: 0.3 (faster responses)
- Model context windows: GPT-4o 128K, GLM-5 200K, Claude-3 200K

**Core Modules** (`src/core/`):
- `EventBus`: Central event dispatcher for agent communication
- `RuntimeState`: Global runtime state (processing status, agent reference)
- `StateManager`: Project state persistence (todos, checkpoints)
- `ErrorHandler`: Error categorization, retry logic, error reports
- `SessionManager`: Session lifecycle management
- `LogManager`: Structured logging with categories and levels
- `ProcessMonitor`: Background process tracking and log streaming
- `Heartbeat`: Progress indicators during long LLM waits

**Tools** (`src/tools/index.ts`):
- 24 built-in tools + MCP dynamic tools
- Categories: file ops, directory, search, shell, git, GitHub, web, task management
- **bash tool modes**:
  - Normal: default execution
  - `tty: true`: Provide TTY environment (one-shot)
  - `detached: true`: Run in background (tmux/screen), user can attach
  - `interactive: true`: Real PTY with AI input/output (node-pty)
  - `inputs: string[]`: Predefined input sequence (for interactive mode)
  - `expect: [{ wait: "pattern", input: "text" }]`: Wait for output then input
- `getAllToolDefinitions()`: Includes MCP tools
- `executeTool()`: Main execution function

**Settings System** (`src/utils/settings.ts`):
- Unified configuration in `~/.spica/settings.json`
- Contains: providers, mcp, skills, hooks
- `loadGlobalSettings()`, `saveGlobalSettings()`
- Project skills/hooks merge with global

**MCP Client** (`src/mcp/client.ts`):
- Stdio and SSE transport support
- `MCPManager`: Singleton manager for all servers
- Reads config from `settings.mcp`
- Tools exposed as `server_name/tool_name`

**Skills** (`src/skills/index.ts`):
- 14 built-in superpowers skills (brainstorming, writing-plans, TDD, debugging, etc.)
- Load from `settings.skills` and `.spica/skills.json`
- `parseSkillInput()`: Parse `/skill_name args`
- `buildSkillPrompt()`: Replace `{var}` placeholders
- Install/uninstall writes to settings.json

**Hooks** (`src/hooks/index.ts`):
- `runPreHooks()`: Pre-tool interception (block/confirm)
- `runPostHooks()`: Post-tool logging
- Reads from `settings.hooks` + project hooks

**Input Queue** (`src/cli/ui/queue.ts`):
- Non-blocking input during AI processing
- `add()`, `mergePending()`, `undoLast()`
- Auto-process queue after AI completes

### Key Patterns

**Tool Execution Loop**:
1. Load history from session.json
2. Pre-request compression check (remaining tokens <15% threshold)
3. Create git checkpoint
4. Generate with tools (temperature 0.3)
5. PreHooks check → Permission check → Execute tool → PostHooks log
6. Emit events
7. Continue with results
8. Auto-save session after each turn
9. Process input queue if pending

**Interrupt Flow**:
`Ctrl+C` → `agent.interrupt()` → `llm.interrupt()` → `abortController.abort()`

**Context Compression** (`compact()`):
- Trigger: Used tokens >60% of context window OR messages >20
- Strategy: Keep last 10 messages (truncate each to 2000 chars)
- Generate LLM summary of older messages (English prompt)
- If still over limit: Reduce to last 5 messages with another summary
- Output: `[History Summary]` prefix

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
└── installed-skills/   # Installed skill packages (superpowers)

<project>/.spica/
├── session.json        # Session history (auto-loaded/saved)
├── skills.json         # Project skills (optional)
└── hooks.json          # Project hooks (optional)

<project>/AGENTS.md     # Project description (industry standard)
```

## Important Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Project description for AI context (industry standard) |
| `src/index.ts` | CLI entry, REPL loop, input queue, `/init` prompt |
| `src/agent.ts` | Agent loop, compression, permissions, summary generation |
| `src/core/` | EventBus, StateManager, ErrorHandler, SessionManager, Heartbeat |
| `src/cli/ui/screenManager.ts` | TUI with scroll regions, status bar, input handling |
| `src/cli/ui/queue.ts` | Non-blocking input management |
| `src/cli/events.ts` | Agent event handlers for UI output |
| `src/tools/index.ts` | All tool definitions and execution |
| `src/mcp/client.ts` | MCP client manager |
| `src/skills/index.ts` | Skills loader and executor |
| `src/hooks/index.ts` | Hooks system |
| `src/llm/providers/OpenAICompatible.ts` | OpenAI streaming, context window tracking |
| `src/llm/TokenCounter.ts` | Token estimation for compression |
| `src/prompts/system.ts` | System prompt (English) |

## Interactive Commands

**Non-`/` commands**: `quit`, `exit`, `help`

**`/` commands** (Tab autocomplete):
- Session: `/clear`, `/history`, `/compact`
- Queue: `/queue`, `/undo`
- Mode: `/bypass`, `/strict`, `/status`
- Skills: `/skills`, `/init`, `/skill_name [args]`

## Built-in Tools (24)

| Category | Tools |
|----------|-------|
| File | `file_read`, `file_write`, `file_edit`, `file_multi_edit`, `file_exists`, `file_delete`, `file_copy`, `file_move` |
| Directory | `directory_create`, `directory_list` |
| Search | `glob`, `grep` |
| Shell | `bash` (timeout support) |
| Git | `git` (status, diff, log, add, commit, branch, checkout, push, pull, reset, stash) |
| GitHub | `gh` (pr_view, pr_list, issue_list, repo_view, run_list) |
| Web | `web_search`, `web_fetch` |
| Task | `task` (sub-agent spawning, max 3 parallel), `question`, `todo_write`, `workspace`, `checkpoint_restore` |
| Quality | `lint`, `test` (auto-detect framework) |

## Built-in Skills (14 superpowers)

| Skill | Trigger |
|-------|---------|
| `brainstorming` | Before any creative work |
| `writing-plans` | Multi-step task before coding |
| `writing-skills` | Creating/editing skills |
| `test-driven-development` | Before writing implementation |
| `systematic-debugging` | Any bug or test failure |
| `verification-before-completion` | Before claiming work complete |
| `requesting-code-review` | After completing tasks |
| `receiving-code-review` | When receiving feedback |
| `subagent-driven-development` | Executing plans with parallel tasks |
| `dispatching-parallel-agents` | 2+ independent tasks |
| `using-git-worktrees` | Feature work needing isolation |
| `executing-plans` | Implementing written plans |
| `finishing-a-development-branch` | After implementation complete |
| `using-superpowers` | At session start (bootstrap) |

## When Adding New Features

1. **Tools**: Add to switch case in `src/tools/index.ts`
2. **CLI commands**: Add to Commander in `src/index.ts`
3. **Settings**: Update `src/utils/settings.ts` interface if new config type
4. **Hooks**: Add default hooks in `src/hooks/index.ts`
5. **Skills**: Skills auto-load from settings.json
6. **MCP**: Update `src/mcp/client.ts` for new transport types
7. **Docs**: Update `docs/MANUAL.md` and `docs/STORAGE.md`

## Testing

```bash
npm run test:run           # Run all 261 tests (22 test files)
npx vitest run <pattern>   # Run specific test file (e.g., tools.test)
npx tsc --noEmit           # Type check
npm run build              # Build executable
./bin/spica --version      # Test CLI
./bin/spica providers      # List providers
./bin/spica skills list    # List skills
```