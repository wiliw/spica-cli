export class RateLimiter {
    requestTimestamps = [];
    tokenUsage = [];
    config;
    constructor(config = {}) {
        this.config = {
            requestsPerMinute: config.requestsPerMinute || 500,
            tokensPerMinute: config.tokensPerMinute || 100000,
        };
    }
    async waitForAvailability() {
        let now = Date.now();
        const minuteAgo = now - 60000;
        this.requestTimestamps = this.requestTimestamps.filter(t => t > minuteAgo);
        this.tokenUsage = this.tokenUsage.filter(u => u.timestamp > minuteAgo);
        while (this.requestTimestamps.length >= this.config.requestsPerMinute) {
            const oldest = this.requestTimestamps[0];
            const waitTime = oldest + 60000 - now + 100;
            await this.sleep(waitTime);
            now = Date.now();
            this.requestTimestamps = this.requestTimestamps.filter(t => t > now - 60000);
        }
        const totalTokens = this.tokenUsage.reduce((sum, u) => sum + u.tokens, 0);
        if (totalTokens >= this.config.tokensPerMinute) {
            const oldestToken = this.tokenUsage[0];
            const waitTime = oldestToken.timestamp + 60000 - now + 100;
            await this.sleep(waitTime);
            this.tokenUsage = this.tokenUsage.filter(u => u.timestamp > Date.now() - 60000);
        }
    }
    recordRequest() {
        this.requestTimestamps.push(Date.now());
    }
    recordTokenUsage(tokens) {
        this.tokenUsage.push({ timestamp: Date.now(), tokens });
    }
    getStatus() {
        const now = Date.now();
        const minuteAgo = now - 60000;
        const recentRequests = this.requestTimestamps.filter(t => t > minuteAgo).length;
        const recentTokens = this.tokenUsage
            .filter(u => u.timestamp > minuteAgo)
            .reduce((sum, u) => sum + u.tokens, 0);
        return {
            requestsRemaining: this.config.requestsPerMinute - recentRequests,
            tokensRemaining: this.config.tokensPerMinute - recentTokens,
        };
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=RateLimiter.js.map