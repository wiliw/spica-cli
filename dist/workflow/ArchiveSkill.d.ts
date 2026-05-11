import { SkillBase, SkillState } from './SkillBase';
export interface TestResults {
    passed: number;
    failed: number;
}
export interface TaskCompletion {
    total: number;
    completed: number;
}
export interface ArchiveMetadata {
    version: string;
    commitHash: string;
    date: Date;
}
export declare class ArchiveSkill extends SkillBase {
    private version;
    private commitHash;
    private archiveDate;
    private testResults;
    private taskCompletion;
    constructor();
    getStepTodos(stepName: string): string[];
    setTestResults(results: TestResults): void;
    canProceedToCommit(): boolean;
    setTaskCompletion(completion: TaskCompletion): void;
    allTasksCompleted(): boolean;
    generateChangelogEntry(version: string, changes: string[]): string;
    setVersion(version: string): void;
    setCommitHash(hash: string): void;
    setArchiveDate(date: Date): void;
    getArchiveMetadata(): ArchiveMetadata;
    serialize(): SkillState & {
        version: string;
        commitHash: string;
    };
    executeStep(index: number): Promise<void>;
}
//# sourceMappingURL=ArchiveSkill.d.ts.map