type EventHandler<T = unknown> = (payload: T) => void;
export declare class EventBus {
    private handlers;
    subscribe<T = unknown>(event: string, handler: EventHandler<T>): () => void;
    once<T = unknown>(event: string, handler: EventHandler<T>): void;
    emit<T = unknown>(event: string, payload?: T): void;
    clear(event?: string): void;
}
export {};
//# sourceMappingURL=EventBus.d.ts.map