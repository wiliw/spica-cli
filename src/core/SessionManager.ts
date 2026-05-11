import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';

export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
  FAILED = 'failed',
}

export interface Session {
  id: string;
  name: string;
  workflow: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionOptions {
  name: string;
  workflow?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionOptions {
  status?: SessionStatus;
  metadata?: Record<string, unknown>;
}

export interface ListSessionOptions {
  status?: SessionStatus;
}

export class SessionManager {
  private sessionDir: string;
  private cache: Map<string, Session> = new Map();

  constructor(sessionDir: string) {
    this.sessionDir = sessionDir;
  }

  private getSessionPath(id: string): string {
    return path.join(this.sessionDir, `${id}.json`);
  }

  async create(options: CreateSessionOptions): Promise<Session> {
    await fs.ensureDir(this.sessionDir);

    const now = new Date();
    const session: Session = {
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

  private async save(session: Session): Promise<void> {
    await fs.writeJson(this.getSessionPath(session.id), session, { spaces: 2 });
    this.cache.set(session.id, session);
  }

  async get(id: string): Promise<Session | undefined> {
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

  private parseSession(data: Record<string, unknown>): Session {
    return {
      ...data,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
    } as Session;
  }

  async update(id: string, options: UpdateSessionOptions): Promise<Session> {
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

  async list(options?: ListSessionOptions): Promise<Session[]> {
    await fs.ensureDir(this.sessionDir);
    const files = await fs.readdir(this.sessionDir);
    const sessions: Session[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
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

  async delete(id: string): Promise<void> {
    const session = await this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    await fs.remove(this.getSessionPath(id));
    this.cache.delete(id);
  }

  async resume(id: string): Promise<Session> {
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

  async archive(id: string): Promise<Session> {
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