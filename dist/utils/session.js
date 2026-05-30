// 会话持久化 - 保存和恢复对话状态
import fs from 'fs-extra';
import { join } from 'path';
// Session size limits (prevent huge session files that cause API timeouts)
const MAX_SESSION_MESSAGES = 50; // 最多保存50条消息
const MAX_MESSAGE_LENGTH = 2000; // 每条消息最多2000字符
const SESSIONS_DIR = '.spica/sessions';
// Generate unique session ID
function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `sess_${timestamp}_${random}`;
}
// Load current session (session.json in .spica/)
export function loadSession(workspacePath) {
    const sessionPath = join(workspacePath, '.spica', 'session.json');
    try {
        if (fs.existsSync(sessionPath)) {
            const session = fs.readJsonSync(sessionPath);
            return session;
        }
    }
    catch (error) {
        // 忽略读取错误
    }
    return null;
}
// Truncate messages before saving to prevent huge session files
function truncateMessages(messages) {
    const recent = messages.slice(-MAX_SESSION_MESSAGES);
    return recent.map(m => ({
        ...m,
        content: (m.content || '').length > MAX_MESSAGE_LENGTH
            ? (m.content || '').slice(0, MAX_MESSAGE_LENGTH) + '...[truncated]'
            : m.content,
    }));
}
// Save current session
export function saveSession(workspacePath, messages, sessionName) {
    const spicaDir = join(workspacePath, '.spica');
    try {
        fs.ensureDirSync(spicaDir);
        const truncated = truncateMessages(messages);
        const existingSession = loadSession(workspacePath);
        const session = {
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
    }
    catch (error) {
        // 忽略保存错误
    }
}
// Archive session to sessions directory
function archiveSession(workspacePath, session) {
    try {
        const sessionsDir = join(workspacePath, SESSIONS_DIR);
        fs.ensureDirSync(sessionsDir);
        // Save with session ID as filename
        const sessionPath = join(sessionsDir, `${session.id}.json`);
        fs.writeJsonSync(sessionPath, session, { spaces: 2 });
        // Clean up old sessions (keep max 10)
        cleanupOldSessions(sessionsDir, 10);
    }
    catch (error) {
        // 忽略归档错误
    }
}
// Clean up old sessions
function cleanupOldSessions(sessionsDir, maxKeep) {
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
                }
                catch { }
            });
        }
    }
    catch (error) {
        // 忽略清理错误
    }
}
// List all archived sessions
export function listSessions(workspacePath) {
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
    }
    catch (error) {
        return [];
    }
}
// Load specific session by ID
export function loadSessionById(workspacePath, sessionId) {
    const sessionPath = join(workspacePath, SESSIONS_DIR, `${sessionId}.json`);
    try {
        if (fs.existsSync(sessionPath)) {
            return fs.readJsonSync(sessionPath);
        }
    }
    catch (error) { }
    return null;
}
// Switch to a specific session
export function switchSession(workspacePath, sessionId) {
    const session = loadSessionById(workspacePath, sessionId);
    if (!session)
        return false;
    try {
        const spicaDir = join(workspacePath, '.spica');
        fs.writeJsonSync(join(spicaDir, 'session.json'), session, { spaces: 2 });
        return true;
    }
    catch (error) {
        return false;
    }
}
// Clear current session
export function clearSession(workspacePath) {
    const sessionPath = join(workspacePath, '.spica', 'session.json');
    try {
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
        }
    }
    catch (error) {
        // 忽略清除错误
    }
}
// Delete a specific archived session
export function deleteSession(workspacePath, sessionId) {
    const sessionPath = join(workspacePath, SESSIONS_DIR, `${sessionId}.json`);
    try {
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
            return true;
        }
    }
    catch (error) { }
    return false;
}
// Rename a session
export function renameSession(workspacePath, sessionId, newName) {
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
    }
    catch (error) { }
    return false;
}
//# sourceMappingURL=session.js.map