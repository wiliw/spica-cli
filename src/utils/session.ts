// 会话持久化 - 保存和恢复对话状态

import fs from 'fs-extra';
import { join } from 'path';
import type { ChatMessage } from '../llm/providers/BaseProvider';

// Session size limits (prevent huge session files that cause API timeouts)
const MAX_SESSION_MESSAGES = 50;  // 最多保存50条消息
const MAX_MESSAGE_LENGTH = 2000;  // 每条消息最多2000字符

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

// Truncate messages before saving to prevent huge session files
function truncateMessages(messages: ChatMessage[]): ChatMessage[] {
  // Keep only recent messages (prevent session from growing indefinitely)
  const recent = messages.slice(-MAX_SESSION_MESSAGES);

  // Truncate each message's content
  return recent.map(m => ({
    ...m,
    content: (m.content || '').length > MAX_MESSAGE_LENGTH
      ? (m.content || '').slice(0, MAX_MESSAGE_LENGTH) + '...[truncated]'
      : m.content,
  }));
}

export function saveSession(workspacePath: string, messages: ChatMessage[]): void {
  const spicaDir = join(workspacePath, '.spica');

  try {
    fs.ensureDirSync(spicaDir);

    // Truncate before saving
    const truncated = truncateMessages(messages);

    const session: SessionState = {
      workspacePath,
      messages: truncated,
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