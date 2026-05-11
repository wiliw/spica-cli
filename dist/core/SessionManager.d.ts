export declare enum SessionStatus {
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    ARCHIVED = "archived",
    FAILED = "failed"
}
export interface Session {
    id: string;
    name: string;
    workflow: string;
    status: SessionStatus;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
}
export interface CreateSessionOptions {
    name: string;
    workflow?: string;
    metadata?: Record<string, unknown>;
}
export interface UpdateSessionOptions {
    status?: SessionStatus;
    metadata?: Record<string, unknown>;
}
export interface ListSessionOptions {
    status?: SessionStatus;
}
export declare class SessionManager {
    private sessionDir;
    private cache;
    constructor(sessionDir: string);
    private getSessionPath;
    create(options: CreateSessionOptions): Promise<Session>;
    private save;
    get(id: string): Promise<Session | undefined>;
    private parseSession;
    update(id: string, options: UpdateSessionOptions): Promise<Session>;
    list(options?: ListSessionOptions): Promise<Session[]>;
    delete(id: string): Promise<void>;
    resume(id: string): Promise<Session>;
    archive(id: string): Promise<Session>;
}
//# sourceMappingURL=SessionManager.d.ts.map