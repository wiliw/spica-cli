import { SkillBase } from './SkillBase';
export declare class MvpSkill extends SkillBase {
    constructor();
    getStepTodos(stepName: string): string[];
    getStepRequirements(stepName: string): string[];
    executeStep(index: number): Promise<void>;
}
//# sourceMappingURL=MvpSkill.d.ts.map