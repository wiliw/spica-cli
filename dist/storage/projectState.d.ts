export interface ProjectState {
    phase: 'mvp' | 'cycle' | 'archive' | 'unknown';
    todos: Array<{
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
    }>;
    decisions: Array<{
        decision: string;
        reason: string;
        timestamp: string;
    }>;
    lastActivity: string;
    recentFiles: string[];
    summary?: string;
}
export declare function ensureProjectDir(workspacePath: string): void;
export declare function loadProjectState(workspacePath: string): ProjectState | null;
export declare function saveProjectState(workspacePath: string, state: ProjectState): void;
export declare function updateProjectTodos(workspacePath: string, todos: ProjectState['todos']): void;
export declare function addDecision(workspacePath: string, decision: string, reason: string): void;
export declare function setProjectPhase(workspacePath: string, phase: ProjectState['phase']): void;
export declare function loadProjectContext(workspacePath: string): any[];
export declare function saveProjectContext(workspacePath: string, messages: any[]): void;
//# sourceMappingURL=projectState.d.ts.map