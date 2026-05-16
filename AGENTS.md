# AGENTS.md

## Project
- Type: Node.js
- Language: TypeScript

## Dev environment
- Start: ` tsx src/index.ts`

## Build
- Build: ` npm run build:cli`

## Testing
- Test: ` vitest`
- Run tests before committing

## Architecture
- Entry: ` src/index.ts`
- Modules: cli, core, external, hooks, llm, mcp, prompts, skills, storage, tools, utils
- Patterns: EventEmitter pattern, Plugin system, CLI tool, Tools system, Skills system
- Key files: CLAUDE.md, README.md, tsconfig.json, vitest.config.ts

## Code style
- No comments unless explicitly requested
- Prefer concise, readable code

## Tips
- Start: ` tsx src/index.ts`
