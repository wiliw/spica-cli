export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export interface Todo {
    content: string;
    status: TodoStatus;
}
export declare class TodoManager {
    private todos;
    addTodo(content: string): void;
    getTodos(): Todo[];
    startTodo(index: number): void;
    completeTodo(index: number): void;
    getCurrentTodo(): Todo | null;
    clear(): void;
    updateTodoStatus(content: string, status: TodoStatus): void;
    getProgress(): number;
    serialize(): string;
    static deserialize(data: string): TodoManager;
}
//# sourceMappingURL=TodoManager.d.ts.map