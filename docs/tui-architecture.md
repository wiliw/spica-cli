# Spica CLI - TUI Architecture

## Overview
Spica CLI provides a full-screen terminal UI for AI coding agent interaction.

## Layout Design

### Screen Division (Golden Ratio)
```
┌─────────────────────────────────────────────────────────────┐
│ Terminal (100% width, fixed height = stdout.rows)          │
├──────────────────────┬──────────────────────────────────────┤
│ Rounds (60%)         │ Thinking (60% of right side)         │
│                      ├──────────────────────────────────────┤
│                      │ Toolcalled (40% of right side)        │
├──────────────────────┴──────────────────────────────────────┤
│ Input Panel (fixed height = 3 lines)                        │
└─────────────────────────────────────────────────────────────┘
```

### Height Calculation
```typescript
terminalHeight = stdout.rows || 40
contentHeight = terminalHeight - 3  // Reserve for InputPanel
```

### Strict Constraints
- ALL boxes use `minHeight` + `maxHeight` (dual enforcement)
- ALL boxes use `width` percentage (60/40 split)
- Root container: `width="100%"` to prevent terminal scrolling

## Components

### AIOutputPanel (Rounds)
- **Focus Model**: One round = User message + AI response
- **Navigation**: ↑↓ scroll content within round, switch to prev/next at boundaries
- **States**: `[AUTO]` follow latest, `[MANUAL]` browse history
- **Display**: 
  - Focused round: Full content with scroll indicators
  - Adjacent rounds: Truncated preview

### ThinkingPanel
- **States**:
  - `Thinking` (isRunning=true): Display latest content, old content disappears
  - `Thoughts` (isRunning=false): Marquee scroll if overflow
- **Color**: Magenta border, Yellow text (neon style)

### ToolsPanel  
- **States**:
  - `Toolcalling` (isRunning=true): Latest tools only
  - `Toolcalled` (isRunning=false): Marquee scroll if overflow
- **Color**: Green border, Status-colored text (yellow/green/red)

### InputPanel
- Height: Fixed 3 lines
- Commands:
  - `quit` → Exit with summary
  - ESC (running) → Interrupt confirmation
  - ↑↓ G → Navigate rounds (always available)

## Data Flow

### Event → Turn Association
```typescript
associateEvents(events: Event[]): ConversationTurn[]
```
- Collects: user messages, assistant messages, reasoning, tool calls
- Creates incomplete turn on user input (assistantMessage = '...')
- Updates turn as AI streams response

### State Management
```typescript
interface AgentState {
  turns: ConversationTurn[]      // Historical rounds
  events: Event[]                // Raw event stream
  currentReasoning: string       // Live reasoning buffer
  isRunning: boolean             // Agent activity flag
}
```

### Persistence
- `.spica/context.json`: Full conversation (user, assistant, toolCalls)
- `.spica/state.json`: Project todos, phase
- Load: Filter to show only user/assistant in Rounds

## Interrupt Mechanism

### AbortController Pattern
```typescript
// LLMClient
abortController = new AbortController()
provider.generate(prompt, tools, abortController.signal)

// Provider (OpenAICompatible)
stream = client.chat.completions.create({...}, { signal })
for await (chunk of stream) {
  if (signal?.aborted) break
}
```

### Flow
1. ESC → Show confirmation dialog
2. ESC again → Call `agent.interrupt()`
3. `interrupt()` → `interruptFlag=true` + `llm.interrupt()`
4. `llm.interrupt()` → `abortController.abort()`
5. Stream breaks immediately

## Color Scheme (Neon Nightlife)
- Cyan: Rounds header
- Magenta: FOCUS indicator, Thinking border
- Yellow: Thinking text, Tool status running
- Green: Tools border, Tool status success
- Red: Tool status error
- All headers: `backgroundColor="black"` for neon effect

## Marquee Scroll
```typescript
useMarquee(content: string, maxLines: number): string
```
- Phase rotates every 500ms
- Used only in ed state when content exceeds maxLines
- Shows sequential slices of full content

## Critical Implementation Notes

### Height Enforcement
- **Wrong**: `height={X}` alone (Ink may ignore if content overflows)
- **Correct**: `minHeight={X} maxHeight={X}` (forces exact height)

### Width Enforcement
- **Wrong**: Percentage without root constraint
- **Correct**: Root `width="100%"` + children `width="60%"/40%"`

### Data Completeness
- **Wrong**: Filter out toolCalls during save
- **Correct**: Save full messages, filter only during display

### Scroll Behavior
- **ing state**: `slice(-maxLines)` - show latest, old disappears
- **ed state**: `useMarquee()` - scroll through full history

## Testing Checklist
1. ✓ Full-screen (no terminal scroll)
2. ✓ Fixed proportions (60/40)
3. ✓ Rounds navigation (↑↓ switch focus)
4. ✓ Content scroll within round
5. ✓ Thinking/Toolcalled state transitions
6. ✓ Marquee scroll in ed state
7. ✓ Interrupt immediate stop
8. ✓ Data persistence (restart shows history)
9. ✓ Toolcalled data complete (not empty)
10. ✓ Neon colors visible

## File Structure
```
src/tui/
  App.tsx                    # Main layout
  components/
    AIOutputPanel.tsx        # Rounds display
    ThinkingPanel.tsx        # Thinking/Thoughts
    ToolsPanel.tsx           # Toolcalling/Toolcalled  
    InputPanel.tsx           # User input
  hooks/
    useAgent.ts              # Agent state + event handling
    useScroll.ts             # Round navigation logic
    useMarquee.ts            # Auto-scroll animation
  utils/
    associateEvents.ts       # Event → Turn transformation
  types.ts                   # ConversationTurn, Event definitions
```