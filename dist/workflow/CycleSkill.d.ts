import { SkillBase } from './SkillBase';
export type RequestType = 'bug' | 'simple' | 'complex';
export interface FixAttempt {
    attemptNumber: number;
    description: string;
    timestamp: number;
}
export interface FixResult {
    success: boolean;
    error?: string;
}
export declare class CycleSkill extends SkillBase {
    private fixAttempts;
    private requestType;
    constructor();
    judgeRequestType(request: string): RequestType;
    createWorkflow(type: RequestType): string[];
    autoFixLoop(testFn: () => Promise<FixResult>, options: {
        maxAttempts: number;
    }): Promise<FixResult>;
    recordFixAttempt(attemptNumber: number, description: string): void;
    getFixAttempts(): FixAttempt[];
    getStepTodos(stepName: string, type?: RequestType): string[];
    executeStep(index: number): Promise<void>;
}
//# sourceMappingURL=CycleSkill.d.ts.map