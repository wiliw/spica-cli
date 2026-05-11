import { describe, it, expect } from 'vitest';
import { ArchiveSkill } from './ArchiveSkill';
describe('ArchiveSkill', () => {
    it('should have correct archive steps', () => {
        const skill = new ArchiveSkill();
        const steps = skill.getSteps();
        expect(steps[0].name).toBe('verify_tests');
        expect(steps[1].name).toBe('check_tasks');
        expect(steps[2].name).toBe('update_changelog');
        expect(steps[3].name).toBe('git_commit');
        expect(steps[4].name).toBe('archive');
    });
    it('should generate todos for verify_tests step', () => {
        const skill = new ArchiveSkill();
        const todos = skill.getStepTodos('verify_tests');
        expect(todos).toContain('Run all tests');
        expect(todos).toContain('Verify all pass');
    });
    it('should generate todos for check_tasks step', () => {
        const skill = new ArchiveSkill();
        const todos = skill.getStepTodos('check_tasks');
        expect(todos).toContain('Check tasks.md completion');
        expect(todos).toContain('List incomplete items');
    });
    it('should generate todos for update_changelog step', () => {
        const skill = new ArchiveSkill();
        const todos = skill.getStepTodos('update_changelog');
        expect(todos).toContain('Update CHANGELOG.md');
        expect(todos).toContain('Add version entry');
        expect(todos).toContain('List changes');
    });
    it('should generate todos for git_commit step', () => {
        const skill = new ArchiveSkill();
        const todos = skill.getStepTodos('git_commit');
        expect(todos).toContain('Stage all changes');
        expect(todos).toContain('Create commit');
        expect(todos).toContain('Create git tag');
    });
    it('should generate todos for archive step', () => {
        const skill = new ArchiveSkill();
        const todos = skill.getStepTodos('archive');
        expect(todos).toContain('Move to archive directory');
        expect(todos).toContain('Create archive record');
    });
    it('should enforce iron laws', () => {
        const skill = new ArchiveSkill();
        const ironLaws = skill.getIronLaws();
        expect(ironLaws).toContain('All tests must pass');
        expect(ironLaws).toContain('CHANGELOG must be updated');
        expect(ironLaws).toContain('Git must be clean');
    });
    it('should validate tests pass before proceeding', () => {
        const skill = new ArchiveSkill();
        skill.setTestResults({ passed: 10, failed: 0 });
        expect(skill.canProceedToCommit()).toBe(true);
        skill.setTestResults({ passed: 9, failed: 1 });
        expect(skill.canProceedToCommit()).toBe(false);
    });
    it('should check tasks completion', () => {
        const skill = new ArchiveSkill();
        skill.setTaskCompletion({ total: 5, completed: 5 });
        expect(skill.allTasksCompleted()).toBe(true);
        skill.setTaskCompletion({ total: 5, completed: 4 });
        expect(skill.allTasksCompleted()).toBe(false);
    });
    it('should generate changelog entry', () => {
        const skill = new ArchiveSkill();
        const entry = skill.generateChangelogEntry('v1.0.0', [
            'Add feature X',
            'Fix bug Y',
        ]);
        expect(entry).toContain('## v1.0.0');
        expect(entry).toContain('- Add feature X');
        expect(entry).toContain('- Fix bug Y');
    });
    it('should track archive metadata', () => {
        const skill = new ArchiveSkill();
        skill.setVersion('v1.2.0');
        skill.setCommitHash('abc123');
        skill.setArchiveDate(new Date('2024-01-15'));
        const meta = skill.getArchiveMetadata();
        expect(meta.version).toBe('v1.2.0');
        expect(meta.commitHash).toBe('abc123');
        expect(meta.date).toEqual(new Date('2024-01-15'));
    });
    it('should require verify_tests before check_tasks', () => {
        const skill = new ArchiveSkill();
        expect(() => skill.startStep(1)).toThrow('Prerequisite not met');
        skill.startStep(0);
        skill.completeStep(0);
        expect(() => skill.startStep(1)).not.toThrow();
    });
    it('should serialize state with metadata', () => {
        const skill = new ArchiveSkill();
        skill.setVersion('v1.0.0');
        skill.setCommitHash('def456');
        skill.startStep(0);
        const state = skill.serialize();
        expect(state.version).toBe('v1.0.0');
        expect(state.commitHash).toBe('def456');
    });
});
//# sourceMappingURL=ArchiveSkill.test.js.map