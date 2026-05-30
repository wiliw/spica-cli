export interface PersistedTask {
    id: string;
    subject: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'deleted';
    activeForm?: string;
    owner?: string;
    blockedBy?: string[];
    blocks?: string[];
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, any>;
}
export interface TasksState {
    tasks: PersistedTask[];
    lastUpdated: string;
}
export declare function loadPersistedTasks(workspacePath: string): PersistedTask[];
export declare function savePersistedTasks(workspacePath: string, tasks: PersistedTask[]): void;
export declare function updatePersistedTask(workspacePath: string, task: PersistedTask): void;
export declare function deletePersistedTask(workspacePath: string, taskId: string): void;
export declare function clearPersistedTasks(workspacePath: string): void;
export declare function getTaskStats(workspacePath: string): {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
};
//# sourceMappingURL=taskPersistence.d.ts.map