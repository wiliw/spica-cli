import { ChatMessage } from '../llm/providers/BaseProvider';
export interface ConversationEntry {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    skill?: string;
}
export declare class ConversationManager {
    private entries;
    private currentSkill;
    private sessionId;
    constructor();
    private GenerateSessionId;
    addUserMessage(content: string): void;
    addAssistantMessage(content: string): void;
    setCurrentSkill(skill: string): void;
    clearCurrentSkill(): void;
    getEntries(): ConversationEntry[];
    getEntriesForSkill(skill: string): ConversationEntry[];
    getRecentEntries(count?: number): ConversationEntry[];
    getSessionId(): string;
    toChatMessages(): ChatMessage[];
    getConversationSummary(): string;
    clear(): void;
}
//# sourceMappingURL=ConversationManager.d.ts.map