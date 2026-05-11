export interface FileChange {
    path: string;
    operation: 'create' | 'modify' | 'delete';
    content?: string;
    timestamp: number;
}
export interface ProjectState {
    rootPath: string;
    gitBranch?: string;
    lastCommit?: string;
    openFiles: string[];
    recentChanges: FileChange[];
}
export declare class ContextManager {
    private conversationHistory;
    private fileChanges;
    private projectState;
    private maxHistorySize;
    private maxFileSize;
    constructor(rootPath: string);
    addConversationEntry(entry: string): void;
    recordFileChange(change: FileChange): void;
    setOpenFiles(files: string[]): void;
    setGitInfo(branch: string, lastCommit: string): void;
    getConversationHistory(): string[];
    getRecentChanges(): FileChange[];
    getProjectState(): ProjectState;
    getContextSummary(): string;
    clearHistory(): void;
    clearChanges(): void;
}
//# sourceMappingURL=ContextManager.d.ts.map