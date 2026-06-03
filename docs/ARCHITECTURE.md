# Spica Architecture

## Overview

Spica is an AI-powered coding agent built with Node.js + TypeScript. It follows an event-driven architecture with clear separation of concerns.

## Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     SpicaAgent                               │
│  (EventEmitter-based orchestrator)                           │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ LLMClient   │  │ Tools       │  │ Project State        │   │
│  │             │  │ (33 tools)  │  │ (config, workspace)  │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ MCP Client  │  │ Skills      │  │ Hooks                │   │
│  │             │  │             │  │ (interception)       │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### SpicaAgent (src/agent.ts)

The central orchestrator that:
- Manages conversation flow with LLM
- Executes tools and handles results
- Manages context compression
- Handles interrupts and errors
- Emits events for UI updates

**Key Methods:**
- `runLoop(prompt)` - Main execution loop
- `interrupt()` - Stop current operation
- `compact()` - Compress context
- `setMessages()` / `getMessages()` - Message history management

### LLMClient (src/llm/)

Handles communication with LLM providers:
- **LLMClient.ts** - High-level client interface
- **OpenAICompatibleProvider.ts** - OpenAI-compatible API implementation
- **TokenCounter.ts** - Token counting for context management
- **RateLimiter.ts** - Rate limiting for API calls

**Key Methods:**
- `generate(prompt, tools)` - Generate with tool support
- `continueWithAllToolResults(results)` - Continue after tool execution
- `generateDirect(prompt)` - Generate without history (for summaries)

### Tools (src/tools/index.ts)

33 built-in tools with unified interface:

```typescript
interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  content?: string;  // For file_read
  diff?: string;     // For file edits
}

async function executeTool(
  name: string,
  args: Record<string, any>,
  eventCallback?: (event: string, data: any) => void
): Promise<ToolResult>
```

**Tool Categories:**
- **File Operations**: file_read, file_write, file_edit, file_multi_edit, file_exists, file_delete, file_copy, file_move, directory_create, directory_list
- **Search**: glob, grep
- **Shell**: bash (with security checks)
- **Git**: git (all common operations)
- **GitHub**: gh (PR, issues, repos)
- **Web**: web_search, web_fetch
- **Task Management**: task, todo, status
- **Code Quality**: lint, format, test, syntax_check
- **Other**: skill, permission, question

### MCP Client (src/mcp/client.ts)

Model Context Protocol client for external tool integration:
- Connects to MCP servers via stdio or SSE
- Dynamically discovers and calls MCP tools
- Supports multiple server configurations

### Skills (src/skills/index.ts)

User-defined command templates:
- Stored in `~/.spica/skills/` as SKILL.md files
- Can be auto-triggered by input matching
- Support parameter templates `{param}`

### Hooks (src/hooks/index.ts)

Tool interception system:
- **PreToolUse**: Intercept before tool execution
- **PostToolUse**: Process after tool execution
- Actions: `none`, `warn`, `confirm`, `block`

## Event System

SpicaAgent emits events for UI updates:

```typescript
// Stream events
'stream', 'reasoning', 'tool_call', 'tool_result'

// State events
'waiting_for_llm', 'agent_interrupted', 'context_compressed', 'context_warning'

// Error events
'error_suggestion', 'connection_error', 'retry_attempt'

// Session events
'message', 'skill_auto_triggered', 'permission_request', 'bypass_changed'

// Sub-agent events
'sub_agent_start', 'sub_agent_tool_call', 'sub_agent_done', 'sub_agent_error'
```

## Data Flow

### Normal Execution Flow

```
User Input → runLoop() → generate() → LLM Response → Tool Calls → executeTool() → Tool Results → continueWithToolResults() → LLM Response → Final Output
```

### Interrupt Flow

```
ESC ESC → stdin handler → agent.interrupt() → AbortController.abort() → Tool execution stops → agent_interrupted event → State saved
```

### Compression Flow

```
Context > 70% threshold → compact() → generateSummary() → [History Summary] message → Replace old messages → context_compressed event
```

## Storage

```
~/.spica/                    # Global config
├── config.json              # API providers
├── settings.json            # Skills, MCP, Hooks
└── skills/                  # Skill packages

<project>/.spica/            # Project-specific
├── session.json             # Current session
├── sessions/                # Archived sessions
├── state.json               # Project state
├── tasks.json               # Task persistence
└── learnings/               # Project learnings
```

## Security

### Shell Injection Detection

Blocked patterns in strict mode:
- `;`, `&&`, `||` - Command chaining
- `$()`, `${}` - Command/variable substitution
- `eval`, heredoc - Dynamic execution
- `/dev/tcp/`, `mkfifo`, `nc -l` - Network/backdoor

### Permission System

Dangerous operations require permission:
- `rm -rf` - Directory deletion
- `sudo`, `doas`, `run0` - Privilege escalation
- `git push --force` - Force push
- `git reset --hard` - Hard reset

### Bypass Mode

`/bypass` skips:
- Permission prompts
- Shell injection checks
- Hook confirmations

## Error Handling

See [ERROR_HANDLING.md](ERROR_HANDLING.md) for detailed strategy.

## Testing

```
npm run test:run              # Run all tests
npm run test:run -- <file>    # Run specific test
npm run test                  # Watch mode
```

Test categories:
- Unit tests: `src/__tests__/`
- Integration tests: `src/__tests__/integration/`
- Stress tests: `src/__tests__/stress/`
- Security tests: `src/__tests__/security/`

## Extension Points

1. **MCP Servers**: Add external tools via MCP
2. **Skills**: Define custom commands
3. **Hooks**: Intercept tool execution
4. **Providers**: Add new LLM providers

## Future Improvements

See task list for planned improvements:
- Architecture decoupling
- Runtime monitoring
- Enhanced security
- Better state management