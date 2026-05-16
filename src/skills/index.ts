// Skills系统 - 用户自定义命令

import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';
import { execa } from 'execa';
import {
  loadGlobalSettings,
  GLOBAL_DIR,
  SkillDefinition,
  loadProjectSkills,
} from '../utils/settings';

// SkillPackage 定义（仅在本模块）
export interface SkillPackage {
  name: string;
  version: string;
  description: string;
  author?: string;
  skills: Record<string, SkillDefinition>;
}

// 加载所有 skills（全局 + 项目覆盖）
export function loadSkills(workspacePath?: string): Map<string, SkillDefinition> {
  const skills = new Map<string, SkillDefinition>();
  const ws = workspacePath || process.cwd();

  // 加载全局 skills
  const globalSettings = loadGlobalSettingsSync();
  if (globalSettings.skills) {
    Object.entries(globalSettings.skills).forEach(([name, def]) => {
      def.name = name;
      skills.set(name, def);
    });
  }

  // 加载项目 skills（覆盖全局）
  const projectSkills = loadProjectSkills(ws);
  if (projectSkills) {
    Object.entries(projectSkills).forEach(([name, def]) => {
      def.name = name;
      skills.set(name, def);
    });
  }

  return skills;
}

// 同步加载全局 settings（用于 loadSkills）
function loadGlobalSettingsSync(): { skills?: Record<string, SkillDefinition> } {
  const globalPath = join(GLOBAL_DIR, 'settings.json');
  if (fs.existsSync(globalPath)) {
    try {
      return fs.readJsonSync(globalPath);
    } catch {
      return {};
    }
  }
  return {};
}

// 获取skill定义
export function getSkill(name: string, workspacePath?: string): SkillDefinition | null {
  return loadSkills(workspacePath).get(name);
}

// 检查输入是否是skill调用（如 /search api）
export function parseSkillInput(input: string, workspacePath?: string): { skillName: string; args: Record<string, any> } | null {
  const trimmed = input.trim();

  // 检查 /skill 格式
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const skillName = parts[0];
    const args = parts.slice(1).join(' ');

    const skill = getSkill(skillName, workspacePath);
    if (skill) {
      // 解析模板变量
      const templateArgs = parseTemplateArgs(skill.promptTemplate, args);
      return { skillName, args: templateArgs };
    }
  }

  return null;
}

// 解析模板变量
function parseTemplateArgs(template: string | undefined, input: string): Record<string, any> {
  // 处理 undefined 或空模板
  if (!template) {
    return { input };
  }

  // 找出模板中的变量名 {var}
  const vars = template.match(/\{(\w+)\}/g) || [];
  const varNames = vars.map(v => v.slice(1, -1));

  const args: Record<string, any> = {};

  // 如果只有一个变量，直接赋值
  if (varNames.length === 1) {
    args[varNames[0]] = input;
  } else if (varNames.length > 1) {
    // 多个变量时，尝试按逗号或空格分割
    const parts = input.split(/[,\s]+/);
    varNames.forEach((name, i) => {
      args[name] = parts[i] || '';
    });
  } else {
    // 没有变量时，使用默认 input
    args.input = input;
  }

  return args;
}

// 构建skill prompt
export function buildSkillPrompt(skill: SkillDefinition, args: Record<string, any>): string {
  let prompt = skill.promptTemplate || '';

  // 替换模板中的变量
  Object.entries(args).forEach(([key, value]) => {
    prompt = prompt.replace(`{${key}}`, value);
  });

  // 如果模板没有变量占位符，把用户输入追加到末尾
  if (!skill.promptTemplate?.match(/\{(\w+)\}/) && args.input) {
    prompt += `\n\nUser request: ${args.input}`;
  }

  // 如果模板为空，直接返回 args 内容
  if (!skill.promptTemplate) {
    return Object.entries(args).map(([k, v]) => `${k}: ${v}`).join('\n');
  }

  return prompt;
}

// 列出所有skills
export function listSkills(workspacePath?: string): SkillDefinition[] {
  return Array.from(loadSkills(workspacePath).values());
}

// Skills安装目录
const SKILLS_DIR = join(GLOBAL_DIR, 'installed-skills');

// 安装skill包（从URL或本地路径）
export async function installSkill(source: string): Promise<{ success: boolean; message: string; skills?: string[] }> {
  try {
    await fs.ensureDir(SKILLS_DIR);

    let skillPackage: SkillPackage;

    // GitHub URL 处理
    if (source.includes('github.com')) {
      // 转换 GitHub URL 到 raw URL
      let rawUrl = source;

      // https://github.com/user/repo -> https://raw.githubusercontent.com/user/repo/main/skills.json
      if (source.match(/github\.com\/[^/]+\/[^/]+$/)) {
        // 没有指定文件，尝试 skills.json
        const match = source.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          rawUrl = `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/skills.json`;
        }
      }
      // https://github.com/user/repo/blob/main/file.json -> raw.githubusercontent.com
      else if (source.includes('/blob/')) {
        rawUrl = source
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
      }

      const result = await execa('curl', ['-sL', rawUrl]);
      skillPackage = JSON.parse(result.stdout);
    }
    // 直接 URL（指向 JSON）
    else if (source.startsWith('http://') || source.startsWith('https://')) {
      const result = await execa('curl', ['-sL', source]);
      skillPackage = JSON.parse(result.stdout);
    }
    // 本地文件
    else if (source.endsWith('.json') || fs.existsSync(source)) {
      skillPackage = await fs.readJson(source);
    }
    else {
      return { success: false, message: 'Unsupported source format. Use GitHub URL, JSON URL, or local file.' };
    }

    if (!skillPackage.name || !skillPackage.skills) {
      return { success: false, message: 'Invalid skill package: missing name or skills field' };
    }

    // 保存到安装目录
    const packageFile = join(SKILLS_DIR, `${skillPackage.name}.json`);
    await fs.writeJson(packageFile, skillPackage, { spaces: 2 });

    // 加载skills到全局 settings
    const { loadGlobalSettings, saveGlobalSettings } = await import('../utils/settings');
    const settings = await loadGlobalSettings();

    if (!settings.skills) settings.skills = {};

    const skillNames: string[] = [];
    Object.entries(skillPackage.skills).forEach(([name, def]) => {
      const fullKey = `${skillPackage.name}/${name}`;
      const skillDef = def as SkillDefinition;
      skillDef.name = fullKey;
      settings.skills![fullKey] = skillDef;
      skillNames.push(fullKey);
    });

    await saveGlobalSettings(settings);

    return {
      success: true,
      message: `Installed ${skillPackage.name} v${skillPackage.version || '1.0.0'}`,
      skills: skillNames,
    };
  } catch (error: any) {
    return { success: false, message: `Install failed: ${error.message}` };
  }
}

// 列出已安装的skill包
export async function listInstalledPackages(): Promise<SkillPackage[]> {
  const packages: SkillPackage[] = [];

  if (!await fs.pathExists(SKILLS_DIR)) {
    return packages;
  }

  const files = await fs.readdir(SKILLS_DIR);
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const pkg = await fs.readJson(join(SKILLS_DIR, file));
        packages.push(pkg);
      } catch {
        // 忽略无效文件
      }
    }
  }

  return packages;
}

// 卸载skill包
export async function uninstallSkill(packageName: string): Promise<{ success: boolean; message: string }> {
  try {
    const packageFile = join(SKILLS_DIR, `${packageName}.json`);

    if (!await fs.pathExists(packageFile)) {
      return { success: false, message: `Package "${packageName}" not found` };
    }

    await fs.remove(packageFile);

    // 从全局 settings 中删除
    const { loadGlobalSettings, saveGlobalSettings } = await import('../utils/settings');
    const settings = await loadGlobalSettings();

    if (settings.skills) {
      Object.keys(settings.skills).forEach(key => {
        if (key.startsWith(`${packageName}/`)) {
          delete settings.skills![key];
        }
      });
      await saveGlobalSettings(settings);
    }

    return { success: true, message: `Uninstalled ${packageName}` };
  } catch (error: any) {
    return { success: false, message: `Uninstall failed: ${error.message}` };
  }
}

// 保存单个 skill 到全局 settings
export async function saveSkill(name: string, skill: SkillDefinition): Promise<boolean> {
  try {
    const { loadGlobalSettings, saveGlobalSettings } = await import('../utils/settings');
    const settings = await loadGlobalSettings();

    if (!settings.skills) settings.skills = {};
    settings.skills[name] = skill;

    await saveGlobalSettings(settings);
    return true;
  } catch (error: any) {
    console.error(`Failed to save skill: ${error.message}`);
    return false;
  }
}

// 删除单个 skill 从全局 settings
export async function deleteSkill(name: string): Promise<boolean> {
  try {
    const { loadGlobalSettings, saveGlobalSettings } = await import('../utils/settings');
    const settings = await loadGlobalSettings();

    if (settings.skills && settings.skills[name]) {
      delete settings.skills[name];
      await saveGlobalSettings(settings);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error(`Failed to delete skill: ${error.message}`);
    return false;
  }
}

// 搜索可用的skill包（从远程registry）
export async function searchSkills(query: string): Promise<Array<{ name: string; description: string; author: string }>> {
  // 未来可以实现从registry搜索
  // 目前返回空数组
  return [];
}