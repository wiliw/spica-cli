import { EventEmitter } from 'node:events';
import { TodoManager } from './TodoManager';
import { ProgressTracker } from './ProgressTracker';
export type SkillStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export interface StepDefinition {
    name: string;
    description: string;
    requires?: string[];
    status?: StepStatus;
}
export interface SkillState {
    name: string;
    currentStepIndex: number;
    status: SkillStatus;
    completedSteps: number[];
}
export declare abstract class SkillBase extends EventEmitter {
    protected name: string;
    protected description: string;
    protected steps: StepDefinition[];
    protected ironLaws: string[];
    protected violatedIronLaws: Set<string>;
    protected currentStepIndex: number;
    protected status: SkillStatus;
    protected completedSteps: Set<number>;
    protected todoManager: TodoManager;
    protected progressTracker: ProgressTracker;
    constructor(name: string, description: string, steps: StepDefinition[]);
    getName(): string;
    getDescription(): string;
    getSteps(): StepDefinition[];
    addIronLaw(law: string): void;
    getIronLaws(): string[];
    markIronLawViolated(law: string): void;
    protected checkIronLaws(): void;
    protected checkPrerequisites(stepIndex: number): void;
    startStep(index: number): void;
    completeStep(index: number): void;
    getStatus(): SkillStatus;
    abstract executeStep(index: number): Promise<void>;
    serialize(): SkillState;
    restore(state: SkillState): void;
    on(event: string, listener: (...args: any[]) => void): this;
}
//# sourceMappingURL=SkillBase.d.ts.map