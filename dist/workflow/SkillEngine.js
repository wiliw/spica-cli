import { EventEmitter } from 'node:events';
export class SkillEngine extends EventEmitter {
    skills = new Map();
    currentExecution = null;
    registerSkill(name, skill) {
        this.skills.set(name, skill);
    }
    hasSkill(name) {
        return this.skills.has(name);
    }
    async execute(name, context) {
        const skill = this.skills.get(name);
        if (!skill) {
            throw new Error(`Skill not found: ${name}`);
        }
        this.currentExecution = name;
        this.emit('executionStarted', name);
        try {
            await skill.execute(context);
            this.emit('executionCompleted', name);
        }
        catch (error) {
            this.emit('executionError', { name, error });
            throw error;
        }
        finally {
            this.currentExecution = null;
        }
    }
    getSkillStatus(name) {
        const skill = this.skills.get(name);
        return skill?.getStatus?.() || null;
    }
    listSkills() {
        return Array.from(this.skills.keys());
    }
    on(event, listener) {
        return super.on(event, listener);
    }
}
//# sourceMappingURL=SkillEngine.js.map