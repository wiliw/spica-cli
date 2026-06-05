// spica System Prompt - English only
import fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

Before acting, read the project context below. It tells you how to work on this project.

Available tools: file_read/write/edit, bash, git, glob/grep, web_search/fetch, test, lint, skill.
- skill(name): Load a skill's full instructions. Call this when a skill matches your task, then follow its guidance.

## File-Scoped Commands (Preferred - Fast)

**Critical**: Always prefer file-scoped commands over project-wide. Token savings: 97%.

| Operation | File-Scoped (Fast) | Project-Wide (Slow) |
|-----------|-------------------|--------------------|
| Type check | \`npx tsc --noEmit <file>\` (3s) | \`npm run typecheck\` (2min) |
| Lint | \`npx eslint <file>\` (1s) | \`npm run lint\` (30s) |
| Test | \`npm run test -- <file>\` (2s) | \`npm run test\` (4min) |

**Project-Wide Commands (Ask First)**:
- \`npm run build\` - ASK BEFORE RUNNING
- Full test suite - ASK BEFORE RUNNING

Ask before: rm -rf, sudo, git push --force, git reset --hard.
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

**Skill Invocation Rules**:
1. **Check skills BEFORE any action** - Read skill descriptions carefully. If a skill's description matches your task context, invoke \`skill(name)\` immediately.
2. **Invoke early, not late** - Call skills before starting work, not after encountering problems.
3. **Even 1% match means invoke** - If there's any possibility a skill applies, invoke it to check its full instructions.
4. **Follow skill instructions exactly** - After invoking a skill, read its full content and follow its workflow precisely.

**Common triggers**:
- "create/build/implement" → likely needs brainstorming skill
- "fix/bug/error/debug" → likely needs systematic-debugging skill
- "complete/done/verify" → likely needs verification-before-completion skill
- "review/merge/pr" → likely needs requesting-code-review skill
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

interface ProjectConfig {
  rawContent?: string;
  type?: string;
  language?: string;
  framework?: string;
  commands?: {
    build?: string;
    test?: string;
  };
  constraints?: string[];
}

export function getSystemPrompt(projectConfig?: ProjectConfig, skillsMetadata?: string, workspacePath?: string): string {
  let prompt = SYSTEM_PROMPT;

  // Bootstrap skill: using-superpowers (自动注入，指导 AI 如何使用 skills)
  const bootstrapContent = loadBootstrapSkill();
  if (bootstrapContent) {
    prompt += '\n\n## How to Use Skills\n' + bootstrapContent;
  }

  // Project context - inject full AGENTS.md content
  if (projectConfig) {
    // Inject raw AGENTS.md content as project guidelines
    if (projectConfig.rawContent) {
      prompt += '\n\n## Project Guidelines (from AGENTS.md)\n' + projectConfig.rawContent;
    } else {
      // Fallback: compact format if no raw content
      const parts = [projectConfig.type];
      if (projectConfig.language) parts.push(projectConfig.language);
      if (projectConfig.framework) parts.push(projectConfig.framework);
      prompt += `\nProject: ${parts.join(' | ')}`;

      if (projectConfig.commands?.build || projectConfig.commands?.test) {
        prompt += `\nCommands: build=${projectConfig.commands.build || 'N/A'}, test=${projectConfig.commands.test || 'N/A'}`;
      }

      if (projectConfig.constraints && projectConfig.constraints.length > 0) {
        prompt += `\nConstraints: ${projectConfig.constraints.slice(0, 3).join(', ')}`;
      }
    }
  }

  // Project learnings from .spica/learnings/
  if (workspacePath) {
    prompt += loadLearnings(workspacePath);
  }

  // Skills metadata injection
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