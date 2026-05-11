export class ConversationManager {
    entries = [];
    currentSkill = null;
    sessionId;
    constructor() {
        this.sessionId = this.GenerateSessionId();
    }
    GenerateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    addUserMessage(content) {
        this.entries.push({
            role: 'user',
            content,
            timestamp: Date.now(),
            skill: this.currentSkill || undefined,
        });
    }
    addAssistantMessage(content) {
        this.entries.push({
            role: 'assistant',
            content,
            timestamp: Date.now(),
            skill: this.currentSkill || undefined,
        });
    }
    setCurrentSkill(skill) {
        this.currentSkill = skill;
    }
    clearCurrentSkill() {
        this.currentSkill = null;
    }
    getEntries() {
        return this.entries;
    }
    getEntriesForSkill(skill) {
        return this.entries.filter(e => e.skill === skill);
    }
    getRecentEntries(count = 10) {
        return this.entries.slice(-count);
    }
    getSessionId() {
        return this.sessionId;
    }
    toChatMessages() {
        return this.entries.map(e => ({
            role: e.role,
            content: e.content,
        }));
    }
    getConversationSummary() {
        const recent = this.getRecentEntries(5);
        return recent.map(e => `${e.role}: ${e.content.slice(0, 100)}...`).join('\n');
    }
    clear() {
        this.entries = [];
        this.sessionId = this.GenerateSessionId();
    }
}
//# sourceMappingURL=ConversationManager.js.map