import { EventEmitter } from 'node:events';
import { RequestType } from './CycleSkill';
export type WorkflowType = 'mvp' | 'cycle' | 'archive';
export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'paused' | 'failed';
export interface WorkflowState {
    currentWorkflow: WorkflowType | null;
    status: WorkflowStatus;
}
export interface WorkflowResult {
    type: RequestType;
    workflow?: string[];
}
export interface WorkflowHistoryEntry {
    type: WorkflowType;
    timestamp: number;
    status: string;
}
export interface WorkflowReport {
    workflow: WorkflowType;
    status: WorkflowStatus;
    stepsCompleted: number;
    totalSteps: number;
}
export interface ContextData {
    [key: string]: any;
}
export declare class WorkflowCoordinator extends EventEmitter {
    private engine;
    private mvpSkill;
    private cycleSkill;
    private archiveSkill;
    private currentWorkflow;
    private status;
    private context;
    private history;
    private progress;
    private ironLawsViolated;
    constructor();
    startMVP(description: string): Promise<void>;
    startCycle(request: string): Promise<WorkflowResult>;
    startArchive(version: string): Promise<void>;
    private checkCanStart;
    getState(): WorkflowState;
    completeCurrentWorkflow(): Promise<void>;
    canStartNewWorkflow(): boolean;
    setContext(key: string, value: any): void;
    getContext(): ContextData;
    getHistory(): WorkflowHistoryEntry[];
    pause(): void;
    resume(): void;
    setProgress(percent: number): void;
    violateIronLaw(law: string): void;
    getCurrentWorkflow(): WorkflowType | null;
    generateReport(): WorkflowReport;
    on(event: string, listener: (...args: any[]) => void): this;
}
//# sourceMappingURL=WorkflowCoordinator.d.ts.map