# AGENTS.md

## Dev environment tips

- Use `npm run dev` to start the CLI in development mode (tsx watch).
- Use `npm run build` to generate the executable `bin/spica` script.
- Use `npx tsc --noEmit` for type checking without building.
- Check `src/tools/index.ts` for all tool definitions before adding new tools.
- Import with ESM syntax: `import { x } from 'y'` (no default imports from fs/path).
- After adding dependencies, run `npm install` and restart the dev server.
- Agent events are emitted by `SpicaAgent` (EventEmitter). UI subscribes in `src/cli/events.ts`.
- `RuntimeState` (`src/core/RuntimeState.ts`) is the single source of truth for runtime state — use it, never raw globals.

## Testing instructions

- Run `npm run test:run` to execute all tests (182 tests, 25 test files, vitest).
- Run `npx vitest run <file-pattern>` to focus on specific test files.
- Run `npx vitest run -t "<test name>"` to focus on one test.
- Tests are in `src/__tests__/` and `src/**/__tests__/` directories.
- Fix any test or type errors before committing — the whole suite must pass.
- Add or update tests for code you change, even if nobody asked.
- Use `npx vitest run src/__tests__/` to exclude `node_modules` test files.

## Code style

- TypeScript strict mode, ESM modules, ES2022 target.
- No comments unless explicitly requested.
- Tool results: `{ success, output?, error?, content? }`.
- Use `resolvePath()` for relative path resolution.
- Shell commands use array-based `execa` to prevent injection — never string interpolation.

## PR instructions

- Title format: `[spica] <Title>` or `[spica-cli] <Title>`.
- Always run `npm run lint` and `npm run test:run` before committing.
- Ensure build succeeds: `npm run build && ./bin/spica --version`.

## Project notes

- spica is an AI coding agent CLI. Entry: `src/index.ts`, core loop: `src/agent.ts`.
- LLM providers in `src/llm/providers/`. Tools in `src/tools/index.ts`.
- Large files to watch: `src/agent.ts` (many concerns), `src/index.ts` (953 lines, planned refactor to `cli/interactive.ts`).
- spica reads its own AGENTS.md at runtime via `loadProjectConfig()` — keep it parseable.
