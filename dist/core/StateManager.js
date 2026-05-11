import fs from 'fs-extra';
import path from 'path';
export class StateManager {
    stateDir;
    cache = new Map();
    constructor(stateDir) {
        this.stateDir = stateDir;
    }
    getStatePath(key) {
        return path.join(this.stateDir, `${key}.json`);
    }
    async save(key, state) {
        await fs.ensureDir(this.stateDir);
        const filePath = this.getStatePath(key);
        await fs.writeJson(filePath, state, { spaces: 2 });
        this.cache.set(key, state);
    }
    async load(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const filePath = this.getStatePath(key);
        if (!(await fs.pathExists(filePath))) {
            return undefined;
        }
        const state = await fs.readJson(filePath);
        this.cache.set(key, state);
        return state;
    }
    async update(key, updates) {
        const existing = (await this.load(key)) || {};
        const merged = { ...existing, ...updates };
        await this.save(key, merged);
    }
    async delete(key) {
        const filePath = this.getStatePath(key);
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
        }
        this.cache.delete(key);
    }
    async list() {
        await fs.ensureDir(this.stateDir);
        const files = await fs.readdir(this.stateDir);
        return files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    }
    async clear() {
        const keys = await this.list();
        await Promise.all(keys.map(key => this.delete(key)));
        this.cache.clear();
    }
}
//# sourceMappingURL=StateManager.js.map