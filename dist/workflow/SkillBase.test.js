import { describe, it, expect } from 'vitest';
import { SkillBase } from './SkillBase';
class TestSkill extends SkillBase {
    getSteps() {
        return this.steps;
    }
    async run() {
        return this.executeStep(0);
    }
    async executeStep(index) {
        this.startStep(index);
        await this.completeStep(index);
    }
}
describe('SkillBase', () => {
    it('should initialize with name and steps', () => {
        const skill = new TestSkill('test-skill', 'Test skill', [
            { name: 'step1', description: 'First step' },
            { name: 'step2', description: 'Second step' },
        ]);
        expect(skill.getName()).toBe('test-skill');
        expect(skill.getDescription()).toBe('Test skill');
        expect(skill.getSteps()).toHaveLength(2);
    });
    it('should validate iron laws', () => {
        const skill = new TestSkill('test', 'Test', []);
        skill.addIronLaw('Tests must pass');
        skill.addIronLaw('No broken code');
        expect(skill.getIronLaws()).toEqual(['Tests must pass', 'No broken code']);
    });
    it('should emit step events', () => {
        const skill = new TestSkill('test', 'Test', [
            { name: 'step1', description: 'First' },
        ]);
        const events = [];
        skill.on('stepStarted', (step) => events.push(`start:${step.name}`));
        skill.on('stepCompleted', (step) => events.push(`complete:${step.name}`));
        skill.startStep(0);
        skill.completeStep(0);
        expect(events).toEqual(['start:step1', 'complete:step1']);
    });
    it('should track execution status', () => {
        const skill = new TestSkill('test', 'Test', [
            { name: 'step1', description: 'First' },
        ]);
        expect(skill.getStatus()).toBe('idle');
        skill.startStep(0);
        expect(skill.getStatus()).toBe('running');
        skill.completeStep(0);
        expect(skill.getStatus()).toBe('completed');
    });
    it('should not proceed if iron law violated', () => {
        const skill = new TestSkill('test', 'Test', [
            { name: 'step1', description: 'First' },
        ]);
        skill.addIronLaw('Must have tests');
        skill.markIronLawViolated('Must have tests');
        expect(() => skill.startStep(0)).toThrow('Iron law violated');
    });
    it('should validate prerequisites', () => {
        const skill = new TestSkill('test', 'Test', [
            { name: 'step1', description: 'First', requires: ['setup'] },
            { name: 'setup', description: 'Setup step' },
        ]);
        expect(() => skill.startStep(0)).toThrow('Prerequisite not met');
    });
    it('should serialize state', () => {
        const skill = new TestSkill('test', 'Test', [
            { name: 'step1', description: 'First' },
        ]);
        skill.startStep(0);
        const state = skill.serialize();
        expect(state.name).toBe('test');
        expect(state.currentStepIndex).toBe(0);
        expect(state.status).toBe('running');
    });
    it('should restore from serialized state', () => {
        const skill = new TestSkill('test', 'Test', [
            { name: 'step1', description: 'First' },
        ]);
        const state = {
            name: 'test',
            currentStepIndex: 0,
            status: 'running',
            completedSteps: [0],
        };
        skill.restore(state);
        expect(skill.getStatus()).toBe('running');
        expect(skill.getSteps()[0].status).toBe('completed');
    });
});
//# sourceMappingURL=SkillBase.test.js.map