// AGENTS.md — open standard for guiding coding agents (https://agents.md/)
// AGENTS.md is prose that agents read directly, NOT a machine-parseable data format.
// We only auto-detect project info as fallback when no AGENTS.md exists.

import fs from 'fs-extra';
import { join } from 'path';

export interface ProjectConfig {
  type?: string;
  language?: string;
  framework?: string;
  commands?: {
    build?: string;
    test?: string;
    dev?: string;
    lint?: string;
  };
  // Raw AGENTS.md content — injected directly into system prompt
  rawContent?: string;
}

const CONFIG_FILE = 'AGENTS.md';

// Load AGENTS.md as raw prose content (per standard: no parsing, agents read it directly)
export function loadProjectConfig(workspace: string): ProjectConfig | null {
  const filepath = join(workspace, CONFIG_FILE);
  if (fs.existsSync(filepath)) {
    const content = fs.readFileSync(filepath, 'utf-8');
    return { rawContent: content };
  }
  return null;
}

// Auto-detect project info from config files (fallback when no AGENTS.md)
export function autoDetectProject(workspace: string): ProjectConfig {
  const config: ProjectConfig = {};

  const pkgPath = join(workspace, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = fs.readJsonSync(pkgPath);
      config.type = 'Node.js';
      config.language = pkg.devDependencies?.typescript ? 'TypeScript' : 'JavaScript';
      config.commands = {
        build: pkg.scripts?.build || 'npm run build',
        test: pkg.scripts?.test || 'npm test',
        dev: pkg.scripts?.dev || 'npm run dev',
        lint: pkg.scripts?.lint || 'npm run lint',
      };
      const deps = pkg.dependencies || {};
      if (deps.next) config.framework = 'Next.js';
      else if (deps.react) config.framework = 'React';
      else if (deps.vue) config.framework = 'Vue';
      else if (deps.express) config.framework = 'Express';
      return config;
    } catch {}
  }

  const goModPath = join(workspace, 'go.mod');
  if (fs.existsSync(goModPath)) {
    return { type: 'Go', language: 'Go', commands: { build: 'go build', test: 'go test ./...', dev: 'go run .' } };
  }

  const pyprojectPath = join(workspace, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath) || fs.existsSync(join(workspace, 'requirements.txt'))) {
    return { type: 'Python', language: 'Python', commands: { test: 'pytest', dev: 'python main.py' } };
  }

  const cargoPath = join(workspace, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    return { type: 'Rust', language: 'Rust', commands: { build: 'cargo build', test: 'cargo test', dev: 'cargo run' } };
  }

  return { type: 'Unknown', language: 'Unknown' };
}

// Generate AGENTS.md scaffold (AGENTS.md standard sections)
export function generateAgentsMd(config: ProjectConfig): string {
  const dev = config.commands?.dev || 'npm run dev';
  const build = config.commands?.build || 'npm run build';
  const testCmd = config.commands?.test || 'npm test';
  const lint = config.commands?.lint || 'npm run lint';

  return `# AGENTS.md

## Dev environment tips
- Start the dev server: \`${dev}\`
- Build for production: \`${build}\`
${lint ? `- Lint before committing: \`${lint}\`\n` : ''}
## Testing instructions
- Run \`${testCmd}\` to execute all tests.
- Fix any test or type errors before committing — the whole suite must pass.
- Add or update tests for code you change, even if nobody asked.

## Code style
- (add project-specific conventions here)

## PR instructions
- (add PR title format, pre-commit checklist)
`;
}

// Create AGENTS.md file
export async function createAgentsMd(workspace: string): Promise<string> {
  const config = autoDetectProject(workspace);
  const content = generateAgentsMd(config);
  const filepath = join(workspace, CONFIG_FILE);
  await fs.writeFile(filepath, content);
  return filepath;
}
