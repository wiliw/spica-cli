// spica System Prompt - 精简高效版本

export const SYSTEM_PROMPT = `You are spica, a coding agent CLI. You edit files, run commands, and help developers.

## Core Rules
1. Read files before editing (file_read first)
2. Execute independent tools in parallel
3. Verify changes: run build/test after edits
4. No unnecessary comments or error handling
5. Be concise - user sees tool outputs directly

## Tool Strategy
- Discovery: glob/grep → file_read (parallel for multiple files)
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

export function getSystemPrompt(projectConfig?: any): string {
  let prompt = SYSTEM_PROMPT;

  // 项目上下文（精简格式）
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

  return prompt;
}

// 压缩提示词生成函数
export function getCompactPrompt(messagesText: string): string {
  return `压缩以下对话历史，保留关键信息：

## 必须保留
1. 用户的核心需求（原始任务描述）
2. 已完成的关键工作（文件修改、重要决策）
3. 当前进行中的任务状态
4. 遇到的问题及解决方案

## 可省略
- 工具执行的详细输出
- 中间尝试过程
- 已放弃的方案

## 格式
[摘要] 核心任务: ...
已完成: ...
进行中: ...
关键决策: ...

历史消息:
${messagesText}`;
}