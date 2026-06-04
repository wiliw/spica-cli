# AGENTS.md

## Project Overview

spica-cli is an AI coding agent CLI with interactive and single-task modes. It supports multiple LLM providers, MCP servers, and a skill system for extending capabilities.

**Entry points:**
- `src/index.ts` - CLI entry, command parsing, interactive mode
- `src/agent.ts` - Core agent loop, tool execution, message handling

**Key directories:**
- `src/llm/providers/` - LLM provider implementations (OpenAI-compatible)
- `src/tools/index.ts` - All tool definitions (file, shell, git, web, etc.)
- `src/skills/` - Skill system (loading, execution)
- `src/cli/` - TUI, events, input handling
- `src/core/RuntimeState.ts` - Single source of truth for runtime state

## Build

```bash
npm install           # Install dependencies
npm run build         # Build CLI (generates bin/spica and dist/)
./bin/spica --version # Verify build (outputs: 1.0.0)
npx tsc --noEmit      # Type check without building
```

## Test

```bash
npm run test:run                    # Run all tests (vitest, ~900 tests)
npm run test:run -- src/__tests__/  # Run only src tests (exclude dist)
npx vitest run <file-pattern>       # Run specific test file
npx vitest run -t "<test name>"     # Run specific test by name
npm run test:run -- --coverage      # Run with coverage
```

**Test locations:** `src/__tests__/` and `src/**/__tests__/`

**Current status:** 5 tests fail in `boundaryCases.test.ts` (interrupt/compression edge cases) and 1 in `rateLimiterCleanup.test.js` (dist). These are known issues.

## Lint

```bash
npm run lint         # Run ESLint (warnings allowed)
npm run lint:fix     # Auto-fix lint issues
npm run lint:strict  # Fail on warnings (not used in CI)
```

**Config:** `eslint.config.js` - TypeScript strict, `@typescript-eslint/no-explicit-any` is warning.

## Code Style

- TypeScript ES2022 target, ESM modules, strict mode
- No comments unless explicitly requested
- Import style: `import { x } from 'y'` (ESM named imports)
- Tool results: `{ success, output?, error?, content? }`
- Path resolution: Use `resolvePath()` for relative paths
- Shell commands: Use array-based `execa` to prevent injection — never string interpolation
- `RuntimeState` is the single source of truth — never use raw globals

## PR Workflow

1. Run `npm run lint` and `npm run test:run` before committing
2. Ensure build succeeds: `npm run build && ./bin/spica --version`
3. Title format: `[spica] <Title>` or `[spica-cli] <Title>`
4. CI runs on: Node 18, 20, 22 on ubuntu-latest and windows-latest

**CI checks:** type check → lint → test → build (see `.github/workflows/ci.yml`)

## Dev Tips

- Use `npm run dev` for development mode (tsx watch)
- Agent events via `SpicaAgent` (EventEmitter), UI subscribes in `src/cli/events.ts`
- spica reads its own AGENTS.md at runtime via `loadProjectConfig()` — keep it parseable
- Large files needing refactor: `src/agent.ts` (many concerns), `src/index.ts` (953 lines)

## Architecture Notes

- **Tool conflict detection:** Tools operating on same resource are sequenced (see `detectToolConflicts` in agent.ts)
- **Message cleaning:** Orphaned tool messages are auto-cleaned before API calls
- **Compression:** Context compression triggers at token threshold, preserves recent messages
- **Interrupt handling:** ESC ESC triggers graceful interrupt, preserves tool results
