export interface Todo {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}
export declare class SpicaAgent {
    private llm;
    private providerName?;
    todos: Todo[];
    constructor(providerName?: string);
    init(): Promise<void>;
    executeMVP(description: string): Promise<void>;
    executeCycle(request: string): Promise<void>;
    executeArchive(version: string): Promise<void>;
    private runLoop;
    private printTodos;
}
//# sourceMappingURL=agent.d.ts.map