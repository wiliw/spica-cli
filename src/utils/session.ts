// 会话持久化 - 保存和恢复对话状态

import fs from 'fs-extra';
import { join } from 'path';
import type { ChatMessage } from '../llm/providers/BaseProvider';
import { cleanMessages } from './messageCleaner';

// Session size limits (prevent huge session files that cause API timeouts)
const MAX_SESSION_MESSAGES = 50;  // 最多保存50条消息
const MAX_MESSAGE_LENGTH = 2000;  // 每条消息最多2000字符
const MAX_SUMMARY_LENGTH = 8000;  // 历史摘要消息最多8000字符（压缩后的重要历史）
const SESSIONS_DIR = '.spica/sessions';

export interface SessionMeta {
  id: string;
  name: string;
  workspacePath: string;
  messageCount: number;
  lastActivity: string;
  createdAt: string;
  summary?: string;
}

export interface SessionState {
  workspacePath: string;
  messages: ChatMessage[];
  lastActivity: string;
  id: string;
  name: string;
  createdAt: string;
}

// Generate unique session ID
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `sess_${timestamp}_${random}`;
}

// Load current session (session.json in .spica/)
export function loadSession(workspacePath: string): SessionState | null {
  const sessionPath = join(workspacePath, '.spica', 'session.json');

  try {
    if (fs.existsSync(sessionPath)) {
      const session = fs.readJsonSync(sessionPath);
      if (session.messages) {
        session.messages = cleanMessages(session.messages);
      }
      return session;
    }
  } catch {
    // 忽略读取错误
  }

  return null;
}

function truncateContent(content: string | undefined, isSummary: boolean = false): string {
  if (!content) return '';
  const maxLength = isSummary ? MAX_SUMMARY_LENGTH : MAX_MESSAGE_LENGTH;
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...[truncated]';
}

// 检查是否是压缩摘要消息
function isSummaryMessage(content: string | undefined): boolean {
  if (!content) return false;
  return content.includes('[History Summary]') || content.includes('[压缩摘要]');
}

function truncateMessages(messages: ChatMessage[]): ChatMessage[] {
  // 分离摘要消息和普通消息
  const summaryMessages: ChatMessage[] = [];
  const regularMessages: ChatMessage[] = [];

  for (const m of messages) {
    if (m.role === 'assistant' && isSummaryMessage(m.content)) {
      summaryMessages.push(m);
    } else {
      regularMessages.push(m);
    }
  }

  // 普通消息只保留最近 N 条
  const recentRegular = regularMessages.slice(-MAX_SESSION_MESSAGES);

  // 合并：摘要消息（完整保留） + 最近普通消息
  const allMessages = [...summaryMessages, ...recentRegular];

  const result: ChatMessage[] = [];
  for (let i = 0; i < allMessages.length; i++) {
    const m = allMessages[i];
    const isSummary = isSummaryMessage(m.content);

    if (m.role === 'tool') {
      result.push({
        role: m.role,
        content: truncateContent(m.content, false),
        toolCallId: m.toolCallId,
      });
    } else if (m.role === 'assistant') {
      const msg: ChatMessage = {
        role: m.role,
        content: truncateContent(m.content, isSummary),
      };
      // 摘要消息没有 toolCalls，但如果有也不截断
      if (m.toolCalls && m.toolCalls.length > 0) {
        // 截断 toolCalls 以防止过大（只保留前 5 个）
        const truncatedToolCalls = m.toolCalls.slice(0, 5);
        if (m.toolCalls.length > 5) {
          truncatedToolCalls.push({
            id: 'truncated',
            name: `...(${m.toolCalls.length - 5} more)`,
            arguments: {}
          });
        }
        msg.toolCalls = truncatedToolCalls;
      }
      result.push(msg);
    } else if (m.role === 'user' || m.role === 'system') {
      result.push({
        role: m.role,
        content: truncateContent(m.content, false),
      });
    }
  }

  return result;
}

// Save current session
export function saveSession(workspacePath: string, messages: ChatMessage[], sessionName?: string): void {
  const spicaDir = join(workspacePath, '.spica');

  try {
    fs.ensureDirSync(spicaDir);

    const truncated = truncateMessages(messages);
    const existingSession = loadSession(workspacePath);
    const cleaned = cleanMessages(truncated);

    const session: SessionState = {
      workspacePath,
      messages: cleaned,
      lastActivity: new Date().toISOString(),
      id: existingSession?.id || generateSessionId(),
      name: sessionName || existingSession?.name || `Session ${new Date().toLocaleDateString()}`,
      createdAt: existingSession?.createdAt || new Date().toISOString(),
    };

    fs.writeJsonSync(join(spicaDir, 'session.json'), session, { spaces: 2 });

    // Also save to sessions history (archive)
    archiveSession(workspacePath, session);
  } catch {
    // 忽略保存错误
  }
}

// Archive session to sessions directory
function archiveSession(workspacePath: string, session: SessionState): void {
  try {
    const sessionsDir = join(workspacePath, SESSIONS_DIR);
    fs.ensureDirSync(sessionsDir);

    // Save with session ID as filename
    const sessionPath = join(sessionsDir, `${session.id}.json`);
    fs.writeJsonSync(sessionPath, session, { spaces: 2 });

    // Clean up old sessions (keep max 10)
    cleanupOldSessions(sessionsDir, 10);
  } catch {
    // 忽略归档错误
  }
}

// Clean up old sessions
function cleanupOldSessions(sessionsDir: string, maxKeep: number): void {
  try {
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.json') && f.startsWith('sess_'))
      .map(f => ({
        name: f,
        path: join(sessionsDir, f),
        time: fs.statSync(join(sessionsDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    // Remove oldest sessions beyond maxKeep
    if (files.length > maxKeep) {
      files.slice(maxKeep).forEach(f => {
        try {
          fs.removeSync(f.path);
        } catch {}
      });
    }
} catch {
      // 忽略清理错误
    }
}

// List all archived sessions
export function listSessions(workspacePath: string): SessionMeta[] {
  const sessionsDir = join(workspacePath, SESSIONS_DIR);

  try {
    if (!fs.existsSync(sessionsDir)) {
      return [];
    }

    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.json') && f.startsWith('sess_'))
      .map(f => {
        const session = fs.readJsonSync(join(sessionsDir, f));
        return {
          id: session.id,
          name: session.name,
          workspacePath: session.workspacePath,
          messageCount: session.messages?.length || 0,
          lastActivity: session.lastActivity,
          createdAt: session.createdAt,
          summary: session.summary,
        };
      })
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    return files;
  } catch {
    return [];
  }
}

// Load specific session by ID
export function loadSessionById(workspacePath: string, sessionId: string): SessionState | null {
  const sessionPath = join(workspacePath, SESSIONS_DIR, `${sessionId}.json`);

  try {
    if (fs.existsSync(sessionPath)) {
      const session = fs.readJsonSync(sessionPath);
      if (session.messages) {
        session.messages = cleanMessages(session.messages);
      }
      return session;
    }
  } catch {}

  return null;
}

// Switch to a specific session
export function switchSession(workspacePath: string, sessionId: string): boolean {
  const session = loadSessionById(workspacePath, sessionId);
  if (!session) return false;

  try {
    const spicaDir = join(workspacePath, '.spica');
    fs.writeJsonSync(join(spicaDir, 'session.json'), session, { spaces: 2 });
    return true;
  } catch {
    return false;
  }
}

// Clear current session
export function clearSession(workspacePath: string): void {
  const sessionPath = join(workspacePath, '.spica', 'session.json');

  try {
    if (fs.existsSync(sessionPath)) {
      fs.removeSync(sessionPath);
    }
  } catch {
    // 忽略清除错误
  }
}

// Delete a specific archived session
export function deleteSession(workspacePath: string, sessionId: string): boolean {
  const sessionPath = join(workspacePath, SESSIONS_DIR, `${sessionId}.json`);

  try {
    if (fs.existsSync(sessionPath)) {
      fs.removeSync(sessionPath);
      return true;
    }
  } catch {}

  return false;
}

// Rename a session
export function renameSession(workspacePath: string, sessionId: string, newName: string): boolean {
  try {
    // Check if it's current session
    const currentSession = loadSession(workspacePath);
    if (currentSession?.id === sessionId) {
      currentSession.name = newName;
      fs.writeJsonSync(join(workspacePath, '.spica', 'session.json'), currentSession, { spaces: 2 });
    }

    // Update archived session
    const session = loadSessionById(workspacePath, sessionId);
    if (session) {
      session.name = newName;
      fs.writeJsonSync(join(workspacePath, SESSIONS_DIR, `${sessionId}.json`), session, { spaces: 2 });
      return true;
    }
  } catch {}

  return false;
}