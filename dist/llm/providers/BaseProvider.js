export class BaseProvider {
    config;
    messages = [];
    constructor(config) {
        this.config = config;
    }
    setSystemPrompt(prompt) {
        this.messages = [{ role: 'system', content: prompt }];
    }
    addMessage(message) {
        this.messages.push(message);
    }
    clearHistory() {
        this.messages = [];
    }
    getMessages() {
        return this.messages;
    }
}
//# sourceMappingURL=BaseProvider.js.map