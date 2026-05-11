import { EventEmitter } from 'node:events';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export interface Step {
    name: string;
    description: string;
    status: StepStatus;
    startTime?: number;
    endTime?: number;
    error?: string;
}
export interface ProgressReport {
    totalSteps: number;
    completedSteps: number;
    inProgressSteps: number;
    pendingSteps: number;
    progressPercent: number;
}
export declare class ProgressTracker extends EventEmitter {
    private steps;
    private totalSteps;
    private currentStep;
    setTotalSteps(count: number): void;
    startStep(name: string, description: string): void;
    completeStep(name: string): void;
    failStep(name: string, error: string): void;
    getStep(name: string): Step | undefined;
    getCurrentStep(): Step | null;
    getOverallProgress(): number;
    getStepDuration(name: string): number;
    generateReport(): ProgressReport;
    on(event: string, listener: (...args: any[]) => void): this;
}
//# sourceMappingURL=ProgressTracker.d.ts.map