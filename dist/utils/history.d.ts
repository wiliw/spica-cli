import type { ChatMessage } from '../llm/providers/BaseProvider';
export declare function ensureHistoryDir(): void;
export declare function loadHistory(): ChatMessage[];
export declare function saveHistory(history: ChatMessage[]): void;
export declare function clearHistory(): void;
//# sourceMappingURL=history.d.ts.map