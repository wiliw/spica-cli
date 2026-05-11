import { EventEmitter } from 'node:events';
export interface SkillDefinition {
    name: string;
    execute: (context?: any) => Promise<void>;
    getStatus?: () => string;
}
export interface ExecutionContext {
    input?: any;
    [key: string]: any;
}
export declare class SkillEngine extends EventEmitter {
    private skills;
    private currentExecution;
    registerSkill(name: string, skill: SkillDefinition): void;
    hasSkill(name: string): boolean;
    execute(name: string, context?: ExecutionContext): Promise<void>;
    getSkillStatus(name: string): string | null;
    listSkills(): string[];
    on(event: string, listener: (...args: any[]) => void): this;
}
//# sourceMappingURL=SkillEngine.d.ts.map