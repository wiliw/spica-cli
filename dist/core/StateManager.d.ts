export declare class StateManager {
    private stateDir;
    private cache;
    constructor(stateDir: string);
    private getStatePath;
    save<T>(key: string, state: T): Promise<void>;
    load<T>(key: string): Promise<T | undefined>;
    update<T extends Record<string, unknown>>(key: string, updates: Partial<T>): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<string[]>;
    clear(): Promise<void>;
}
//# sourceMappingURL=StateManager.d.ts.map