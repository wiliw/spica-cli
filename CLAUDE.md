# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run CLI in development mode (tsx)
npm run build      # Generate executable bin/spica script
npm test           # Run tests with Vitest
npm run test:run   # Run tests once (no watch)
```

## Architecture Overview

### Core Components

**Entry Points** (`src/index.ts`):
- Commander CLI with two modes: TUI (default) and `run` command
- TUI requires TTY terminal; falls back to CLI suggestions if unavailable

**SpicaAgent** (`src/agent.ts`):
- Orchestrates LLM client, tools, and project state
- EventEmitter-based: emits `stream`, `reasoning`, `tool_call`, `tool_result`, `message`
- Auto-detects project type from package.json/go.mod/etc., creates `.spica.md`
- Maintains todo list with status tracking
- Interruptible via `interrupt()` which sets flag and aborts LLM stream

**LLMClient** (`src/llm/LLMClient.ts`):
- Wraps OpenAI-compatible provider with rate limiting and token counting
- Streaming response with tool call aggregation
- AbortController pattern for interrupt support

**Tools** (`src/tools/index.ts`):
- 26 tools: file operations, bash, git, web search/fetch, glob, grep, workspace, question, todo_write, task (parallel subagents)
- Tool definitions passed to LLM as function calling schema
- `task` tool spawns up to 3 parallel SpicaAgent instances

**Project Persistence** (`src/utils/projectState.ts`):
- `.spica/state.json`: todos, phase, decisions, lastActivity
- `.spica/context.json`: recent messages (max 20, trimmed on save)
- Loaded on init to restore conversation context

### TUI Architecture

Built with Ink (React for terminal). Key design principles from docs/tui-architecture.md:

**Layout** (`src/tui/App.tsx`):
- Full-screen: uses `stdout.rows` for height, root container `width="100%"`
- Split: 60% left (AIOutputPanel) | 40% right (ThinkingPanel 60% + ToolsPanel 40%)
- Input: fixed 3 lines at bottom

**Critical Height Enforcement**:
Ink ignores single `height={X}` when content overflows. Always use dual constraints:
```typescript
// Correct - forces exact height
<Box minHeight={height} maxHeight={height}>
```

**State Management** (`src/tui/hooks/useAgent.ts`):
- `AgentState`: turns, events, currentStream, currentReasoning, isRunning
- Events → Turns transformation via `associateEvents()`
- Separate buffers for stream content and reasoning

**Panel States (ing/ed)**:
- `ing` (isRunning=true): Show latest content only, old disappears (`slice(-maxLines)`)
- `ed` (isRunning=false): Full history with marquee scroll if overflow

**Data Flow**:
- Agent emits events → useAgent buffers → setState updates → associateEvents creates turns → panels display
- Tool calls tracked with status: running → success/error

### Provider System

OpenAI-compatible approach - single config for multiple providers:

**Environment Variables** (preferred for security):
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Provider-specific: `SPICA_TOGETHER_API_KEY`, etc.

**Config File** (`~/.spica/config.json`):
- Built-in providers: openai, anthropic, together, groq, local, custom
- `getProviderConfig()` merges env vars + file config + built-in defaults

### Key Patterns

**Tool Execution Loop** (`agent.ts:runLoop`):
1. Generate with tools
2. If tool calls: execute all in parallel, emit events
3. Continue with tool results
4. Repeat until `finished=true` or max iterations
5. Save project context on completion

**Interrupt Flow**:
- ESC in TUI → confirmation → `agent.interrupt()`
- Sets `interruptFlag=true` + calls `llm.interrupt()`
- `abortController.abort()` breaks stream immediately

**Project Detection** (`agent.ts:autoDetectProject`):
- package.json → Node.js/TypeScript/React CLI/Webapp
- go.mod → Go
- requirements.txt → Python
- Cargo.toml → Rust
- Creates `.spica.md` with build/test/dev commands

## Important Files

- `src/agent.ts` - Core agent loop, tool calling, project management
- `src/tools/index.ts` - All tool definitions and execution
- `src/llm/providers/OpenAICompatible.ts` - Streaming + tool calling
- `src/tui/App.tsx` - Main TUI layout
- `src/tui/hooks/useAgent.ts` - State management, event handling
- `src/utils/projectState.ts` - Persistence layer
- `docs/TUI-REQUIREMENTS.md` - Confirmed TUI design requirements