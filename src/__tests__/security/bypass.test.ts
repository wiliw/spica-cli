import { describe, it, expect } from 'vitest';
import { SpicaAgent } from '../../agent';

describe('bypass mode safety', () => {
  it('should define NEVER_BYPASS_PATTERNS', () => {
    const patterns = (SpicaAgent as any).NEVER_BYPASS_PATTERNS;
    expect(patterns).toBeDefined();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should detect dangerous patterns in NEVER_BYPASS_PATTERNS', () => {
    const patterns = (SpicaAgent as any).NEVER_BYPASS_PATTERNS;
    
    // rm -rf should be detected
    const rmRfPattern = patterns.find((p: any) => p.pattern.test('rm -rf /tmp/test'));
    expect(rmRfPattern).toBeDefined();

    // chmod 777 should be detected
    const chmodPattern = patterns.find((p: any) => p.pattern.test('chmod 777 /tmp/file'));
    expect(chmodPattern).toBeDefined();
  });

  it('should still require permission for destructive ops in bypass mode', () => {
    const agent = new SpicaAgent(undefined, '/tmp');
    agent.setBypassPermissions(true);
    const agentAny = agent as any;

    // Destructive ops should still need permission
    const reason = agentAny.checkNeedsPermission('bash', {
      command: 'rm -rf /tmp/test',
    });
    expect(reason).not.toBeNull();
  });

  it('should auto-approve safe commands in bypass mode', () => {
    const agent = new SpicaAgent(undefined, '/tmp');
    agent.setBypassPermissions(true);
    const agentAny = agent as any;

    const reason = agentAny.checkNeedsPermission('bash', {
      command: 'echo hello',
    });
    expect(reason).toBeNull();
  });
});
