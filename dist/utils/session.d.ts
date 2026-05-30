import type { ChatMessage } from '../llm/providers/BaseProvider';
export interface SessionMeta {
    id: string;
    name: string;
    workspacePath: string;
    messageCount: number;
    lastActivity: string;
    createdAt: string;
    summary?: string;
}
export interface SessionState {
    workspacePath: string;
    messages: ChatMessage[];
    lastActivity: string;
    id: string;
    name: string;
    createdAt: string;
}
export declare function loadSession(workspacePath: string): SessionState | null;
export declare function saveSession(workspacePath: string, messages: ChatMessage[], sessionName?: string): void;
export declare function listSessions(workspacePath: string): SessionMeta[];
export declare function loadSessionById(workspacePath: string, sessionId: string): SessionState | null;
export declare function switchSession(workspacePath: string, sessionId: string): boolean;
export declare function clearSession(workspacePath: string): void;
export declare function deleteSession(workspacePath: string, sessionId: string): boolean;
export declare function renameSession(workspacePath: string, sessionId: string, newName: string): boolean;
//# sourceMappingURL=session.d.ts.map