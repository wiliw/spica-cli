import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../../llm/RateLimiter';

describe('RateLimiter interruptibleSleep cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clearInterval when AbortSignal is triggered', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const rateLimiter = new RateLimiter({ requestsPerMinute: 1 });
    rateLimiter.recordRequest();

    const controller = new AbortController();
    const promise = rateLimiter.waitForAvailability(controller.signal);

    controller.abort();

    await promise;

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
