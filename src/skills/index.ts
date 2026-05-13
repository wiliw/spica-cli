// Skills系统 - 用户自定义命令

import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

export interface SkillDefinition {
  name: string;
  description: string;
  promptTemplate: string;
  allowedTools?: string[];
  timeout?: number;
}

// 默认内置skills
const BUILTIN_SKILLS: Record<string, SkillDefinition> = {
  search: {
    name: 'search',
    description: '快速搜索代码，定位文件和符号',
    promptTemplate: '使用glob和grep搜索: {query}',
    allowedTools: ['glob', 'grep', 'file_read', 'file_exists'],
    timeout: 30000,
  },
  review: {
    name: 'review',
    description: '代码审查，检查问题和改进点',
    promptTemplate: '审查代码: {files}，指出问题和改进建议',
    allowedTools: ['glob', 'grep', 'file_read', 'lint'],
    timeout: 60000,
  },
  fix: {
    name: 'fix',
    description: '修复指定问题',
    promptTemplate: '修复问题: {issue}',
    allowedTools: ['file_read', 'file_edit', 'bash', 'lint'],
    timeout: 120000,
  },
  explain: {
    name: 'explain',
    description: '解释代码逻辑',
    promptTemplate: '解释代码: {target}',
    allowedTools: ['glob', 'grep', 'file_read'],
    timeout: 30000,
  },
  test: {
    name: 'test',
    description: '运行测试',
    promptTemplate: '运行测试: {filter}',
    allowedTools: ['test', 'file_read', 'bash'],
    timeout: 120000,
  },
};

// 加载用户定义的skills
export function loadSkills(): Map<string, SkillDefinition> {
  const skills = new Map<string, SkillDefinition>();

  // 1. 加载内置skills
  Object.entries(BUILTIN_SKILLS).forEach(([name, def]) => {
    skills.set(name, def);
  });

  // 2. 加载全局skills (~/.spica/skills.json)
  const globalPath = join(os.homedir(), '.spica', 'skills.json');
  if (fs.existsSync(globalPath)) {
    try {
      const globalSkills = fs.readJsonSync(globalPath);
      Object.entries(globalSkills).forEach(([name, def]) => {
        skills.set(name, def as SkillDefinition);
      });
    } catch (error) {
      // 忽略解析错误
    }
  }

  // 3. 加载项目skills (.spica/skills.json)
  const projectPath = join(process.cwd(), '.spica', 'skills.json');
  if (fs.existsSync(projectPath)) {
    try {
      const projectSkills = fs.readJsonSync(projectPath);
      Object.entries(projectSkills).forEach(([name, def]) => {
        skills.set(name, def as SkillDefinition);
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