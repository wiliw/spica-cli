// Checkpoint 系统 - 多级存储、元数据、智能恢复

import simpleGit from 'simple-git';
import fs from 'fs-extra';
import { join } from 'path';
import { homedir } from 'os';

// Checkpoint 元数据
export interface CheckpointMeta {
  id: string;           // commit hash
  timestamp: string;    // ISO 时间
  message: string;      // 描述
  workspace: string;    // 工作目录
  files: string[];      // 影响的文件
  type: 'auto' | 'manual' | 'pre_task';  // 类型
  parent?: string;      // 父 checkpoint
}

// Checkpoint 存储
interface CheckpointStore {
  checkpoints: CheckpointMeta[];
  maxCheckpoints: number;
  version: string;
}

let WORKSPACE = process.cwd();
const STORE_VERSION = '1.0';
const DEFAULT_MAX = 20;

// 获取存储路径
function getStorePath(workspace: string): string {
  const projectHash = Buffer.from(workspace).toString('base64').replace(/[\/+=]/g, '_');
  return join(homedir(), '.spica', 'checkpoints', `${projectHash}.json`);
}

// 加载存储
async function loadStore(workspace: string): Promise<CheckpointStore> {
  const storePath = getStorePath(workspace);
  try {
    const data = await fs.readJson(storePath);
    return data;
  } catch {
    return {
      checkpoints: [],
      maxCheckpoints: DEFAULT_MAX,
      version: STORE_VERSION,
    };
  }
}

// 保存存储
async function saveStore(workspace: string, store: CheckpointStore): Promise<void> {
  const storePath = getStorePath(workspace);
  await fs.ensureDir(join(homedir(), '.spica', 'checkpoints'));
  await fs.writeJson(storePath, store, { spaces: 2 });
}

// 设置 workspace
export function setCheckpointWorkspace(path: string): void {
  WORKSPACE = path;
}

// 创建 checkpoint
export async function createCheckpoint(
  message: string = 'auto checkpoint',
  type: CheckpointMeta['type'] = 'auto'
): Promise<CheckpointMeta | null> {
  try {
    const git = simpleGit(WORKSPACE);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return null;
    }

    const status = await git.status();
    if (status.files.length === 0) {
      return null;
    }

    // 获取影响的文件
    const files = status.files.map(f => f.path);

    // git commit
    await git.add('.');
    await git.commit(`[spica checkpoint] ${message}`);

    const id = await git.revparse(['HEAD']);
    const parent = status.current ? await git.revparse(['HEAD~1']) : undefined;

    const meta: CheckpointMeta = {
      id,
      timestamp: new Date().toISOString(),
      message,
      workspace: WORKSPACE,
      files,
      type,
      parent,
    };

    // 保存到存储
    const store = await loadStore(WORKSPACE);
    store.checkpoints.unshift(meta);

    // 清理旧的 checkpoint
    if (store.checkpoints.length > store.maxCheckpoints) {
      const toRemove = store.checkpoints.splice(store.maxCheckpoints);
      // 可选：删除对应的 git 分支/tag（如果需要）
    }

    await saveStore(WORKSPACE, store);

    return meta;
  } catch (error) {
    return null;
  }
}

// 列出所有 checkpoint
export async function listCheckpoints(workspace?: string): Promise<CheckpointMeta[]> {
  const store = await loadStore(workspace || WORKSPACE);
  return store.checkpoints;
}

// 获取最近的 checkpoint
export async function getLastCheckpoint(workspace?: string): Promise<CheckpointMeta | null> {
  const store = await loadStore(workspace || WORKSPACE);
  return store.checkpoints[0] || null;
}

// 获取指定 checkpoint
export async function getCheckpoint(id: string, workspace?: string): Promise<CheckpointMeta | null> {
  const store = await loadStore(workspace || WORKSPACE);
  return store.checkpoints.find(c => c.id === id) || null;
}

// 恢复到 checkpoint
export async function restoreCheckpoint(
  id?: string,
  options?: { files?: string[]; soft?: boolean }
): Promise<{ success: boolean; message: string; restoredFiles?: string[] }> {
  try {
    const git = simpleGit(WORKSPACE);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return { success: false, message: 'Not a git repository' };
    }

    // 获取目标 checkpoint
    const store = await loadStore(WORKSPACE);
    const target = id
      ? store.checkpoints.find(c => c.id === id)
      : store.checkpoints[0];

    if (!target) {
      return { success: false, message: 'Checkpoint not found' };
    }

    // 选择性恢复文件
    if (options?.files && options.files.length > 0) {
      // 只恢复指定文件
      for (const file of options.files) {
        await git.checkout([target.id, '--', file]);
      }
      return {
        success: true,
        message: `Restored ${options.files.length} files`,
        restoredFiles: options.files,
      };
    }

    // 完整恢复
    if (options?.soft) {
      // 软恢复：保留工作区更改
      await git.reset(['--soft', target.id]);
      return { success: true, message: 'Soft restored (changes preserved)' };
    } else {
      // 硬恢复：完全重置
      await git.reset(['--hard', target.id]);
      return {
        success: true,
        message: 'Hard restored',
        restoredFiles: target.files,
      };
    }
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 查看 checkpoint diff
export async function diffCheckpoint(
  id?: string,
  options?: { files?: string[] }
): Promise<{ success: boolean; diff?: string; message: string }> {
  try {
    const git = simpleGit(WORKSPACE);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return { success: false, message: 'Not a git repository' };
    }

    const store = await loadStore(WORKSPACE);
    const target = id
      ? store.checkpoints.find(c => c.id === id)
      : store.checkpoints[0];

    if (!target) {
      return { success: false, message: 'Checkpoint not found' };
    }

    // 获取 diff
    let diff: string;
    if (options?.files && options.files.length > 0) {
      diff = await git.diff([target.id, '--', ...options.files]);
    } else {
      diff = await git.diff([target.id]);
    }

    return { success: true, diff, message: 'Diff generated' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 清理 checkpoint
export async function clearCheckpoints(
  options?: { keep?: number; olderThan?: number }
): Promise<{ success: boolean; removed: number; message: string }> {
  try {
    const store = await loadStore(WORKSPACE);
    const originalLength = store.checkpoints.length;

    let toRemove: CheckpointMeta[] = [];

    if (options?.olderThan) {
      // 删除超过指定天数的
      const cutoff = Date.now() - options.olderThan * 24 * 60 * 60 * 1000;
      store.checkpoints = store.checkpoints.filter(c => {
        const keep = new Date(c.timestamp).getTime() > cutoff;
        if (!keep) toRemove.push(c);
        return keep;
      });
    } else if (options?.keep) {
      // 保留最近 N 个
      if (store.checkpoints.length > options.keep) {
        toRemove = store.checkpoints.splice(options.keep);
      }
    } else {
      // 清空所有
      toRemove = [...store.checkpoints];
      store.checkpoints = [];
    }

    await saveStore(WORKSPACE, store);

    return {
      success: true,
      removed: toRemove.length,
      message: `Removed ${toRemove.length} checkpoints`,
    };
  } catch (error: any) {
    return { success: false, removed: 0, message: error.message };
  }
}

// 设置最大 checkpoint 数量
export async function setMaxCheckpoints(max: number): Promise<void> {
  const store = await loadStore(WORKSPACE);
  store.maxCheckpoints = max;
  await saveStore(WORKSPACE, store);
}

// 获取 checkpoint 统计
export async function getCheckpointStats(workspace?: string): Promise<{
  total: number;
  auto: number;
  manual: number;
  pre_task: number;
  oldest?: string;
  newest?: string;
}> {
  const store = await loadStore(workspace || WORKSPACE);
  const checkpoints = store.checkpoints;

  return {
    total: checkpoints.length,
    auto: checkpoints.filter(c => c.type === 'auto').length,
    manual: checkpoints.filter(c => c.type === 'manual').length,
    pre_task: checkpoints.filter(c => c.type === 'pre_task').length,
    oldest: checkpoints[checkpoints.length - 1]?.timestamp,
    newest: checkpoints[0]?.timestamp,
  };
}

// 导出 checkpoint 历史
export async function exportCheckpoints(workspace?: string): Promise<string> {
  const store = await loadStore(workspace || WORKSPACE);
  return JSON.stringify(store, null, 2);
}

// 导入 checkpoint 历史
export async function importCheckpoints(
  data: string,
  options?: { merge?: boolean }
): Promise<{ success: boolean; imported: number; message: string }> {
  try {
    const imported = JSON.parse(data) as CheckpointStore;

    if (!imported.checkpoints || !Array.isArray(imported.checkpoints)) {
      return { success: false, imported: 0, message: 'Invalid checkpoint data' };
    }

    if (options?.merge) {
      const store = await loadStore(WORKSPACE);
      // 合并并去重
      const existingIds = new Set(store.checkpoints.map(c => c.id));
      const newCheckpoints = imported.checkpoints.filter(c => !existingIds.has(c.id));
      store.checkpoints.push(...newCheckpoints);
      // 按时间排序
      store.checkpoints.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      await saveStore(WORKSPACE, store);
      return {
        success: true,
        imported: newCheckpoints.length,
        message: `Merged ${newCheckpoints.length} checkpoints`,
      };
    } else {
      await saveStore(WORKSPACE, imported);
      return {
        success: true,
        imported: imported.checkpoints.length,
        message: `Imported ${imported.checkpoints.length} checkpoints`,
      };
    }
  } catch (error: any) {
    return { success: false, imported: 0, message: error.message };
  }
}