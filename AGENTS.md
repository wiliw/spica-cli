# AGENTS.md

## Project Overview

spica-cli is an AI coding agent CLI with interactive and single-task modes. It supports multiple LLM providers, MCP servers, and a skill system for extending capabilities.

**Entry points:**
- `src/index.ts` - CLI entry, command parsing, interactive mode (~1584 lines)
- `src/agent.ts` - Core agent loop (`SpicaAgent` class), tool execution dispatch, message handling, conflict detection, compression (~1577 lines)
- `src/tools/execute.ts` - All tool execution logic (~1891 lines)
- `src/tools/registry.ts` - All tool definitions (names, descriptions, parameters)
- `src/prompts/system.ts` - System prompt assembly, AGENTS.md loading, learnings injection (~233 lines)
- `src/cli/ui/screenManager.ts` - TUI rendering, input handling, thinking animation (~790 lines)

**Key directories:**
- `src/llm/providers/` - LLM provider implementations (BaseProvider, OpenAICompatible)
- `src/tools/` - Tool definitions (`registry.ts`), execution (`execute.ts`), helpers (`helpers.ts`), subagents (`subAgent.ts`), and type-specific impls (`impl/`)
- `src/skills/` - Skill loading and invocation (`index.ts`, ~371 lines)
- `src/cli/` - TUI (`ui/`), events, input handling, diff rendering
- `src/core/RuntimeState.ts` - Single source of truth for runtime state (~231 lines)
- `src/core/EventBus.ts` - Event system
- `src/core/ProcessMonitor.ts` - Background process monitoring
- `src/storage/` - Checkpoint manager, project state persistence, task persistence
- `src/mcp/` - MCP client (`client.ts`)
- `src/hooks/` - Pre/post hook execution (`index.ts`)
- `src/utils/` - Settings, project config, session, history, platform, message cleaner
- `src/builtin-skills/superpowers/` - Built-in skills (14 skills)

**Stats:** 60 source files, 61 test files (126 `.ts` files total)

## Build

```bash
npm install           # Install dependencies
npm run build         # Generate CLI wrapper scripts (bin/spica, bin/spica.cmd)
./bin/spica --version # Verify build (outputs: 1.0.0)
npx tsc --noEmit      # Type check without building (0 errors)
```

**Build pipeline:** `npm run build` → `npm run build:cli` → `node scripts/build-bin.js`

**Build outputs:**
- `bin/spica` - Unix/macOS bash wrapper that resolves tsconfig path and runs via `npx tsx`
- `bin/spica.cmd` - Windows cmd wrapper

**Runtime:** The project uses `tsx` (TypeScript runner) — there is no compiled `dist/` output from `npm run build`. TypeScript declarations output to `dist/` but are not part of the build pipeline.

**Dev mode:** `npm run dev` runs `tsx src/index.ts` directly (no watch mode).

## Test

```bash
npm run test:run                    # Run all 649 tests (61 files, vitest)
npm run test:run -- src/__tests__/  # Run only src tests (exclude dist)
npx vitest run <file-pattern>       # Run specific test file
npx vitest run -t "<test name>"     # Run specific test by name
npm run test:run -- --coverage      # Run with coverage (requires @vitest/coverage-v8)
```

**Test locations:** `src/__tests__/` and `src/**/__tests__/`

**Test environment:** vitest 1.6, `environment: 'node'`, `globals: true` (no need to import `describe`/`it`/`expect`). Config in `vitest.config.ts`.

**Coverage:** Uses v8 provider. Coverage excludes `src/builtin-skills/`.

**Known issues:** 2 tests fail in `src/tools/__tests__/toolsCore.test.ts` (syntax check timeouts at 5000ms). `boundaryCases.test.ts` passes (13/13). CI sets `SKIP_API_TESTS: true` and `CI: true`.

## Lint

```bash
npm run lint         # Run ESLint on src/**/*.ts (0 errors, 82 warnings)
npm run lint:fix     # Auto-fix lint issues (3 warnings fixable)
npm run lint:strict  # Fail on warnings (--max-warnings 0, not used in CI)
```

**Config:** `eslint.config.js` — `@eslint/js` recommended + `typescript-eslint` recommended. Rules:
- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: warn (argsIgnorePattern/VarsIgnorePattern: `^_`)
- `no-console`: off, `no-var`: error, `prefer-const`: warn

**Ignores:** `dist`, `node_modules`, `**/*.test.ts`, `**/*.spec.ts`, `bin`

CI only runs lint on Node >= 20.

## Format

```bash
npx prettier --write <file>   # Format file with prettier
npx prettier --check <file>   # Check formatting only
```

**Config (`.prettierrc`):**
- `singleQuote: true`, `semi: true`
- `printWidth: 100`, `tabWidth: 2`, `useTabs: false`
- `trailingComma: "es5"`, `arrowParens: "avoid"`
- `endOfLine: "lf"`, `bracketSpacing: true`

**Also see `.editorconfig`:** utf-8, lf, 2-space indent, insert_final_newline

**Note:** `src/index.ts` currently has prettier formatting warnings — run `npx prettier --write src/index.ts` if needed.

## Code Style

- TypeScript `ES2022` target, `ESNext` modules, `"type": "module"` in package.json
- `moduleResolution: "bundler"`, `jsx: "react"` (for ink/react in some paths)
- `noImplicitAny: false` — explicit `any` allowed (warning only via ESLint)
- No comments unless explicitly requested
- Import style: `import { x } from 'y'` (ESM named imports)
- Tool results: `{ success, output?, error?, content?, diff?, syntaxErrors? }`
- Path resolution: Use `resolvePath()` from `src/tools/helpers.ts` for relative paths
- Shell commands: Use array-based `execa` to prevent injection — never string interpolation
- Project state: `RuntimeState` (in `src/core/RuntimeState.ts`) is the single source of truth — never use raw globals

## PR Workflow

1. Run `npm run lint` and `npm run test:run` before committing
2. Ensure build succeeds: `npm run build && ./bin/spica --version`
3. Title format: `[spica] <Title>` or `[spica-cli] <Title>`
4. CI runs on: Node 18, 20, 22 on ubuntu-latest and windows-latest

**CI checks (in order):** `npm ci` → `npx tsc --noEmit` → `npm run lint` (Node >= 20 only) → `npm run test:run` (CI=true, SKIP_API_TESTS=true) → `npm run build`
See `.github/workflows/ci.yml` for full details.

## Architecture Notes

### System Prompt Layers (in order, highest priority first)
1. **AGENTS.md content** — injected as raw prose, parsed for rule layers (CRITICAL > IMPORTANT > PREFERENCES)
2. **Bootstrap skill** — `using-superpowers` auto-injected to guide skill usage
3. **Base identity** — `SYSTEM_PROMPT` constant in `src/prompts/system.ts`
4. **File-scoped commands** — table of preferred scoped commands
5. **Learnings** — from `.spica/learnings/` markdown files
6. **Skills metadata** — brief listing of available skills

### Tool Architecture
- **Definitions:** `src/tools/registry.ts` — all tool schemas (`TOOLS_DEFINITIONS` array)
- **Execution:** `src/tools/execute.ts` — giant switch statement dispatching to impl modules
- **Barrel:** `src/tools/index.ts` — re-exports (12 lines only)
- **Impl modules:** `src/tools/impl/` — `file_read.ts`, `file_manage.ts`, `glob.ts`, `grep.ts`, `directory.ts`, `workspace.ts`, `todo.ts`, `question.ts`, `skill.ts`
- **Specialized tools:** `codeHealth.ts`, `testQuality.ts`, `subAgent.ts`

### Key Mechanisms
- **Tool conflict detection:** `detectToolConflicts()` in `agent.ts` — tools operating on same resource path are sequenced
- **Message cleaning:** Orphaned tool messages (result without call or vice versa) are auto-cleaned before API calls
- **Context compression:** Triggers at token threshold, preserves recent messages, uses compact prompt
- **Interrupt handling:** ESC ESC triggers graceful interrupt via `AbortController`, preserves tool results
- **Subagent early exit:** When one subagent finds a definitive result, siblings are signaled to stop (saves tokens)
- **Stuck detection:** Bash commands are killed after `stuckWarningMs` (default 120s) with `SIGKILL` to the process group

### Subagent Types
| Type | Allowed Tools | Timeout | Description |
|------|-------------|---------|-------------|
| `explore` | glob, grep, file_read, directory_list, file_exists | 30s | Read-only exploration |
| `review` | explore + lint | 60s | Code review, find issues |
| `fix` | file_read, file_edit, bash, lint | 120s | Fix specific issues |
| `build` | * (all tools) | 180s | Full feature implementation |

### Git Safety
- `checkout` checks for uncommitted changes before switching, suggests stash workflow
- `reset` (hard/mixed) checks for uncommitted changes, requires user confirmation
- `checkpoint_restore` finds `[SPICA-CHECKPOINT]` commits and restores safely

## Skills System

**Built-in skills (14 total):**
`brainstorming`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `executing-plans`, `writing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `finishing-a-development-branch`, `using-git-worktrees`, `writing-skills`, `using-superpowers`

**Skill locations:**
- Built-in: `src/builtin-skills/superpowers/` (each skill is a subdirectory)
- Project: `.spica/skills/`

**Installation:**
```bash
spica skill install <github-url>
spica skill list
```

## Config Locations

```
~/.spica/settings.json  # Global config (providers, mcp, skills, hooks)
<project>/.spica/       # Project session (checkpoints, history, learnings, tasks)
```

## Checkpoint System

**File-based, no git pollution:**

```
.spica/
├── checkpoints.json       # Checkpoint metadata list
├── snapshots/
│   ├── <timestamp>/       # File snapshots
│   │   ├── src/...
│   │   └── metadata.json
│   └── ...
└── backups/               # Single file backups (auto-created by file_write)
```

**Commands:**
```bash
spica checkpoint list              # List all checkpoints
spica checkpoint show <id>         # Show checkpoint details
spica checkpoint restore <id>      # Restore files from checkpoint
spica checkpoint clean             # Clean old checkpoints (keep 20)
```

## Learnings System

When the user corrects the AI, write a new `.spica/learnings/YYYY-MM-DD-topic.md` file. These are auto-loaded into the system prompt on every session start. Format: freeform markdown, one lesson per file.

**Current learnings:**
- `2026-05-30-learnings-mechanism.md` — How the learnings system works
- `2026-06-05-subagent-superpowers-issue.md` — Subagent/superpowers integration issue (workaround: use `executing-plans` skill instead)

## Security Considerations

- Never commit API keys or secrets
- Provider credentials stored in `~/.spica/settings.json`
- Shell commands use `execa` with array arguments to prevent injection
- Bash command injection detection blocks: `/dev/tcp/`, `nc -l/-e`, `mkfifo`, piping to interpreters, `eval`
- File operations validate paths against directory traversal
- Use environment variables for sensitive config: `GITHUB_TOKEN`, `TAVILY_API_KEY`, `HTTPS_PROXY`

## Dependencies

**Runtime:** `execa` (shell), `simple-git` (git), `fast-glob` (glob), `fs-extra` (file ops), `openai` (LLM client), `@modelcontextprotocol/sdk` (MCP), `commander` (CLI parsing), `chalk` (output), `node-pty` (interactive terminal), `ora` (spinners), `prompts` (user prompts), `axios` (HTTP), `https-proxy-agent`

**Dev:** `tsx` (TypeScript runner), `typescript` 5.4, `vitest` 1.6, `eslint` 10, `typescript-eslint` 8
