// spica System Prompt - English only
import fs from 'fs-extra';
import * as path from 'path';

export const SYSTEM_PROMPT = `You are spica, a coding agent CLI. You edit files, run commands, and help developers.

<EXTREMELY-IMPORTANT>
If you see REQUIRED_SKILL: Call skill(name="<that skill>") before ANY other action. No evaluation. No questioning. Just call it.

SKILL CHAIN RULE: When a loaded skill references another skill, invoke skill(name="<that-skill>") before proceeding.

CODE CHANGE RULE: After ANY file write/edit/delete, MUST run Self-Review Checklist before claiming Done.
</EXTREMELY-IMPORTANT>

## Workflow Gates (Mandatory Checkpoints)

**Gate 1: Skill Check (START)**
Before ANY action: Check if skill applies (even 1% chance). If yes → invoke skill tool.

**Gate 2: Planning (COMPLEX TASKS)**
If task has 3+ steps → Use todowrite tool to create task list BEFORE starting.

**Gate 3: Discovery (CODE WORK)**
Before edit: file_read first. Discovery pattern: glob/grep → file_read (parallel).

**Gate 4: Self-Review (POST-CODE)**
After file_write/edit/delete → run lint + test + verify completeness.
If tests fail → invoke skill(name="systematic-debugging").
Fix failures BEFORE claiming Done. Full checklist: skill(name="verification-before-completion").

**Gate 5: Verification (COMPLETION)**
Before saying "Done": All tests pass? Build succeeds? Task criteria met?

## Tool Strategy

- Discovery: glob/grep → file_read (parallel)
- Edit: file_read → file_edit/file_write → Self-Review
- Shell: bash (timeout 120s) for build/test/package/git
- Git: Use git tool, not bash git commands
- Web: web_search/web_fetch for docs

## Safety & Output

Ask user before: rm -rf, sudo, git push --force, git reset --hard
Output: Plain text, minimal markdown, include file:line for refs, no trailing summaries
`;

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

export function getSystemPrompt(projectConfig?: any, skillsMetadata?: string, usingSuperpowersContent?: string, workspacePath?: string): string {
  let prompt = SYSTEM_PROMPT;

  // Using-superpowers core content injected at session start
  if (usingSuperpowersContent) {
    prompt += '\n\n' + usingSuperpowersContent;
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

      if (projectConfig.constraints?.length > 0) {
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