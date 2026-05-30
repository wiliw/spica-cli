import { SkillDefinition } from '../utils/settings';
export interface SkillPackageInfo {
    name: string;
    skills: string[];
}
export declare function initSkills(): Promise<void>;
export declare function loadSkills(workspacePath?: string): Map<string, SkillDefinition>;
export declare function getSkill(name: string, workspacePath?: string): SkillDefinition | null;
export declare function parseSkillInput(input: string, workspacePath?: string): {
    skillName: string;
    args: Record<string, any>;
} | null;
export declare function buildSkillPrompt(skill: SkillDefinition, args: Record<string, any>): string;
export declare function listSkills(workspacePath?: string): SkillDefinition[];
export declare function listInstalledPackages(): Promise<SkillPackageInfo[]>;
export declare function installSkill(source: string): Promise<{
    success: boolean;
    message: string;
    skills?: string[];
}>;
export declare function uninstallSkill(packageName: string): Promise<{
    success: boolean;
    message: string;
}>;
export declare function saveSkill(skillName: string, skill: SkillDefinition, pkgName?: string): Promise<boolean>;
export declare function deleteSkill(skillName: string, pkgName?: string): Promise<boolean>;
//# sourceMappingURL=index.d.ts.map