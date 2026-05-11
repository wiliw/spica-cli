import { describe, it, expect } from 'vitest';
import { CycleSkill } from './CycleSkill';
describe('CycleSkill', () => {
    it('should have correct cycle steps', () => {
        const skill = new CycleSkill();
        const steps = skill.getSteps();
        expect(steps[0].name).toBe('judge');
        expect(steps[1].name).toBe('execute');
        expect(steps[2].name).toBe('test');
        expect(steps[3].name).toBe('update_docs');
        expect(steps[4].name).toBe('demo');
    });
    it('should judge request type correctly', () => {
        const skill = new CycleSkill();
        expect(skill.judgeRequestType('Fix null pointer error')).toBe('bug');
        expect(skill.judgeRequestType('Update button color')).toBe('simple');
        expect(skill.judgeRequestType('Add authentication system')).toBe('complex');
    });
    it('should create bug workflow', () => {
        const skill = new CycleSkill();
        const workflow = skill.createWorkflow('bug');
        expect(workflow).toContain('diagnose');
        expect(workflow).toContain('fix');
        expect(workflow).toContain('test');
    });
    it('should create simple workflow', () => {
        const skill = new CycleSkill();
        const workflow = skill.createWorkflow('simple');
        expect(workflow).toContain('implement');
        expect(workflow).toContain('test');
    });
    it('should create complex workflow', () => {
        const skill = new CycleSkill();
        const workflow = skill.createWorkflow('complex');
        expect(workflow[0]).toBe('write_tests');
        expect(workflow).toContain('implement');
        expect(workflow).toContain('verify');
    });
    it('should implement auto-fix loop', async () => {
        const skill = new CycleSkill();
        let attempts = 0;
        const result = await skill.autoFixLoop(async () => {
            attempts++;
            return attempts >= 3 ? { success: true } : { success: false, error: 'Failed' };
        }, { maxAttempts: 5 });
        expect(result.success).toBe(true);
        expect(attempts).toBe(3);
    });
    it('should stop auto-fix after max attempts', async () => {
        const skill = new CycleSkill();
        let attempts = 0;
        const result = await skill.autoFixLoop(async () => {
            attempts++;
            return { success: false, error: 'Always fails' };
        }, { maxAttempts: 3 });
        expect(result.success).toBe(false);
        expect(attempts).toBe(3);
    });
    it('should enforce iron laws', () => {
        const skill = new CycleSkill();
        const ironLaws = skill.getIronLaws();
        expect(ironLaws).toContain('All tests must pass');
        expect(ironLaws).toContain('No regressions');
    });
    it('should track fix attempts', () => {
        const skill = new CycleSkill();
        skill.startStep(1);
        skill.recordFixAttempt(1, 'fix typo');
        skill.recordFixAttempt(2, 'fix logic');
        skill.recordFixAttempt(3, 'fix edge case');
        const attempts = skill.getFixAttempts();
        expect(attempts).toHaveLength(3);
        expect(attempts[2].description).toBe('fix edge case');
    });
    it('should get appropriate todos for request type', () => {
        const skill = new CycleSkill();
        const bugTodos = skill.getStepTodos('execute', 'bug');
        expect(bugTodos).toContain('Diagnose root cause');
        expect(bugTodos).toContain('Apply fix');
        const simpleTodos = skill.getStepTodos('execute', 'simple');
        expect(simpleTodos).toContain('Implement change');
        const complexTodos = skill.getStepTodos('execute', 'complex');
        expect(complexTodos).toContain('Write tests first');
        expect(complexTodos).toContain('Implement feature');
    });
});
//# sourceMappingURL=CycleSkill.test.js.map