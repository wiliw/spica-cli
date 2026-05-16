// 错误恢复策略 - 整合新版 checkpoint 系统

import {
  createCheckpoint,
  getLastCheckpoint,
  restoreCheckpoint,
  getCheckpoint,
  listCheckpoints,
  type CheckpointMeta,
} from '../storage/checkpoint';

export type { CheckpointMeta } from '../storage/checkpoint';

// 重新导出 checkpoint 函数
export {
  createCheckpoint,
  getLastCheckpoint,
  restoreCheckpoint,
  getCheckpoint,
  listCheckpoints,
  setCheckpointWorkspace,
  diffCheckpoint,
  clearCheckpoints,
  getCheckpointStats,
  exportCheckpoints,
  importCheckpoints,
  setMaxCheckpoints,
} from '../storage/checkpoint';

export interface ErrorAnalysis {
  type: 'file_not_found' | 'permission_denied' | 'syntax_error' | 'network_error' | 'git_error' | 'unknown';
  recoverable: boolean;
  suggestion: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RecoveryOption {
  action: 'restore_checkpoint' | 'retry' | 'skip' | 'ask_user' | 'auto_fix';
  description: string;
  checkpoint?: CheckpointMeta;
}

// 分析错误类型
export function analyzeError(error: string): ErrorAnalysis {
  const errorLower = error.toLowerCase();

  if (errorLower.includes('enoent') || errorLower.includes('not found') || errorLower.includes('不存在')) {
    return {
      type: 'file_not_found',
      recoverable: true,
      suggestion: '使用 glob 搜索文件，或检查路径',
      severity: 'low',
    };
  }

  if (errorLower.includes('permission') || errorLower.includes('eacces') || errorLower.includes('权限')) {
    return {
      type: 'permission_denied',
      recoverable: true,
      suggestion: '检查文件权限，或询问用户是否使用 sudo',
      severity: 'medium',
    };
  }

  if (errorLower.includes('syntax') || errorLower.includes('parse') || errorLower.includes('语法')) {
    return {
      type: 'syntax_error',
      recoverable: true,
      suggestion: '重新读取文件，检查语法',
      severity: 'medium',
    };
  }

  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('econn')) {
    return {
      type: 'network_error',
      recoverable: true,
      suggestion: '等待后重试，或检查网络连接',
      severity: 'medium',
    };
  }

  if (errorLower.includes('git') || errorLower.includes('merge') || errorLower.includes('conflict')) {
    return {
      type: 'git_error',
      recoverable: true,
      suggestion: '检查 git 状态，可能需要解决冲突',
      severity: 'high',
    };
  }

  if (errorLower.includes('fatal') || errorLower.includes('critical') || errorLower.includes('崩溃')) {
    return {
      type: 'unknown',
      recoverable: false,
      suggestion: '严重错误，建议回滚到 checkpoint',
      severity: 'critical',
    };
  }

  return {
    type: 'unknown',
    recoverable: false,
    suggestion: '回滚到 checkpoint 或询问用户',
    severity: 'low',
  };
}

// 获取恢复策略建议
export async function getRecoveryStrategy(error: string): Promise<RecoveryOption[]> {
  const analysis = analyzeError(error);
  const strategies: RecoveryOption[] = [];
  const lastCp = await getLastCheckpoint();

  switch (analysis.type) {
    case 'file_not_found':
      strategies.push({ action: 'retry', description: '使用 glob 查找类似文件' });
      strategies.push({ action: 'auto_fix', description: '检查路径是否正确' });
      strategies.push({ action: 'ask_user', description: '询问用户文件位置' });
      break;

    case 'permission_denied':
      strategies.push({ action: 'auto_fix', description: '检查文件权限' });
      strategies.push({ action: 'ask_user', description: '询问用户是否需要 sudo' });
      strategies.push({ action: 'skip', description: '尝试切换到其他目录' });
      break;

    case 'syntax_error':
      strategies.push({ action: 'retry', description: '重新读取文件' });
      strategies.push({ action: 'auto_fix', description: '检查内容格式' });
      strategies.push({ action: 'ask_user', description: '使用更保守的编辑策略' });
      break;

    case 'network_error':
      strategies.push({ action: 'retry', description: '等待后重试' });
      strategies.push({ action: 'skip', description: '跳过网络操作' });
      break;

    case 'git_error':
      strategies.push({ action: 'auto_fix', description: '检查 git 状态' });
      if (lastCp) {
        strategies.push({ action: 'restore_checkpoint', description: '恢复到最近 checkpoint', checkpoint: lastCp });
      }
      break;

    default:
      if (lastCp) {
        strategies.push({ action: 'restore_checkpoint', description: '回滚到 checkpoint', checkpoint: lastCp });
      }
      strategies.push({ action: 'ask_user', description: '询问用户如何处理' });
  }

  return strategies;
}

// 智能恢复 - 根据错误类型自动选择最佳恢复策略
export async function smartRecover(
  error: string,
  options?: { autoRestore?: boolean; maxRetries?: number }
): Promise<{ success: boolean; action: string; message: string }> {
  const analysis = analyzeError(error);
  const strategies = await getRecoveryStrategy(error);

  // 严重错误自动恢复
  if (analysis.severity === 'critical' && options?.autoRestore) {
    const restoreStrategy = strategies.find(s => s.action === 'restore_checkpoint');
    if (restoreStrategy?.checkpoint) {
      const result = await restoreCheckpoint(restoreStrategy.checkpoint.id);
      return {
        success: result.success,
        action: 'restore_checkpoint',
        message: result.message,
      };
    }
  }

  // 返回建议
  return {
    success: false,
    action: 'suggest',
    message: strategies.map(s => s.description).join('; '),
  };
}

// 批量恢复 - 从多个 checkpoint 中选择最佳恢复点
export async function findBestCheckpoint(
  criteria: { files?: string[]; before?: string; type?: CheckpointMeta['type'] }
): Promise<CheckpointMeta | null> {
  const checkpoints = await listCheckpoints();

  let filtered = checkpoints;

  if (criteria.type) {
    filtered = filtered.filter(c => c.type === criteria.type);
  }

  if (criteria.before) {
    const beforeTime = new Date(criteria.before).getTime();
    filtered = filtered.filter(c => new Date(c.timestamp).getTime() < beforeTime);
  }

  if (criteria.files && criteria.files.length > 0) {
    // 找到包含指定文件的 checkpoint
    filtered = filtered.filter(c =>
      criteria.files!.some(f => c.files.some(cf => cf.includes(f)))
    );
  }

  return filtered[0] || null;
}