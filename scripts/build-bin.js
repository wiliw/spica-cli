#!/usr/bin/env node
import { writeFileSync, chmodSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binDir = join(__dirname, '..', 'bin');
const binPath = join(binDir, 'spica');

mkdirSync(binDir, { recursive: true });

const content = `#!/usr/bin/env -S npx tsx
import('../src/index.ts');
`;

writeFileSync(binPath, content, 'utf-8');

try {
  chmodSync(binPath, 0o755);
} catch {
  // chmod not supported on Windows, skip silently
}
