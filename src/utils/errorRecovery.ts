// 错误恢复策略 - git checkpoint、智能重试

import simpleGit from 'simple-git';
import fs from 'fs-extra';
import { join } from 'path';

let WORKSPACE = process.cwd();
let lastCheckpoint: string | null = null;

export interface ErrorAnalysis {
  type: 'file_not_found' | 'permission_denied' | 'syntax_error' | 'network_error' | 'unknown';
  recoverable: boolean;
  suggestion: string;
}

// 创建checkpoint
export async function createCheckpoint(message: string = 'auto checkpoint'): Promise<string | null> {
  try {
    const git = simpleGit(WORKSPACE);

    // 检查是否有git仓库
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return null;
    }

    // 获取当前状态
    const status = await git.status();

    // 只有有更改时才创建checkpoint
    if (status.files.length === 0) {
      return null;
    }

    // 保存当前状态
    await git.add('.');
    await git.commit(`[spica checkpoint] ${message}`);

    lastCheckpoint = await git.revparse(['HEAD']);
    return lastCheckpoint;
  } catch (error) {
    // git操作失败，忽略
    return null;
  }
}

// 恢复到checkpoint
export async function restoreCheckpoint(commitHash?: string): Promise<boolean> {
  try {
    const git = simpleGit(WORKSPACE);

    const target = commitHash || lastCheckpoint;
    if (!target) {
      return false;
    }

    await git.reset(['--hard', target]);
    return true;
  } catch (error) {
    return false;
  }
}

// 获取最近的checkpoint
export function getLastCheckpoint(): string | null {
  return lastCheckpoint;
}

// 分析错误类型
export function analyzeError(error: string): ErrorAnalysis {
  const errorLower = error.toLowerCase();

  if (errorLower.includes('enoent') || errorLower.includes('not found') || errorLower.includes('不存在')) {
    return {
      type: 'file_not_found',
      recoverable: true,
      suggestion: '使用glob搜索文件，或检查路径',
    };
  }

  if (errorLower.includes('permission') || errorLower.includes('eacces') || errorLower.includes('权限')) {
    return {
      type: 'permission_denied',
      recoverable: true,
      suggestion: '检查文件权限，或询问用户是否使用sudo',
    };
  }

  if (errorLower.includes('syntax') || errorLower.includes('parse') || errorLower.includes('语法')) {
    return {
      type: 'syntax_error',
      recoverable: true,
      suggestion: '重新读取文件，检查语法',
    };
  }

  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('econn')) {
    return {
      type: 'network_error',
      recoverable: true,
      suggestion: '等待后重试，或检查网络连接',
    };
  }

  return {
    type: 'unknown',
    recoverable: false,
    suggestion: '回滚到checkpoint或询问用户',
  };
}

// 获取恢复策略建议
export function getRecoveryStrategy(error: string): string[] {
  const analysis = analyzeError(error);
  const strategies: string[] = [];

  switch (analysis.type) {
    case 'file_not_found':
      strategies.push('使用glob查找类似文件');
      strategies.push('检查路径是否正确');
      strategies.push('询问用户文件位置');
      break;

    case 'permission_denied':
      strategies.push('检查文件权限');
      strategies.push('询问用户是否需要sudo');
      strategies.push('尝试切换到其他目录');
      break;

    case 'syntax_error':
      strategies.push('重新读取文件');
      strategies.push('检查内容格式');
      strategies.push('使用更保守的编辑策略');
      break;

    case 'network_error':
      strategies.push('等待后重试');
      strategies.push('检查网络连接');
      break;

    default:
      if (lastCheckpoint) {
        strategies.push('回滚到checkpoint');
      }
      strategies.push('询问用户如何处理');
  }

  return strategies;
}

// 设置workspace
export function setWorkspace(path: string) {
  WORKSPACE = path;
}