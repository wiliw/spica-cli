# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # Run CLI in development mode (tsx)
npm run build                  # Generate executable bin/spica script
npm test                       # Run tests with Vitest (watch mode)
npm run test:run               # Run tests once (vitest run)
npm run lint                   # Run ESLint
npm run lint:fix               # Auto-fix lint issues
npx tsc --noEmit               # Type check only
vitest run src/__tests__/agent.test.ts  # Run specific test file
vitest run --grep "interrupt"           # Run tests matching pattern
```

## Architecture

### Core Components

**SpicaAgent** (`src/agent.ts`)
- Central orchestrator, EventEmitter-based
- Manages LLM client, tools, project state, session history
- Key events: `tool_call`, `tool_result`, `message`, `interrupt`, `done`
- Tool conflict detection for concurrent file operations

**LLMClient** (`src/llm/LLMClient.ts`)
- OpenAI-compatible provider abstraction
- Streaming responses, temperature=0.3
- Providers in `src/llm/providers/`: OpenAI, Anthropic, DeepSeek, Gemini, etc.

**Tools** (`src/tools/index.ts`)
- 33 built-in tools: file ops, bash, git, grep, glob, web, lint, test, etc.
- MCP tools dynamically added via `src/mcp/client.ts`
- Each tool returns `{ success, output, error, diff?, syntaxErrors? }`

**CLI/TUI** (`src/cli/`)
- Commands: `/help`, `/archive`, `/history`, `/summary`, `/compact`, `/queue`, `/checkpoint`, `/skill`, `/mcp`, `/status`, `/init`
- Events handler in `events.ts`
- UI components in `ui/`: spinner, diff display, messages

### Data Flow

1. User input → InputQueue (supports queued inputs)
2. Agent.processInput() → LLMClient.stream()
3. LLM returns tool_calls → Agent.executeTools()
4. Tool results → Agent.runLoop() continues
5. Continue until LLM returns text (no tool calls) → done

### Storage

```
~/.spica/                      # Global
├── config.json                # Provider configs (API keys, URLs)
├── skills.json                # Custom skill definitions
├── mcp.json                   # MCP server configs
├── hooks.json                 # Hook rules

<project>/.spica/              # Project-specific
├── session.json               # Current session messages
├── state.json                 # Project state (todos, checkpoints)
├── backups/                   # File backups before edits
├── tasks.json                 # Persisted task list
```

## Key Patterns

### EventEmitter Pattern

All async communication uses events:
```typescript
agent.on('tool_call', (data) => { ... });
agent.on('tool_result', (data) => { ... });
agent.emit('message', { role: 'assistant', content });
```

### Tool Conflict Detection

Multiple tools on same resource → sequential execution:
- `extractResourcePath()` identifies file paths in tool args
- `detectToolConflicts()` groups conflicting operations
- Non-conflicting tools run in parallel

### Interrupt Handling

ESC ESC triggers interrupt:
1. `agent.interrupt()` called
2. AbortController signals all running tools
3. Bash commands killed via process group (-pid)
4. Agent returns partial result, user can continue

### Auto-Syntax Check

File write/edit tools auto-check syntax for:
- TypeScript/JavaScript: `tsc --noEmit`
- Python: `python -m py_compile`
- Go: `golangci-lint`
- Rust: `cargo check`

Returns `syntaxErrors` field if issues found.

### Sub-Agent Pattern

`task` tool spawns parallel subagents:
- Max 3 concurrent tasks
- Each subagent has tool whitelist (limited permissions)
- Timeout: 60s per subagent
- Main agent handles failures (retry or take over)

## Testing

Test structure mirrors source:
```
src/__tests__/                 # Top-level tests
src/tools/__tests__/           # Tool tests
src/llm/__tests__/             # LLM tests
src/cli/__tests__/             # CLI tests
```

Key test categories:
- `agent.test.ts` - Core agent logic
- `interrupt.test.ts` - ESC ESC interrupt handling
- `tools.test.ts` - Tool execution
- `edgeCases.test.ts` - Edge cases and boundary conditions
- `regression/` - Bug regression tests

Vitest globals enabled: `describe`, `it`, `expect`, `vi`

## Conventions

### Writing Style (from docs/STYLE_GUIDE.md)

Technical documentation:
- One sentence per point, no elaboration
- Command first, then purpose
- No modifiers: "强大的", "高效的", "智能的"
- No transitions: "接下来", "让我们", "首先"
- English terms stay English: session, checkpoint, MCP

### Code Style

- TypeScript ESM (`"type": "module"`)
- Prefer `async/await` over raw promises
- Error messages actionable: tell what to do, not just what failed
- File edits require prior read (enforced by tool descriptions)

## Important Files

- `src/index.ts` - Entry point, TUI setup
- `src/prompts/system.ts` - System prompt for LLM
- `src/utils/settings.ts` - Provider config management
- `src/storage/projectState.ts` - Session persistence
- `src/hooks/index.ts` - Tool interception hooks
- `src/skills/index.ts` - Skill loading and execution
- `docs/MANUAL.md` - Complete user manual
- `docs/STYLE_GUIDE.md` - Technical writing style guide