#!/usr/bin/env node
import { writeFileSync, chmodSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binDir = join(__dirname, '..', 'bin');
const binPath = join(binDir, 'spica');
const cmdPath = join(binDir, 'spica.cmd');

mkdirSync(binDir, { recursive: true });

// Linux/macOS: Use bash wrapper to dynamically resolve tsconfig path
// This avoids project-specific tsconfig interference when running in Bun projects
const unixContent = `#!/bin/bash
# Resolve spica-cli directory (handles npm link scenarios)
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
if [ -f "\$SCRIPT_DIR/../tsconfig.json" ]; then
  # Development mode
  TSCONFIG="\$SCRIPT_DIR/../tsconfig.json"
  SRC="\$SCRIPT_DIR/../src/index.ts"
elif [ -f "\$SCRIPT_DIR/../lib/node_modules/spica-cli/tsconfig.json" ]; then
  # Global npm install mode
  TSCONFIG="\$SCRIPT_DIR/../lib/node_modules/spica-cli/tsconfig.json"
  SRC="\$SCRIPT_DIR/../lib/node_modules/spica-cli/src/index.ts"
else
  # Fallback: use npx tsx without tsconfig (may have issues in Bun projects)
  exec npx tsx "\$SCRIPT_DIR/../src/index.ts" "\$@"
fi
exec npx tsx --tsconfig "\$TSCONFIG" "\$SRC" "\$@"
`;

writeFileSync(binPath, unixContent, 'utf-8');

// Windows .cmd wrapper - use relative path for tsconfig
const winContent = `@echo off
set TSCONFIG=%~dp0..\\tsconfig.json
set SRC=%~dp0..\\src\\index.ts
if exist "%~dp0..\\lib\\node_modules\\spica-cli\\tsconfig.json" (
  set TSCONFIG=%~dp0..\\lib\\node_modules\\spica-cli\\tsconfig.json
  set SRC=%~dp0..\\lib\\node_modules\\spica-cli\\src\\index.ts
)
node "%~dp0..\\node_modules\\tsx\\dist\\cli.mjs" --tsconfig "%TSCONFIG%" "%SRC%" %*
`;

writeFileSync(cmdPath, winContent, 'utf-8');

try {
  chmodSync(binPath, 0o755);
} catch {
  // chmod not supported on Windows, skip silently
}
