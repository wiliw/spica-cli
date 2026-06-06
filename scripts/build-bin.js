#!/usr/bin/env node
import { writeFileSync, chmodSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binDir = join(__dirname, '..', 'bin');
const binPath = join(binDir, 'spica');
const cmdPath = join(binDir, 'spica.cmd');

mkdirSync(binDir, { recursive: true });

// Linux/macOS shebang script
const unixContent = `#!/usr/bin/env -S npx tsx
import('../src/index.ts');
`;

writeFileSync(binPath, unixContent, 'utf-8');

// Windows .cmd wrapper
const winContent = `@echo off
node "%~dp0\\..\\node_modules\\tsx\\dist\\cli.mjs" "%~dp0\\..\\src\\index.ts" %*
`;

writeFileSync(cmdPath, winContent, 'utf-8');

try {
  chmodSync(binPath, 0o755);
} catch {
  // chmod not supported on Windows, skip silently
}
