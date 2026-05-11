import { describe, it, expect } from 'vitest';
import { MvpSkill } from './MvpSkill';
describe('MvpSkill', () => {
    it('should have correct MVP steps', () => {
        const skill = new MvpSkill();
        const steps = skill.getSteps();
        expect(steps[0].name).toBe('requirements');
        expect(steps[1].name).toBe('tech_stack');
        expect(steps[2].name).toBe('design');
        expect(steps[3].name).toBe('implement');
        expect(steps[4].name).toBe('documents');
        expect(steps[5].name).toBe('demo');
    });
    it('should enforce iron laws', () => {
        const skill = new MvpSkill();
        const ironLaws = skill.getIronLaws();
        expect(ironLaws).toContain('Core function must work');
        expect(ironLaws).toContain('Tests must pass');
        expect(ironLaws).toContain('No broken builds');
    });
    it('should generate todos per step', () => {
        const skill = new MvpSkill();
        const requirementsTodos = skill.getStepTodos('requirements');
        expect(requirementsTodos).toContain('Ask 3 core questions');
        expect(requirementsTodos).toContain('Capture deadline');
        expect(requirementsTodos).toContain('Note tech constraints');
    });
    it('should generate tech stack todos', () => {
        const skill = new MvpSkill();
        const todos = skill.getStepTodos('tech_stack');
        expect(todos).toContain('Recommend stack');
        expect(todos).toContain('Explain rationale');
    });
    it('should generate design todos', () => {
        const skill = new MvpSkill();
        const todos = skill.getStepTodos('design');
        expect(todos).toContain('Create extensible architecture');
        expect(todos).toContain('Document decisions');
    });
    it('should generate implement todos', () => {
        const skill = new MvpSkill();
        const todos = skill.getStepTodos('implement');
        expect(todos).toContain('Write core code');
        expect(todos).toContain('Run tests');
        expect(todos).toContain('Fix failures');
    });
    it('should generate documents todos', () => {
        const skill = new MvpSkill();
        const todos = skill.getStepTodos('documents');
        expect(todos).toContain('Create spec.md');
        expect(todos).toContain('Create tasks.md');
        expect(todos).toContain('Create project-log.md');
    });
    it('should validate iron law before demo', async () => {
        const skill = new MvpSkill();
        skill.startStep(0);
        skill.completeStep(0);
        skill.startStep(1);
        skill.completeStep(1);
        skill.startStep(2);
        skill.completeStep(2);
        skill.startStep(3);
        skill.completeStep(3);
        skill.startStep(4);
        skill.completeStep(4);
        skill.startStep(5);
        skill.markIronLawViolated('Tests must pass');
        expect(() => skill.completeStep(5)).toThrow('Iron law violated');
    });
    it('should return step requirements', () => {
        const skill = new MvpSkill();
        const implementRequires = skill.getStepRequirements('implement');
        expect(implementRequires).toContain('design');
    });
    it('should validate step prerequisites', () => {
        const skill = new MvpSkill();
        expect(() => skill.startStep(2)).toThrow('Prerequisite not met');
    });
    it('should execute step by step', async () => {
        const skill = new MvpSkill();
        const events = [];
        skill.on('stepStarted', (step) => events.push(`start:${step.name}`));
        skill.on('stepCompleted', (step) => events.push(`complete:${step.name}`));
        skill.startStep(0);
        skill.completeStep(0);
        expect(events).toEqual(['start:requirements', 'complete:requirements']);
    });
});
//# sourceMappingURL=MvpSkill.test.js.map