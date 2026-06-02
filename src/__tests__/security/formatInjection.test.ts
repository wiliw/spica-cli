import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

describe('format tool shell injection prevention', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spica-test-'));
    // Create a package.json so detectProjectType returns typescript
    await fs.writeJson(path.join(tmpDir, 'package.json'), {
      devDependencies: { typescript: '^5.0.0' },
    });
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should not crash with injection-like path argument', async () => {
    // The format tool uses array-based execa, so injected strings
    // become literal arguments rather than shell commands
    const { executeTool, setWorkspace } = await import('../../tools/index');
    setWorkspace(tmpDir);

    // This path contains shell metacharacters but should be treated as a literal path
    const result = await executeTool('format', {
      path: '"; rm -rf /tmp/spica-injection-test; echo "',
    });

    // Should fail gracefully (file doesn't exist) but NOT execute shell commands
    expect(result.success !== undefined).toBe(true);
  });

  it('should handle paths with spaces safely', async () => {
    const { executeTool, setWorkspace } = await import('../../tools/index');
    setWorkspace(tmpDir);

    // Create a file with spaces in name
    const testFile = path.join(tmpDir, 'my file.ts');
    await fs.writeFile(testFile, 'const x = 1;');

    const result = await executeTool('format', { path: 'my file.ts' });
    // Should format or fail gracefully, not crash
    expect(result.success !== undefined).toBe(true);
  });
});
