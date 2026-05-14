# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run CLI in development mode (tsx)
npm run build      # Generate executable bin/spica script
npm test           # Run tests with Vitest
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

**SpicaAgent** (`src/agent.ts`):
- Orchestrates LLM client, tools, and project state
- EventEmitter-based architecture
- Key methods:
  - `init()`: Initialize LLM, MCP, project config
  - `runLoop()`: Main execution loop
  - `compact()`: Manual context compression
  - `checkNeedsPermission()`: Dangerous operation detection
- Events: `stream`, `reasoning`, `tool_call`, `tool_result`, `message`, `error_suggestion`, `diff_preview`, `permission_request`

**LLMClient** (`src/llm/`):
- OpenAI-compatible provider with streaming
- Rate limiting, token counting
- AbortController for interrupt
- Temperature: 0.3 (faster responses)

**Tools** (`src/tools/index.ts`):
- 33 tools: file ops, bash, git, web, glob, grep, workspace, question, todo_write, task, lint, test, gh_*
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
- Load from `settings.skills` and `.spica/skills.json`
- `parseSkillInput()`: Parse `/skill_name args`
- `buildSkillPrompt()`: Replace `{var}` placeholders
- Install/uninstall writes to settings.json

**Hooks** (`src/hooks/index.ts`):
- `runPreHooks()`: Pre-tool interception (block/confirm)
- `runPostHooks()`: Post-tool logging
- Reads from `settings.hooks` + project hooks

**Input Queue** (`src/utils/inputQueue.ts`):
- Non-blocking input during AI processing
- `add()`, `mergePending()`, `undoLast()`
- Auto-process queue after AI completes

### Key Patterns

**Tool Execution Loop**:
1. Load history from session.json
2. Pre-request compression (if > 15 messages)
3. Create git checkpoint
4. Generate with tools (temperature 0.3)
5. PreHooks check → Permission check → Execute tool → PostHooks log
6. Emit events
7. Continue with results
8. Auto-save session after each turn
9. Process input queue if pending

**Interrupt Flow**:
`Ctrl+C` → `agent.interrupt()` → `llm.interrupt()` → `abortController.abort()`

**Context Compression**:
- Max 15 messages
- Tool results compressed to 15 chars
- Important keywords preserved: 决定/成功/失败
- Auto-compress when exceeded

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
| `src/index.ts` | CLI entry, REPL loop, input queue |
| `src/agent.ts` | Agent loop, compression, permissions |
| `src/utils/settings.ts` | Unified configuration system |
| `src/utils/inputQueue.ts` | Non-blocking input management |
| `src/tools/index.ts` | All tool definitions |
| `src/mcp/client.ts` | MCP client manager |
| `src/skills/index.ts` | Skills loader and executor |
| `src/hooks/index.ts` | Hooks system |
| `src/llm/providers/OpenAICompatible.ts` | OpenAI streaming |
| `src/utils/session.ts` | Session persistence |
| `src/utils/projectConfig.ts` | AGENTS.md parser |
| `src/prompts/system.ts` | System prompt |

## Interactive Commands

**Non-`/` commands**: `quit`, `exit`, `help`

**`/` commands** (Tab autocomplete):
- Session: `/clear`, `/history`, `/compact`
- Queue: `/queue`, `/undo`
- Mode: `/bypass`, `/strict`, `/status`
- Skills: `/skills`, `/skill_name [args]`

## When Adding New Features

1. **Tools**: Add to `TOOLS_DEFINITIONS` in `src/tools/index.ts`, add switch case
2. **CLI commands**: Add to Commander in `src/index.ts`
3. **Settings**: Update `src/utils/settings.ts` interface if new config type
4. **Hooks**: Add default hooks in `src/hooks/index.ts`
5. **Skills**: Skills auto-load from settings.json
6. **MCP**: Update `src/mcp/client.ts` for new transport types
7. **Docs**: Update `docs/MANUAL.md` and `docs/STORAGE.md`

## Testing

```bash
npm run test:run  # Run all 64 tests
npx tsc --noEmit  # Type check
npm run build     # Build executable
```