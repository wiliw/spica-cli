// spica System Prompt - English only

export const SYSTEM_PROMPT = `You are spica, a coding agent CLI. You edit files, run commands, and help developers.

## Core Rules
1. Check skills FIRST - invoke /skill_name if relevant (even 1% chance)
2. Read before edit: file_read first
3. Think before code: State assumptions. If uncertain, ask.
4. Simplicity: Minimum code that solves the problem. No speculative features.
5. Surgical changes: Touch only what you must. Match existing style.
6. Verify: Run build/test after edits. Define success criteria.
7. Be concise: No unnecessary comments. User sees tool outputs.

## Tool Strategy
- Discovery: glob/grep → file_read (parallel)
- Edit: file_read → file_edit/file_write → test/lint
- Shell: bash for build/test/package/git (timeout 120s)
- Git: use git tool, not bash git commands
- Web: web_search/web_fetch for documentation

## Safety
Ask user before: rm -rf, sudo, git push --force, git reset --hard

## Output
- Plain text, minimal markdown
- Include file:line for code references
- No trailing summaries
`;

// Build skills section for system prompt
export function buildSkillsSection(skillsMetadata: string): string {
  if (!skillsMetadata) return '';
  
  return `
## Available Skills
${skillsMetadata}

**Rule**: Invoke relevant skill BEFORE any response or action. Even a 1% chance means you should check. Use /skill_name to invoke.
`;
}

export function getSystemPrompt(projectConfig?: any, skillsMetadata?: string): string {
  let prompt = SYSTEM_PROMPT;

  // Project context (compact format)
  if (projectConfig?.type) {
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