import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { SpicaAgent } from '../../agent';

describe('init error cleanup', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spica-test-'));
    // Create a package.json so agent can load project config
    await fs.writeJson(path.join(tmpDir, 'package.json'), {
      devDependencies: { typescript: '^5.0.0' },
    });
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should clear _initPromise after connection failure', async () => {
    // Create agent with invalid provider that will fail connection
    const agent = new SpicaAgent('nonexistent-provider', tmpDir);
    const agentAny = agent as any;

    // First init should fail
    try {
      await agentAny.init();
    } catch {
      // Expected failure
    }

    // Verify _initPromise is cleaned up (null) after failure
    expect(agentAny._initPromise).toBeNull();
    expect(agentAny._initialized).toBe(false);
  });

  it('should allow re-init after initial failure', async () => {
    const agent = new SpicaAgent('nonexistent-provider', tmpDir);
    const agentAny = agent as any;

    // First attempt fails
    try {
      await agentAny.init();
    } catch {
      // Expected
    }

    // _initPromise should be null, allowing re-init
    expect(agentAny._initPromise).toBeNull();
  });

  it('should not double-init if already initialized', async () => {
    const agent = new SpicaAgent(undefined, tmpDir);
    const agentAny = agent as any;

    // Force _initialized to true
    agentAny._initialized = true;

    // init() should return immediately
    const result = await agentAny.init();
    expect(result).toBeUndefined();
  });
});
