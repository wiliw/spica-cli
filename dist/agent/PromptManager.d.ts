export interface SkillPrompt {
    system: string;
    user: string;
    tools: string[];
}
export declare class PromptManager {
    private skillPrompts;
    private templates;
    constructor();
    private InitializeDefaults;
    getSkillPrompt(skillName: string): SkillPrompt | undefined;
    setSkillPrompt(skillName: string, prompt: SkillPrompt): void;
    getTemplate(templateName: string): string | undefined;
    applyTemplate(templateName: string, variables: Record<string, string>): string;
    addTemplate(name: string, template: string): void;
    getAvailableSkills(): string[];
    getToolsForSkill(skillName: string): string[];
    buildPrompt(skillName: string, context?: string): string;
}
//# sourceMappingURL=PromptManager.d.ts.map