# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run CLI in development mode (tsx)
npm run build      # Generate executable bin/spica script
npm test           # Run tests with Vitest
npm run test:run   # Run tests once (no watch)
spica              # Run TUI (after npm link)
spica run "request" # CLI mode
```

## Architecture Overview

### Core Components

**Entry Points** (`src/index.ts`):
- Commander CLI with two modes: TUI (default) and `run` command
- TUI requires TTY terminal; falls back to CLI suggestions if unavailable

**SpicaAgent** (`src/agent.ts`):
- Orchestrates LLM client, tools, and project state
- EventEmitter-based: emits `stream`, `reasoning`, `tool_call`, `tool_result`, `message`, `error_suggestion`, `diff_preview`
- Auto-detects project type, creates `.spica.md`
- **New features**:
  - `generateErrorSuggestion()`: 工具失败时生成修复建议
  - `compressHistory()`: 超过20条消息自动压缩
  - Context persistence with simplified messages

**LLMClient** (`src/llm/LLMClient.ts`):
- OpenAI-compatible provider with rate limiting
- Streaming + tool calling aggregation
- AbortController for interrupt

**Tools** (`src/tools/index.ts`):
- 26 tools: file ops, bash, git, web, glob, grep, workspace, question, todo_write, task
- `task` tool spawns parallel SpicaAgent instances

**Project Persistence** (`src/utils/projectState.ts`):
- `.spica/state.json`: todos, phase, decisions
- `.spica/context.json`: recent messages (max 20, compressed)

### TUI Architecture

Built with Ink (React for terminal). Key principles:

**Layout** (`src/tui/App.tsx`):
- Full-screen: `stdout.rows` for height, `width="100%"`
- Split: 60% left (AIOutput) | 40% right (Thinking 60% + Tools 40%)
- Status Bar: running时显示进度
- Input: fixed height at bottom

**Critical Height Enforcement**:
Ink border在**内部**占用空间（上下各1行）：
```typescript
const contentHeight = totalHeight - 2 - 1; // border + title
```

**Components** (`src/tui/components/`):
- `AIOutputPanel.tsx`: Rounds显示，换行wrap
- `ThinkingPanel.tsx`: ing只显示最新，ed滚动历史
- `ToolsPanel.tsx`: 每工具2行，带依赖符号（→串行/‖并行）
- `InputPanel.tsx`: 工作状态条 + 任务队列 + Tab补全
- `StatusBanners.tsx`: ErrorBanner + DiffPreview

**Hooks** (`src/tui/hooks/`):
- `useAgent.ts`: 状态管理，事件处理，任务队列
- `useScroll.ts`: Round导航，autoFollow逻辑
- `useMarquee.ts`: 内容滚动动画

**Data Flow**:
- Agent emits → useAgent buffers → associateEvents creates turns → panels display
- `associateEvents.ts`: 同工具名只保留最新状态

**New TUI Features**:
1. 工作状态指示条（Step X: tool_name）
2. 错误恢复建议横幅
3. Diff预览横幅（3秒消失）
4. 多任务队列显示
5. Ctrl+H快捷键帮助
6. Ctrl+E会话导出
7. Tab命令补全
8. 上下文压缩（超过20条）

### Provider System

Environment Variables:
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Provider-specific: `SPICA_TOGETHER_API_KEY`, etc.

Config File (`~/.spica/config.json`):
- Built-in providers: openai, anthropic, together, groq, local, custom

### Key Patterns

**Tool Execution Loop**:
1. Generate with tools
2. Execute tools in parallel, emit events
3. Continue with results
4. Repeat until finished
5. Save context (compressed if needed)

**Interrupt Flow**:
ESC → confirmation → `agent.interrupt()` → `llm.interrupt()` → `abortController.abort()`

## Important Files

- `src/agent.ts` - Agent loop, error suggestions, context compression
- `src/tools/index.ts` - All tool definitions
- `src/llm/providers/OpenAICompatible.ts` - Streaming + tool calling
- `src/tui/App.tsx` - Main TUI layout
- `src/tui/hooks/useAgent.ts` - State management
- `src/tui/components/*.tsx` - All UI components
- `src/tui/utils/associateEvents.ts` - Event→Turn transformation
- `docs/TUI-REQUIREMENTS.md` - 需求文档（已实现）
- `docs/tui-architecture.md` - 技术架构