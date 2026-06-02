import { describe, it, expect } from 'vitest';
import { SpicaAgent, InterruptError } from '../../agent';

describe('dangerous command detection', () => {
  it('should detect doas command', () => {
    const agent = new SpicaAgent(undefined, '/tmp');
    const agentAny = agent as any;
    const reason = agentAny.checkNeedsPermission('bash', {
      command: 'doas rm -rf /',
    });
    expect(reason).not.toBeNull();
    expect(reason).toContain('doas');
  });

  it('should detect run0 command', () => {
    const agent = new SpicaAgent(undefined, '/tmp');
    const agentAny = agent as any;
    const reason = agentAny.checkNeedsPermission('bash', {
      command: 'run0 cat /etc/shadow',
    });
    expect(reason).not.toBeNull();
    expect(reason).toContain('run0');
  });

  it('should still detect existing dangerous patterns', () => {
    const agent = new SpicaAgent(undefined, '/tmp');
    const agentAny = agent as any;

    const reason = agentAny.checkNeedsPermission('bash', {
      command: 'sudo rm -rf /tmp/test',
    });
    expect(reason).not.toBeNull();
    expect(reason).toContain('sudo');
  });

  it('should export InterruptError class', () => {
    const err = new InterruptError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InterruptError');
  });

  it('InterruptError should prevent retry in callLLMWithRetry', () => {
    const err = new InterruptError('test interrupt');

    expect(err instanceof InterruptError).toBe(true);
    expect(err.name).toBe('InterruptError');
    expect(err.message).toBe('test interrupt');
  });
});
