// 会话持久化 - 保存和恢复对话状态

import fs from 'fs-extra';
import { join } from 'path';
import type { ChatMessage } from '../llm/providers/BaseProvider';

export interface SessionState {
  workspacePath: string;
  messages: ChatMessage[];
  lastActivity: string;
}

export function loadSession(workspacePath: string): SessionState | null {
  const sessionPath = join(workspacePath, '.spica', 'session.json');

  try {
    if (fs.existsSync(sessionPath)) {
      const session = fs.readJsonSync(sessionPath);
      return session;
    }
  } catch (error) {
    // 忽略读取错误
  }

  return null;
}

export function saveSession(workspacePath: string, messages: ChatMessage[]): void {
  const spicaDir = join(workspacePath, '.spica');

  try {
    fs.ensureDirSync(spicaDir);

    const session: SessionState = {
      workspacePath,
      messages,
      lastActivity: new Date().toISOString(),
    };

    fs.writeJsonSync(join(spicaDir, 'session.json'), session, { spaces: 2 });
  } catch (error) {
    // 忽略保存错误
  }
}

export function clearSession(workspacePath: string): void {
  const sessionPath = join(workspacePath, '.spica', 'session.json');

  try {
    if (fs.existsSync(sessionPath)) {
      fs.removeSync(sessionPath);
    }
  } catch (error) {
    // 忽略清除错误
  }
}