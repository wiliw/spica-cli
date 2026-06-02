import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpicaAgent } from '../../agent.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import simpleGit from 'simple-git';
import type { SimpleGit } from 'simple-git';

describe('git reset permission check', () => {
  let agent: SpicaAgent;
  let tmpDir: string;
  let git: SimpleGit;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'spica-test-git-reset-'));
    git = simpleGit(tmpDir);
    await git.init();
    agent = new SpicaAgent(undefined, tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('requires permission for hard reset even with userConfirmed: true', () => {
    const result = (agent as any).checkNeedsPermission('git', {
      action: 'reset',
      args: { mode: 'hard', userConfirmed: true },
    });
    expect(result).not.toBeNull();
    expect(result).toBeTypeOf('string');
  });

  it('requires permission for hard reset with userConfirmed: false', () => {
    const result = (agent as any).checkNeedsPermission('git', {
      action: 'reset',
      args: { mode: 'hard', userConfirmed: false },
    });
    expect(result).not.toBeNull();
    expect(result).toBeTypeOf('string');
  });

  it('requires permission for soft reset even with userConfirmed: true', () => {
    const result = (agent as any).checkNeedsPermission('git', {
      action: 'reset',
      args: { mode: 'soft', userConfirmed: true },
    });
    expect(result).not.toBeNull();
    expect(result).toBeTypeOf('string');
  });
});
