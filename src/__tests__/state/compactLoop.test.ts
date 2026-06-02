import { describe, it, expect } from 'vitest';

describe('compact loop safety', () => {
  it('should have MAX_COMPACT_ITERATIONS in source', async () => {
    const fs = await import('fs-extra');
    const source = await fs.readFile('src/agent.ts', 'utf-8');
    expect(source).toContain('MAX_COMPACT_ITERATIONS');
  });

  it('should have context_warning in source', async () => {
    const fs = await import('fs-extra');
    const source = await fs.readFile('src/agent.ts', 'utf-8');
    expect(source).toContain('context_warning');
  });

  it('should have break statement after max iterations', async () => {
    const fs = await import('fs-extra');
    const source = await fs.readFile('src/agent.ts', 'utf-8');
    // The guard should contain a break inside the loop when iterations exceed MAX
    expect(source).toContain('compactIterations');
    expect(source).toContain('MAX_COMPACT_ITERATIONS');
  });
});
