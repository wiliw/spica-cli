import { describe, it, expect } from 'vitest';
import { SpicaAgent } from '../../agent';

describe('permission queue race condition', () => {
  it('should only have one processing loop running for concurrent requests', async () => {
    const agent = new SpicaAgent(undefined, '/tmp');
    const agentAny = agent as any;

    // Simulate two concurrent waitForPermission calls
    const promise1 = agentAny.waitForPermission('test reason 1');
    const promise2 = agentAny.waitForPermission('test reason 2');

    // Both should be enqueued, only one processing loop
    expect(agentAny.permissionPending).toBe(true);
    expect(agentAny.permissionQueue.length).toBe(1); // One is being processed, one waiting

    // Approve first
    agent.approvePermission();
    const result1 = await promise1;
    expect(result1).toBe(true);

    // Approve second
    agent.approvePermission();
    const result2 = await promise2;
    expect(result2).toBe(true);

    // Queue should be empty, not pending
    expect(agentAny.permissionPending).toBe(false);
    expect(agentAny.permissionQueue.length).toBe(0);
  });

  it('should handle denial correctly in sequence', async () => {
    const agent = new SpicaAgent(undefined, '/tmp');
    const agentAny = agent as any;

    const promise1 = agentAny.waitForPermission('reason 1');
    const promise2 = agentAny.waitForPermission('reason 2');

    agent.denyPermission();
    const result1 = await promise1;
    expect(result1).toBe(false);

    agent.approvePermission();
    const result2 = await promise2;
    expect(result2).toBe(true);
  });
});
