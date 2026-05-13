// Skills系统 - 用户自定义命令

import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';
import { execa } from 'execa';

export interface SkillDefinition {
  name?: string;         // skill名称（从JSON key自动填充）
  description: string;
  promptTemplate: string;
  allowedTools?: string[];
  timeout?: number;
  source?: string;      // 来源URL或本地路径
  version?: string;     // 版本号
}

export interface SkillPackage {
  name: string;
  version: string;
  description: string;
  author?: string;
  skills: Record<string, SkillDefinition>;
}

// 加载用户定义的skills
export function loadSkills(): Map<string, SkillDefinition> {
  const skills = new Map<string, SkillDefinition>();

  // 加载全局skills (~/.spica/skills.json)
  const globalPath = join(os.homedir(), '.spica', 'skills.json');
  if (fs.existsSync(globalPath)) {
    try {
      const globalSkills = fs.readJsonSync(globalPath);
      Object.entries(globalSkills.skills || globalSkills).forEach(([name, def]) => {
        const skillDef = def as SkillDefinition;
        skillDef.name = name;  // 设置name属性
        skills.set(name, skillDef);
      });
    } catch (error) {
      // 忽略解析错误
    }
  }

  // 加载项目skills (.spica/skills.json)
  const projectPath = join(process.cwd(), '.spica', 'skills.json');
  if (fs.existsSync(projectPath)) {
    try {
      const projectSkills = fs.readJsonSync(projectPath);
      Object.entries(projectSkills.skills || projectSkills).forEach(([name, def]) => {
        const skillDef = def as SkillDefinition;
        skillDef.name = name;  // 设置name属性
        skills.set(name, skillDef);
      });
    } catch (error) {
      // 忽略解析错误
    }
  }

  return skills;
}

// 获取skill定义
export function getSkill(name: string): SkillDefinition | null {
  return loadSkills().get(name);
}

// 检查输入是否是skill调用（如 /search api）
export function parseSkillInput(input: string): { skillName: string; args: Record<string, any> } | null {
  const trimmed = input.trim();

  // 检查 /skill 格式
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const skillName = parts[0];
    const args = parts.slice(1).join(' ');

    const skill = getSkill(skillName);
    if (skill) {
      // 解析模板变量
      const templateArgs = parseTemplateArgs(skill.promptTemplate, args);
      return { skillName, args: templateArgs };
    }
  }

  return null;
}

// 解析模板变量
function parseTemplateArgs(template: string, input: string): Record<string, any> {
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
  }

  return args;
}

// 构建skill prompt
export function buildSkillPrompt(skill: SkillDefinition, args: Record<string, any>): string {
  let prompt = skill.promptTemplate;

  Object.entries(args).forEach(([key, value]) => {
    prompt = prompt.replace(`{${key}}`, value);
  });

  return prompt;
}

// 列出所有skills
export function listSkills(): SkillDefinition[] {
  return Array.from(loadSkills().values());
}

// Skills安装目录
const SKILLS_DIR = join(os.homedir(), '.spica', 'installed-skills');

// 安装skill包（从URL或本地路径）
export async function installSkill(source: string): Promise<{ success: boolean; message: string; skills?: string[] }> {
  try {
    // 确保安装目录存在
    await fs.ensureDir(SKILLS_DIR);

    let skillPackage: SkillPackage;

    // 检查是否是URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
      // 从URL下载
      const result = await execa('curl', ['-s', source]);
      skillPackage = JSON.parse(result.stdout);
    } else if (source.endsWith('.json')) {
      // 本地JSON文件
      skillPackage = await fs.readJson(source);
    } else {
      // 可能是npm包名（未来支持）
      return { success: false, message: 'Only URLs and local JSON files are supported currently' };
    }

    // 验证skill包格式
    if (!skillPackage.name || !skillPackage.skills) {
      return { success: false, message: 'Invalid skill package format: missing name or skills' };
    }

    // 保存到安装目录
    const packageFile = join(SKILLS_DIR, `${skillPackage.name}.json`);
    await fs.writeJson(packageFile, skillPackage, { spaces: 2 });

    // 加载skills到全局配置
    const globalConfigPath = join(os.homedir(), '.spica', 'skills.json');
    let globalConfig: { skills: Record<string, SkillDefinition> } = { skills: {} };

    if (await fs.pathExists(globalConfigPath)) {
      globalConfig = await fs.readJson(globalConfigPath);
    }

    // 添加每个skill到全局配置
    const skillNames: string[] = [];
    Object.entries(skillPackage.skills).forEach(([name, def]) => {
      const fullKey = `${skillPackage.name}/${name}`;
      const skillDef = def as SkillDefinition;
      skillDef.name = fullKey;
      skillDef.source = source;
      skillDef.version = skillPackage.version;
      globalConfig.skills[fullKey] = skillDef;
      skillNames.push(fullKey);
    });

    await fs.writeJson(globalConfigPath, globalConfig, { spaces: 2 });

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

    // 删除包文件
    await fs.remove(packageFile);

    // 从全局配置中删除
    const globalConfigPath = join(os.homedir(), '.spica', 'skills.json');
    if (await fs.pathExists(globalConfigPath)) {
      const globalConfig = await fs.readJson(globalConfigPath);
      Object.keys(globalConfig.skills || {}).forEach(key => {
        if (key.startsWith(`${packageName}/`)) {
          delete globalConfig.skills[key];
        }
      });
      await fs.writeJson(globalConfigPath, globalConfig, { spaces: 2 });
    }

    return { success: true, message: `Uninstalled ${packageName}` };
  } catch (error: any) {
    return { success: false, message: `Uninstall failed: ${error.message}` };
  }
}

// 搜索可用的skill包（从远程registry）
export async function searchSkills(query: string): Promise<Array<{ name: string; description: string; author: string }>> {
  // 未来可以实现从registry搜索
  // 目前返回空数组
  return [];
}