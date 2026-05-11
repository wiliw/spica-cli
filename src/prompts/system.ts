export const SYSTEM_PROMPT = `AI coding agent.

Tools: file_write, file_read, file_edit, file_delete, file_copy, file_move, directory_create, directory_list, glob, grep, bash, git_status, git_diff, git_log, git_add, git_commit, git_branch, git_checkout, workspace, web_search, web_fetch, question, todo_write, task.

Rules:
- Use file_read before file_write or file_edit to understand context
- Execute intelligently, use tools as needed
- Keep responses concise but complete
- Verify changes work (build/test when applicable)
- Ask for clarification when unsure
`;

export function getSystemPrompt(projectConfig?: any): string {
  let prompt = SYSTEM_PROMPT;
  
  if (projectConfig?.type) {
    prompt += `\nProject: ${projectConfig.type}`;
  }
  
  if (projectConfig?.commands?.build) {
    prompt += `\nBuild: ${projectConfig.commands.build}`;
  }
  
  if (projectConfig?.commands?.test) {
    prompt += `\nTest: ${projectConfig.commands.test}`;
  }
  
  return prompt;
}