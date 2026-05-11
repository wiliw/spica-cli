import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { SessionManager, SessionStatus } from '../SessionManager';
const TEST_SESSION_DIR = '/tmp/spica-test-sessions';
describe('SessionManager', () => {
    let sessionManager;
    beforeEach(async () => {
        await fs.ensureDir(TEST_SESSION_DIR);
        sessionManager = new SessionManager(TEST_SESSION_DIR);
    });
    afterEach(async () => {
        await fs.remove(TEST_SESSION_DIR);
    });
    describe('create', () => {
        it('creates a new session', async () => {
            const session = await sessionManager.create({
                name: 'test-session',
                workflow: 'mvp',
            });
            expect(session.id).toBeDefined();
            expect(session.name).toBe('test-session');
            expect(session.workflow).toBe('mvp');
            expect(session.status).toBe(SessionStatus.ACTIVE);
            expect(session.createdAt).toBeInstanceOf(Date);
        });
        it('generates unique IDs for sessions', async () => {
            const session1 = await sessionManager.create({ name: 's1' });
            const session2 = await sessionManager.create({ name: 's2' });
            expect(session1.id).not.toBe(session2.id);
        });
        it('persists session to storage', async () => {
            const session = await sessionManager.create({ name: 'persisted' });
            const loaded = await sessionManager.get(session.id);
            expect(loaded).toEqual(session);
        });
    });
    describe('get', () => {
        it('returns session by id', async () => {
            const created = await sessionManager.create({ name: 'test' });
            const loaded = await sessionManager.get(created.id);
            expect(loaded).toEqual(created);
        });
        it('returns undefined for non-existent session', async () => {
            const loaded = await sessionManager.get('nonexistent');
            expect(loaded).toBeUndefined();
        });
    });
    describe('update', () => {
        it('updates session state', async () => {
            const session = await sessionManager.create({ name: 'test' });
            await sessionManager.update(session.id, {
                status: SessionStatus.PAUSED,
                metadata: { progress: 50 },
            });
            const updated = await sessionManager.get(session.id);
            expect(updated?.status).toBe(SessionStatus.PAUSED);
            expect(updated?.metadata?.progress).toBe(50);
        });
        it('throws for non-existent session', async () => {
            await expect(sessionManager.update('nonexistent', { status: SessionStatus.COMPLETED })).rejects.toThrow();
        });
    });
    describe('list', () => {
        it('lists all sessions', async () => {
            await sessionManager.create({ name: 's1' });
            await sessionManager.create({ name: 's2' });
            await sessionManager.create({ name: 's3' });
            const sessions = await sessionManager.list();
            expect(sessions).toHaveLength(3);
        });
        it('filters sessions by status', async () => {
            const s1 = await sessionManager.create({ name: 'active' });
            const s2 = await sessionManager.create({ name: 'to-complete' });
            await sessionManager.update(s2.id, { status: SessionStatus.COMPLETED });
            const active = await sessionManager.list({ status: SessionStatus.ACTIVE });
            expect(active).toHaveLength(1);
            expect(active[0].id).toBe(s1.id);
        });
        it('sorts sessions by creation date', async () => {
            const s1 = await sessionManager.create({ name: 'first' });
            await new Promise(r => setTimeout(r, 10));
            const s2 = await sessionManager.create({ name: 'second' });
            const sessions = await sessionManager.list();
            expect(sessions[0].id).toBe(s2.id); // newest first
        });
    });
    describe('delete', () => {
        it('deletes a session', async () => {
            const session = await sessionManager.create({ name: 'to-delete' });
            await sessionManager.delete(session.id);
            const loaded = await sessionManager.get(session.id);
            expect(loaded).toBeUndefined();
        });
        it('throws for non-existent session', async () => {
            await expect(sessionManager.delete('nonexistent')).rejects.toThrow();
        });
    });
    describe('resume', () => {
        it('resumes a paused session', async () => {
            const session = await sessionManager.create({ name: 'resumable' });
            await sessionManager.update(session.id, { status: SessionStatus.PAUSED });
            const resumed = await sessionManager.resume(session.id);
            expect(resumed.status).toBe(SessionStatus.ACTIVE);
            expect(resumed.metadata?.resumedAt).toBeDefined();
        });
        it('fails for non-paused sessions', async () => {
            const session = await sessionManager.create({ name: 'active' });
            await expect(sessionManager.resume(session.id)).rejects.toThrow();
        });
    });
    describe('archive', () => {
        it('archives a completed session', async () => {
            const session = await sessionManager.create({ name: 'to-archive' });
            await sessionManager.update(session.id, { status: SessionStatus.COMPLETED });
            const archived = await sessionManager.archive(session.id);
            expect(archived.status).toBe(SessionStatus.ARCHIVED);
        });
        it('fails for non-completed sessions', async () => {
            const session = await sessionManager.create({ name: 'not-done' });
            await expect(sessionManager.archive(session.id)).rejects.toThrow();
        });
    });
});
//# sourceMappingURL=SessionManager.test.js.map