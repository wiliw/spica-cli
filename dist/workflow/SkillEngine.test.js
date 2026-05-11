import { describe, it, expect } from 'vitest';
import { SkillEngine } from './SkillEngine';
describe('SkillEngine', () => {
    it('should register skills', () => {
        const engine = new SkillEngine();
        engine.registerSkill('mvp', { name: 'mvp', execute: async () => { } });
        expect(engine.hasSkill('mvp')).toBe(true);
    });
    it('should execute skill by name', async () => {
        const engine = new SkillEngine();
        let executed = false;
        engine.registerSkill('test', {
            name: 'test',
            execute: async () => { executed = true; },
        });
        await engine.execute('test');
        expect(executed).toBe(true);
    });
    it('should throw for unknown skill', async () => {
        const engine = new SkillEngine();
        await expect(engine.execute('unknown')).rejects.toThrow('Skill not found');
    });
    it('should pass context to skill', async () => {
        const engine = new SkillEngine();
        let receivedContext = null;
        engine.registerSkill('test', {
            name: 'test',
            execute: async (ctx) => { receivedContext = ctx; },
        });
        await engine.execute('test', { input: 'hello' });
        expect(receivedContext?.input).toBe('hello');
    });
    it('should emit execution events', async () => {
        const engine = new SkillEngine();
        const events = [];
        engine.registerSkill('test', {
            name: 'test',
            execute: async () => { },
        });
        engine.on('executionStarted', (name) => events.push(`start:${name}`));
        engine.on('executionCompleted', (name) => events.push(`complete:${name}`));
        await engine.execute('test');
        expect(events).toEqual(['start:test', 'complete:test']);
    });
    it('should handle skill errors', async () => {
        const engine = new SkillEngine();
        let errorCaught = false;
        engine.registerSkill('fail', {
            name: 'fail',
            execute: async () => { throw new Error('Skill failed'); },
        });
        engine.on('executionError', () => { errorCaught = true; });
        await expect(engine.execute('fail')).rejects.toThrow('Skill failed');
        expect(errorCaught).toBe(true);
    });
    it('should get skill status', async () => {
        const engine = new SkillEngine();
        engine.registerSkill('test', {
            name: 'test',
            execute: async () => { },
            getStatus: () => 'running',
        });
        expect(engine.getSkillStatus('test')).toBe('running');
    });
    it('should list all registered skills', () => {
        const engine = new SkillEngine();
        engine.registerSkill('mvp', { name: 'mvp', execute: async () => { } });
        engine.registerSkill('cycle', { name: 'cycle', execute: async () => { } });
        const skills = engine.listSkills();
        expect(skills).toContain('mvp');
        expect(skills).toContain('cycle');
        expect(skills).toHaveLength(2);
    });
});
//# sourceMappingURL=SkillEngine.test.js.map