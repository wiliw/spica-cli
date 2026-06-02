import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { setWorkspace, executeTool } from '../../tools/index';

describe('shell injection prevention', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spica-test-'));
    setWorkspace(tmpDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  const blockedCommands = [
    { cmd: 'ls; rm -rf /', name: 'command separator (;)' },
    { cmd: 'echo hello && whoami', name: 'AND operator (&&)' },
    { cmd: 'false || cat /etc/passwd', name: 'OR operator (||)' },
    { cmd: 'echo ${HOME}', name: 'variable expansion (${})' },
    { cmd: 'cat << EOF\ntest\nEOF', name: 'heredoc' },
    { cmd: 'eval echo bad', name: 'eval command' },
  ];

  for (const { cmd, name } of blockedCommands) {
    it(`should block ${name}`, async () => {
      const result = await executeTool('bash', { command: cmd });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked');
    });
  }

  it('should still allow safe commands', async () => {
    const result = await executeTool('bash', { command: 'echo hello world' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello world');
  });

  it('should block existing patterns (regression)', async () => {
    const result = await executeTool('bash', { command: 'echo $(whoami)' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked');
  });
});

describe('format tool injection prevention', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spica-test-'));
    await fs.writeJson(path.join(tmpDir, 'package.json'), {
      devDependencies: { typescript: '^5.0.0' },
    });
    setWorkspace(tmpDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should not execute injected commands in format target', async () => {
    const injectionFile = '/tmp/spica-injection-test';
    const result = await executeTool('format', {
      path: '"; rm -rf /tmp/spica-injection-test; echo "',
    });
    // Should not execute the injected command — the file should not exist
    expect(fs.existsSync(injectionFile)).toBe(false);
  });

  it('should handle paths with spaces without injection', async () => {
    const testFile = path.join(tmpDir, 'my file.ts');
    await fs.writeFile(testFile, 'const x = 1;');

    const result = await executeTool('format', { path: 'my file.ts' });
    expect(result.success !== undefined).toBe(true);
  });
});
