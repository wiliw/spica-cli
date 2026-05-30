export interface QueuedInput {
    id: number;
    content: string;
    timestamp: Date;
    processed: boolean;
}
export declare class InputQueue {
    private queue;
    private nextId;
    private maxSize;
    add(content: string): QueuedInput;
    getPending(): QueuedInput[];
    mergePending(): string;
    undoLast(): QueuedInput | null;
    undoById(id: number): QueuedInput | null;
    clearPending(): number;
    getStatus(): {
        total: number;
        pending: number;
        processed: number;
        pendingPreview: string[];
    };
    hasPending(): boolean;
    length(): number;
}
export declare function getInputQueue(): InputQueue;
export declare function clearInputQueue(): void;
//# sourceMappingURL=queue.d.ts.map