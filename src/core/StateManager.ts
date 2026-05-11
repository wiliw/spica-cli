import fs from 'fs-extra';
import path from 'path';

export class StateManager {
  private stateDir: string;
  private cache: Map<string, unknown> = new Map();

  constructor(stateDir: string) {
    this.stateDir = stateDir;
  }

  private getStatePath(key: string): string {
    return path.join(this.stateDir, `${key}.json`);
  }

  async save<T>(key: string, state: T): Promise<void> {
    await fs.ensureDir(this.stateDir);
    const filePath = this.getStatePath(key);
    await fs.writeJson(filePath, state, { spaces: 2 });
    this.cache.set(key, state);
  }

  async load<T>(key: string): Promise<T | undefined> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const filePath = this.getStatePath(key);
    if (!(await fs.pathExists(filePath))) {
      return undefined;
    }

    const state = await fs.readJson(filePath);
    this.cache.set(key, state);
    return state as T;
  }

  async update<T extends Record<string, unknown>>(
    key: string,
    updates: Partial<T>
  ): Promise<void> {
    const existing = (await this.load<T>(key)) || ({} as T);
    const merged = { ...existing, ...updates };
    await this.save(key, merged);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getStatePath(key);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
    this.cache.delete(key);
  }

  async list(): Promise<string[]> {
    await fs.ensureDir(this.stateDir);
    const files = await fs.readdir(this.stateDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  async clear(): Promise<void> {
    const keys = await this.list();
    await Promise.all(keys.map(key => this.delete(key)));
    this.cache.clear();
  }
}