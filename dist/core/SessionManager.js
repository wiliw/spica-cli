import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
export var SessionStatus;
(function (SessionStatus) {
    SessionStatus["ACTIVE"] = "active";
    SessionStatus["PAUSED"] = "paused";
    SessionStatus["COMPLETED"] = "completed";
    SessionStatus["ARCHIVED"] = "archived";
    SessionStatus["FAILED"] = "failed";
})(SessionStatus || (SessionStatus = {}));
export class SessionManager {
    sessionDir;
    cache = new Map();
    constructor(sessionDir) {
        this.sessionDir = sessionDir;
    }
    getSessionPath(id) {
        return path.join(this.sessionDir, `${id}.json`);
    }
    async create(options) {
        await fs.ensureDir(this.sessionDir);
        const now = new Date();
        const session = {
            id: randomUUID(),
            name: options.name,
            workflow: options.workflow || 'default',
            status: SessionStatus.ACTIVE,
            createdAt: now,
            updatedAt: now,
            metadata: options.metadata,
        };
        await this.save(session);
        return session;
    }
    async save(session) {
        await fs.writeJson(this.getSessionPath(session.id), session, { spaces: 2 });
        this.cache.set(session.id, session);
    }
    async get(id) {
        if (this.cache.has(id)) {
            return this.cache.get(id);
        }
        const filePath = this.getSessionPath(id);
        if (!(await fs.pathExists(filePath))) {
            return undefined;
        }
        const data = await fs.readJson(filePath);
        const session = this.parseSession(data);
        this.cache.set(id, session);
        return session;
    }
    parseSession(data) {
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
        };
    }
    async update(id, options) {
        const session = await this.get(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }
        if (options.status !== undefined) {
            session.status = options.status;
        }
        if (options.metadata !== undefined) {
            session.metadata = { ...session.metadata, ...options.metadata };
        }
        session.updatedAt = new Date();
        await this.save(session);
        return session;
    }
    async list(options) {
        await fs.ensureDir(this.sessionDir);
        const files = await fs.readdir(this.sessionDir);
        const sessions = [];
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const id = file.replace('.json', '');
            const session = await this.get(id);
            if (session) {
                if (!options?.status || session.status === options.status) {
                    sessions.push(session);
                }
            }
        }
        sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return sessions;
    }
    async delete(id) {
        const session = await this.get(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }
        await fs.remove(this.getSessionPath(id));
        this.cache.delete(id);
    }
    async resume(id) {
        const session = await this.get(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }
        if (session.status !== SessionStatus.PAUSED) {
            throw new Error(`Cannot resume session with status: ${session.status}`);
        }
        return this.update(id, {
            status: SessionStatus.ACTIVE,
            metadata: { resumedAt: new Date() },
        });
    }
    async archive(id) {
        const session = await this.get(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }
        if (session.status !== SessionStatus.COMPLETED) {
            throw new Error(`Cannot archive session with status: ${session.status}`);
        }
        return this.update(id, { status: SessionStatus.ARCHIVED });
    }
}
//# sourceMappingURL=SessionManager.js.map