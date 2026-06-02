import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import simpleGit from 'simple-git';
import { SpicaAgent } from '../../agent';

describe('git reset confirmation bypass', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spica-test-'));
    const git = simpleGit(tmpDir);
    await git.init();
    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'content');
    await git.add('test.txt');
    await git.commit('initial commit');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should require permission for git reset regardless of userConfirmed parameter', () => {
    const agent = new SpicaAgent(undefined, tmpDir);
    const agentAny = agent as any;
    const reason = agentAny.checkNeedsPermission('git', {
      action: 'reset',
      args: { mode: 'hard', userConfirmed: true },
    });

    expect(reason).not.toBeNull();
  });

  it('should require permission for git reset with userConfirmed false', () => {
    const agent = new SpicaAgent(undefined, tmpDir);
    const agentAny = agent as any;
    const reason = agentAny.checkNeedsPermission('git', {
      action: 'reset',
      args: { mode: 'hard', userConfirmed: false },
    });

    expect(reason).not.toBeNull();
  });

  it('should require permission for soft reset too', () => {
    const agent = new SpicaAgent(undefined, tmpDir);
    const agentAny = agent as any;
    const reason = agentAny.checkNeedsPermission('git', {
      action: 'reset',
      args: { mode: 'soft' },
    });

    expect(reason).not.toBeNull();
  });
});
