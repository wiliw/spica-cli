import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { setWorkspace, executeTool } from '../../tools/index';

describe('resolvePath symlink traversal', () => {
  let tmpDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spica-test-'));
    workspaceDir = path.join(tmpDir, 'workspace');
    await fs.ensureDir(workspaceDir);
    setWorkspace(workspaceDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should reject symlinks pointing outside workspace', async () => {
    const outsideFile = path.join(tmpDir, 'secret.txt');
    await fs.writeFile(outsideFile, 'sensitive data');

    const symlinkPath = path.join(workspaceDir, 'link-to-secret');
    await fs.symlink(outsideFile, symlinkPath);

    const result = await executeTool('file_read', { path: symlinkPath });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
    expect(result.error).toContain('symlink');
  });

  it('should allow symlinks pointing inside workspace', async () => {
    const insideFile = path.join(workspaceDir, 'real-file.txt');
    await fs.writeFile(insideFile, 'normal data');

    const symlinkPath = path.join(workspaceDir, 'link-to-inside');
    await fs.symlink(insideFile, symlinkPath);

    const result = await executeTool('file_read', { path: 'link-to-inside' });
    expect(result.success).toBe(true);
  });

  it('should allow normal files without symlinks', async () => {
    const normalFile = path.join(workspaceDir, 'normal.txt');
    await fs.writeFile(normalFile, 'hello');

    const result = await executeTool('file_read', { path: 'normal.txt' });
    expect(result.success).toBe(true);
  });
});
