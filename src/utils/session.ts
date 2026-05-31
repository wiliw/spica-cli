// 会话持久化 - 保存和恢复对话状态

import fs from 'fs-extra';
import { join } from 'path';
import type { ChatMessage } from '../llm/providers/BaseProvider';

// Session size limits (prevent huge session files that cause API timeouts)
const MAX_SESSION_MESSAGES = 50;  // 最多保存50条消息
const MAX_MESSAGE_LENGTH = 2000;  // 每条消息最多2000字符
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

function cleanMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  const usedToolCallIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      // 检查这个assistant的tool_calls是否都有对应的tool响应
      const expectedIds = m.toolCalls.map(tc => tc.id);
      let j = i + 1;
      const foundIds: string[] = [];
      while (j < messages.length && messages[j].role === 'tool') {
        foundIds.push(messages[j].toolCallId || '');
        j++;
      }
      
      const missing = expectedIds.filter(id => !foundIds.includes(id) || usedToolCallIds.has(id));
      
      if (missing.length === 0) {
        // 完整配对，保留assistant和所有tool响应
        result.push({ role: 'assistant', content: m.content || '', toolCalls: m.toolCalls });
        for (let k = i + 1; k < j; k++) {
          result.push(messages[k]);
          usedToolCallIds.add(messages[k].toolCallId || '');
        }
      } else {
        // 不完整，只保留assistant纯文本
        result.push({ role: 'assistant', content: m.content || '' });
      }
      i = j - 1; // 跳过已处理的tool消息
    } else if (m.role === 'tool') {
      // 单独的tool消息（没有前面的assistant），跳过
      continue;
    } else {
      // user或纯文本assistant，保留
      result.push({ role: m.role, content: m.content || '' });
    }
  }

  return result;
}

// Truncate messages before saving to prevent huge session files
function truncateMessages(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_SESSION_MESSAGES);

  return recent
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content && m.content.length > 0))
    .map(m => ({
      role: m.role,
      content: (m.content || '').slice(0, MAX_MESSAGE_LENGTH) + 
        ((m.content || '').length > MAX_MESSAGE_LENGTH ? '...[truncated]' : ''),
    }));
}

// Save current session
export function saveSession(workspacePath: string, messages: ChatMessage[], sessionName?: string): void {
  const spicaDir = join(workspacePath, '.spica');

  try {
    fs.ensureDirSync(spicaDir);

    const truncated = truncateMessages(messages);
    const existingSession = loadSession(workspacePath);

    const session: SessionState = {
      workspacePath,
      messages: truncated,
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