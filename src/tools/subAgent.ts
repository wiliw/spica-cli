// SubAgent type definitions and configuration

export type SubAgentType = 'explore' | 'review' | 'fix' | 'build';

export interface SubAgentResult {
  status: 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED';
  output?: string;
  concerns?: string[];
  neededContext?: string[];
  blocker?: string;
  success: boolean;
}

export interface SubAgentTask {
  prompt: string;
  description?: string;
  type?: SubAgentType;
  skill?: string;
}

export interface SubAgentConfig {
  allowedTools: string[] | '*';  // Allowed tools, '*' means all
  timeout: number;               // Timeout in milliseconds
  description: string;           // Type description
}

export const SUB_AGENT_CONFIGS: Record<SubAgentType, SubAgentConfig> = {
  explore: {
    allowedTools: ['glob', 'grep', 'file_read', 'directory_list', 'file_exists'],
    timeout: 30000,
    description: 'Fast read-only exploration, locate files and code',
  },
  review: {
    allowedTools: ['glob', 'grep', 'file_read', 'directory_list', 'lint', 'file_exists'],
    timeout: 60000,
    description: 'Code review, find issues',
  },
  fix: {
    allowedTools: ['file_read', 'file_edit', 'bash', 'lint'],
    timeout: 120000,
    description: 'Fix specific issues, minimal changes',
  },
  build: {
    allowedTools: '*',  // All tools
    timeout: 180000,
    description: 'Full feature implementation',
  },
};

// Get subagent config
export function getSubAgentConfig(type?: SubAgentType): SubAgentConfig {
  if (!type) {
    // Default: full access
    return {
      allowedTools: '*',
      timeout: 120000,
      description: 'General purpose subagent',
    };
  }
  return SUB_AGENT_CONFIGS[type];
}

// 检查工具是否允许
export function isToolAllowed(toolName: string, config: SubAgentConfig): boolean {
  if (config.allowedTools === '*') return true;
  if (!config.allowedTools) return false;  // 保护
  return config.allowedTools.includes(toolName);
}

// Summarize result
export function summarizeResult(result: string, maxLength: number = 300): string {
  if (!result || result.length <= maxLength) return result || '';

  // Extract key information
  const lines = result.split('\n');
  const keyLines = lines.filter(l =>
    l.includes('✓') ||
    l.includes('✗') ||
    l.includes('完成') ||
    l.includes('成功') ||
    l.includes('失败') ||
    l.includes('Error') ||
    l.includes('done') ||
    l.includes('success') ||
    l.includes('failed') ||
    l.includes('completed')
  );

  if (keyLines.length > 0) {
    return keyLines.slice(0, 5).join('\n').slice(0, maxLength);
  }

  return result.slice(0, maxLength) + '...';
}