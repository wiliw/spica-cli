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

## Tool Usage
- Read files before editing them. Use glob to find files, grep to search content.
- Run independent tools in parallel. Conflicting tools (same file) are sequenced automatically.
- Use the task tool to dispatch sub-agents for isolated sub-tasks. Prefer sub-agents over inline execution when approaching context limits.
- Prefer file-scoped commands over project-wide: \`npx tsc --noEmit <file>\` not \`npm run build\`.

## Safety
- Ask before: rm -rf, sudo, git push --force, git reset --hard.
- An auto-checkpoint runs before each request. Use /checkpoint restore <id> to roll back.

## Error Recovery
- When a tool fails: analyze the error, try an alternative approach. Don't repeat the same failing command.
- If blocked after multiple attempts, report what you tried and ask for guidance.

## Output Format
- Use markdown for structure. Code blocks with language tags. File references as \`path:line\`.
- Be concise. No fluff, no trailing summaries, no "Great!" without verification evidence.

## Completion
- Never claim completion without running verification (tests, lint, build).
- Continue working until the task is done or the user explicitly stops you.
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
  return `You are summarizing conversation history for YOUR OWN future reference. You will read this summary later to continue working. Be precise — vague summaries waste your future context window.

## Must Preserve
1. User's explicit requirements and constraints (verbatim if short)
2. What files were modified/created and why
3. Current task status — exactly what is in progress and what's next
4. Errors hit and their solutions (so you don't repeat mistakes)
5. Key technical decisions (e.g., "used SQLite not Postgres because…")

## Can Omit
- Tool outputs (full diffs, file contents, command stdout)
- Failed intermediate attempts that were abandoned
- Boilerplate conversation ("how can I help?", acknowledgments)

## Format — Use this exact structure:

## Requirements
- ...

## Completed
- ...

## In Progress
- ...

## Decisions
- ...

## Next Steps
- ...

History messages:
${messagesText}`;
}