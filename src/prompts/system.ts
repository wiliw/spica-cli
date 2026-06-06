// spica System Prompt - English only
import fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { ProjectConfig } from '../utils/projectConfig';

// ES module 中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 内置 skills 目录 - 支持开发模式 (src/) 和编译模式 (dist/)
function getBuiltinSkillsDir(): string {
  // 开发模式: src/prompts/system.ts -> src/builtin-skills
  const devPath = path.join(__dirname, '..', 'builtin-skills');
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  // 编译模式: dist/prompts/system.js -> ../../src/builtin-skills
  const distPath = path.join(__dirname, '..', '..', 'src', 'builtin-skills');
  if (fs.existsSync(distPath)) {
    return distPath;
  }
  // 回退到当前目录
  return devPath;
}

const BUILTIN_SKILLS_DIR = getBuiltinSkillsDir();

export const SYSTEM_PROMPT = `You are spica, a coding agent CLI. You edit files, run commands, and help developers.

Available tools: file_read/write/edit, bash, git, glob/grep, web_search/fetch, test, lint, skill.

Ask before: rm -rf, sudo, git push --force, git reset --hard.

Work completion rules:
- NEVER stop after just proposing solutions - must implement and verify
- Continue working until task is complete or user explicitly confirms to stop
- Always test changes before claiming completion
- If blocked or need guidance, report status and wait for user input

Output: plain text, file:line for refs, no trailing summaries.
`;

// 加载 using-superpowers bootstrap skill
function loadBootstrapSkill(): string {
  try {
    const bootstrapPath = path.join(BUILTIN_SKILLS_DIR, 'superpowers', 'using-superpowers', 'SKILL.md');
    if (fs.existsSync(bootstrapPath)) {
      const content = fs.readFileSync(bootstrapPath, 'utf-8');
      // 移除 YAML frontmatter
      let body = content;
      if (content.startsWith('---')) {
        const endIdx = content.indexOf('---', 3);
        if (endIdx !== -1) {
          body = content.slice(endIdx + 3).trim();
        }
      }
      return body;
    }
  } catch {
    // Ignore errors loading bootstrap skill
  }
  return '';
}

// Build skills section for system prompt
export function buildSkillsSection(skillsMetadata: string): string {
  if (!skillsMetadata) return '';

  return `
## Available Skills
${skillsMetadata}
`;
}

// Read .spica/learnings/*.md and return concatenated content
function loadLearnings(workspacePath: string): string {
  try {
    const learningsDir = path.join(workspacePath, '.spica', 'learnings');
    if (!fs.existsSync(learningsDir)) return '';
    
    const files = fs.readdirSync(learningsDir)
      .filter(f => f.endsWith('.md'))
      .sort(); // chronological by filename (YYYY-MM-DD prefix)
    
    if (files.length === 0) return '';
    
    const contents = files
      .map(f => fs.readFileSync(path.join(learningsDir, f), 'utf-8'))
      .join('\n\n');
    
    return `\n\n## Project Learnings (from .spica/learnings/)\n${contents}`;
  } catch {
    return ''; // never break system prompt for learnings issues
  }
}

export function getSystemPrompt(projectConfig?: ProjectConfig, skillsMetadata?: string, workspacePath?: string): string {
  let prompt = '';

  // 1. Project Guidelines - 最高优先级（用户指令）
  if (projectConfig) {
    if (projectConfig.rawContent) {
      prompt += '## Project Guidelines (from AGENTS.md) - Highest Priority\n' + projectConfig.rawContent + '\n\n';
    } else {
      // Fallback: compact format if no raw content
      const parts = [projectConfig.type];
      if (projectConfig.language) parts.push(projectConfig.language);
      if (projectConfig.framework) parts.push(projectConfig.framework);
      prompt += `## Project Guidelines\nProject: ${parts.join(' | ')}`;

      if (projectConfig.commands?.build || projectConfig.commands?.test) {
        prompt += `\nCommands: build=${projectConfig.commands.build || 'N/A'}, test=${projectConfig.commands.test || 'N/A'}`;
      }

      if (projectConfig.constraints && projectConfig.constraints.length > 0) {
        prompt += `\nConstraints: ${projectConfig.constraints.slice(0, 3).join(', ')}`;
      }
      prompt += '\n\n';
    }
    
    // Inject rule layers if present
    if (projectConfig.ruleLayers) {
      const { critical, important, preferences } = projectConfig.ruleLayers;
      if (critical.length > 0 || important.length > 0 || preferences.length > 0) {
        prompt += '## Rule Layers (from AGENTS.md)\n\n';
        
        if (critical.length > 0) {
          prompt += '### CRITICAL Rules (Must Follow)\n';
          critical.forEach(rule => prompt += `- ${rule}\n`);
          prompt += '\n';
        }
        
        if (important.length > 0) {
          prompt += '### IMPORTANT Rules (Should Follow)\n';
          important.forEach(rule => prompt += `- ${rule}\n`);
          prompt += '\n';
        }
        
        if (preferences.length > 0) {
          prompt += '### Preferences (Nice to Have)\n';
          preferences.forEach(rule => prompt += `- ${rule}\n`);
          prompt += '\n';
        }
      }
    }
  }

  // 2. Bootstrap skill: using-superpowers - 次高优先级
  const bootstrapContent = loadBootstrapSkill();
  if (bootstrapContent) {
    prompt += '## How to Use Skills\n' + bootstrapContent + '\n\n';
  }

  // 3. 基础身份 - 最低优先级
  prompt += SYSTEM_PROMPT;

  // 4. File-Scoped Commands 指导 - 最低优先级
  prompt += `
## File-Scoped Commands (Preferred - Fast)

Always prefer file-scoped commands over project-wide. Token savings: 97%.

| Operation | File-Scoped (Fast) | Project-Wide (Slow) |
|-----------|-------------------|--------------------|
| Type check | \`npx tsc --noEmit <file>\` (3s) | \`npm run typecheck\` (2min) |
| Lint | \`npx eslint <file>\` (1s) | \`npm run lint\` (30s) |
| Test | \`npm run test -- <file>\` (2s) | \`npm run test\` (4min) |

**Project-Wide Commands (Ask First)**:
- \`npm run build\` - ASK BEFORE RUNNING
- Full test suite - ASK BEFORE RUNNING
`;

  // 5. Project learnings from .spica/learnings/
  if (workspacePath) {
    prompt += loadLearnings(workspacePath);
  }

  // 6. Skills metadata - 仅列出技能名称
  if (skillsMetadata) {
    prompt += buildSkillsSection(skillsMetadata);
  }

  return prompt;
}

// Compact prompt for context compression (English)
export function getCompactPrompt(messagesText: string): string {
  return `Summarize the following conversation history, preserving key information:

## Must Preserve
1. User's core requirements (original task description)
2. Key work completed (file modifications, important decisions)
3. Current task status (in-progress items)
4. Problems encountered and solutions

## Can Omit
- Detailed tool execution outputs
- Intermediate attempts
- Abandoned approaches

## Format
[Summary] Core task: ...
Completed: ...
In progress: ...
Key decisions: ...

History messages:
${messagesText}`;
}