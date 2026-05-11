export interface RateLimitConfig {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
}
export declare class RateLimiter {
    private requestTimestamps;
    private tokenUsage;
    private config;
    constructor(config?: RateLimitConfig);
    waitForAvailability(): Promise<void>;
    recordRequest(): void;
    recordTokenUsage(tokens: number): void;
    getStatus(): {
        requestsRemaining: number;
        tokensRemaining: number;
    };
    private sleep;
}
//# sourceMappingURL=RateLimiter.d.ts.map