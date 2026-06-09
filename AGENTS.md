# AGENTS.md

## Project Overview

spica-cli is an AI coding agent CLI with interactive and single-task modes. It supports multiple LLM providers, MCP servers, and a skill system for extending capabilities.

**Entry points:**
- `src/index.ts` - CLI entry, command parsing, interactive mode (1570 lines)
- `src/agent.ts` - Core agent loop, tool execution, message handling (1555 lines)
- `src/tools/index.ts` - All tool definitions (3251 lines)
- `src/cli/ui/screenManager.ts` - TUI rendering, input handling, thinking animation (715 lines)

**Key directories:**
- `src/llm/providers/` - LLM provider implementations (OpenAI-compatible)
- `src/tools/index.ts` - All tool definitions (file, shell, git, web, etc.)
- `src/skills/` - Skill system (loading, execution)
- `src/cli/` - TUI, events, input handling
- `src/core/RuntimeState.ts` - Single source of truth for runtime state
- `src/builtin-skills/superpowers/` - Built-in skills (14 skills)

**Stats:** 52 source files, 61 test files

## Build

```bash
npm install           # Install dependencies
npm run build         # Build CLI (generates bin/spica and dist/)
./bin/spica --version # Verify build (outputs: 1.0.0)
npx tsc --noEmit      # Type check without building
```

Build outputs:
- `bin/spica` - Executable CLI script
- `dist/` - Compiled JavaScript and type declarations

## Test

```bash
npm run test:run                    # Run all tests (vitest)
npm run test:run -- src/__tests__/  # Run only src tests (exclude dist)
npx vitest run <file-pattern>       # Run specific test file
npx vitest run -t "<test name>"     # Run specific test by name
npm run test:run -- --coverage      # Run with coverage
```

**Test locations:** `src/__tests__/` and `src/**/__tests__/`

**Known issues:** 9 tests fail in `boundaryCases.test.ts` (interrupt/compression edge cases). These are expected failures related to async interrupt handling and test timeouts.

## Lint

```bash
npm run lint         # Run ESLint (0 errors, 72 warnings)
npm run lint:fix     # Auto-fix lint issues
npm run lint:strict  # Fail on warnings (not used in CI)
```

**Config:** `eslint.config.js` - TypeScript strict, `@typescript-eslint/no-explicit-any` is warning only. Test files excluded from lint.

## Code Style

- TypeScript ES2022 target, ESM modules, strict mode
- No comments unless explicitly requested
- Import style: `import { x } from 'y'` (ESM named imports)
- Tool results: `{ success, output?, error?, content? }`
- Path resolution: Use `resolvePath()` for relative paths
- Shell commands: Use array-based `execa` to prevent injection — never string interpolation
- `RuntimeState` is the single source of truth — never use raw globals

## Format

```bash
npx prettier --write <file>   # Format file with prettier
npx prettier --check <file>   # Check formatting only
```

**Config:** `.prettierrc` — single quotes, 100 char width, ES5 trailing commas, LF line endings.
Also see `.editorconfig` for editor-agnostic settings.

## PR Workflow

1. Run `npm run lint` and `npm run test:run` before committing
2. Ensure build succeeds: `npm run build && ./bin/spica --version`
3. Title format: `[spica] <Title>` or `[spica-cli] <Title>`
4. CI runs on: Node 18, 20, 22 on ubuntu-latest and windows-latest

**CI checks:** type check → lint → test → build (see `.github/workflows/ci.yml`)

## Skills System

spica has a built-in skill system for extending AI capabilities:

**Built-in skills (14 total):**
- `brainstorming` - Use before creative work
- `systematic-debugging` - Use for bugs/test failures
- `test-driven-development` - Use before implementing features
- `verification-before-completion` - Use before claiming done
- `requesting-code-review` - Use after completing tasks
- `receiving-code-review` - Use when receiving review feedback
- `executing-plans` - Use when executing written plans
- `writing-plans` - Use for multi-step tasks
- `subagent-driven-development` - Use for parallel independent tasks
- `dispatching-parallel-agents` - Use for 2+ independent tasks
- `finishing-a-development-branch` - Use when implementation complete
- `using-git-worktrees` - Use for isolated feature work
- `writing-skills` - Use when creating/editing skills
- `using-superpowers` - Bootstrap skill (auto-injected in system prompt)

**Skill installation:**
```bash
spica skill install <github-url>   # Install skill from GitHub
spica skill list                   # List available skills
```

**Skill locations:**
- Built-in: `src/builtin-skills/` (copied to `~/.spica/skills/` on first run)
- Project: `.spica/skills/` (project-specific skills)

## Dev Tips

- Use `npm run dev` for development mode (`tsx src/index.ts` with watch)
- Agent events via `SpicaAgent` (EventEmitter), UI subscribes in `src/cli/events.ts`
- spica reads its own AGENTS.md at runtime via `loadProjectConfig()` — keep it parseable
- Large files needing refactor: `src/agent.ts`, `src/index.ts`, `src/tools/index.ts`
- Always prefer file-scoped commands over project-wide: `npx tsc --noEmit <file>` instead of `npm run typecheck`
- Run independent tools in parallel; conflicting tools (same file) are sequenced automatically

## Architecture Notes

- **Tool conflict detection:** Tools operating on same resource are sequenced (see `detectToolConflicts` in agent.ts)
- **Message cleaning:** Orphaned tool messages are auto-cleaned before API calls
- **Compression:** Context compression triggers at token threshold, preserves recent messages
- **Interrupt handling:** ESC ESC triggers graceful interrupt, preserves tool results
- **Bootstrap skill:** `using-superpowers` is auto-injected in system prompt to guide skill usage

## Security Considerations

- Never commit API keys or secrets to the repository
- Provider credentials stored in `~/.spica/settings.json` (user's home directory)
- Shell commands use `execa` with array arguments to prevent injection
- File operations validate paths to prevent directory traversal
- Use environment variables for sensitive configuration (e.g., `GITHUB_TOKEN`, `TAVILY_API_KEY`)

## Config Locations

```
~/.spica/settings.json  # Global config (providers, mcp, skills, hooks)
<project>/.spica/       # Project session (checkpoints, history, learnings)
```

## Checkpoint System

spica uses a file-based checkpoint system that **does not pollute git history**:

**How it works:**
- Before each AI operation, spica creates a file snapshot in `.spica/snapshots/<id>/`
- Checkpoint metadata is stored in `.spica/checkpoints.json`
- No git commits are created - your git history stays clean

**Commands:**
```bash
spica checkpoint list              # List all checkpoints
spica checkpoint show <id>         # Show checkpoint details
spica checkpoint restore <id>      # Restore files from checkpoint
spica checkpoint clean             # Clean old checkpoints (keep 20)
```

**Storage:**
```
.spica/
├── checkpoints.json       # Checkpoint metadata list
├── snapshots/
│   ├── 2026-06-04T10:00/  # File snapshots by timestamp
│   │   ├── src/index.ts
│   │   ├── src/tools/index.ts
│   │   └── metadata.json
│   └── ...
└── backups/               # Single file backups (by file tools)
```

**Recovery:**
- Use `spica checkpoint restore <id>` to restore files from any checkpoint
- Checkpoints are automatically created before each AI operation
- Old checkpoints are cleaned automatically (keep last 20)

## Learnings System

When the user corrects the AI, write a new `.spica/learnings/YYYY-MM-DD-topic.md` file.

These are auto-loaded into the system prompt on every session start via `getSystemPrompt()` in `src/prompts/system.ts`.

**Format:** Freeform markdown. Keep it concise — one lesson per file.

**Current learnings:**
- `2026-05-30-learnings-mechanism.md` - How the learnings system works
- `2026-06-05-subagent-superpowers-issue.md` - Known issue with subagent/superpowers integration