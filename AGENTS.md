# AGENTS.md

## Dev environment tips
- Use `npm run dev` to start the CLI in development mode (tsx watch).
- Use `npm run build` to generate the executable `bin/spica` script.
- Use `npx tsc --noEmit` for type checking without building.
- Check `src/tools/index.ts` for all tool definitions before adding new tools.
- Import with ESM syntax: `import { x } from 'y'` (no default imports from fs/path).
- Run `npm run lint` to verify ESLint rules pass after moving files or changing imports.

## Testing instructions
- Run `npm run test:run` to execute all tests (285 tests, vitest).
- Run `npx vitest run <file-pattern>` to focus on specific test files.
- Run `npx vitest run -t "<test name>"` to focus on one test.
- Tests are in `src/__tests__/` and `src/**/__tests__/` directories.
- Fix any test or type errors before committing - the whole suite must pass.
- Add or update tests for code you change, even if nobody asked.

## Code style
- No comments unless explicitly requested.
- TypeScript strict mode, ESM modules, ES2022 target.
- Tool results: `{ success, output?, error?, content? }`.
- Use `resolvePath()` for relative path resolution.

## PR instructions
- Title format: `[spica] <Title>` or `[spica-cli] <Title>`.
- Always run `npm run lint` and `npm run test:run` before committing.
- Ensure build succeeds: `npm run build && ./bin/spica --version`.