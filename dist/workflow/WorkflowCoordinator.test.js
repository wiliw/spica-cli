import { describe, it, expect } from 'vitest';
import { WorkflowCoordinator } from './WorkflowCoordinator';
describe('WorkflowCoordinator', () => {
    it('should coordinate mvp workflow', async () => {
        const coordinator = new WorkflowCoordinator();
        const events = [];
        coordinator.on('workflowStarted', (name) => events.push(`start:${name}`));
        coordinator.on('workflowCompleted', (name) => events.push(`complete:${name}`));
        await coordinator.startMVP('Build a CLI tool');
        expect(events[0]).toBe('start:mvp');
    });
    it('should coordinate cycle workflow', async () => {
        const coordinator = new WorkflowCoordinator();
        const result = await coordinator.startCycle('Fix bug in parser');
        expect(result.type).toBe('bug');
        expect(result.workflow).toBeDefined();
    });
    it('should coordinate archive workflow', async () => {
        const coordinator = new WorkflowCoordinator();
        await coordinator.startArchive('v1.0.0');
        expect(coordinator.getCurrentWorkflow()).toBe('archive');
    });
    it('should prevent concurrent workflows', async () => {
        const coordinator = new WorkflowCoordinator();
        coordinator.startMVP('Test project');
        await expect(coordinator.startCycle('Fix bug')).rejects.toThrow('Workflow already running');
    });
    it('should get current state', () => {
        const coordinator = new WorkflowCoordinator();
        const state = coordinator.getState();
        expect(state.currentWorkflow).toBeNull();
        expect(state.status).toBe('idle');
    });
    it('should transition between phases', async () => {
        const coordinator = new WorkflowCoordinator();
        await coordinator.startMVP('Test');
        await coordinator.completeCurrentWorkflow();
        expect(coordinator.getState().status).toBe('completed');
        expect(coordinator.canStartNewWorkflow()).toBe(true);
    });
    it('should share context between skills', async () => {
        const coordinator = new WorkflowCoordinator();
        coordinator.setContext('projectName', 'test-project');
        coordinator.setContext('techStack', ['TypeScript', 'Node']);
        await coordinator.startMVP('Test');
        const context = coordinator.getContext();
        expect(context.projectName).toBe('test-project');
        expect(context.techStack).toEqual(['TypeScript', 'Node']);
    });
    it('should track workflow history', async () => {
        const coordinator = new WorkflowCoordinator();
        await coordinator.startMVP('Project 1');
        await coordinator.completeCurrentWorkflow();
        await coordinator.startCycle('Fix bug');
        await coordinator.completeCurrentWorkflow();
        const history = coordinator.getHistory();
        expect(history).toHaveLength(2);
        expect(history[0].type).toBe('mvp');
        expect(history[1].type).toBe('cycle');
    });
    it('should pause and resume workflow', async () => {
        const coordinator = new WorkflowCoordinator();
        await coordinator.startMVP('Test project');
        coordinator.pause();
        expect(coordinator.getState().status).toBe('paused');
        coordinator.resume();
        expect(coordinator.getState().status).toBe('running');
    });
    it('should emit progress updates', async () => {
        const coordinator = new WorkflowCoordinator();
        const progress = [];
        coordinator.on('progress', (percent) => progress.push(percent));
        await coordinator.startMVP('Test');
        coordinator.setProgress(25);
        coordinator.setProgress(50);
        expect(progress).toEqual([25, 50]);
    });
    it('should validate iron laws before completion', async () => {
        const coordinator = new WorkflowCoordinator();
        await coordinator.startMVP('Test');
        coordinator.violateIronLaw('Tests must pass');
        await expect(coordinator.completeCurrentWorkflow()).rejects.toThrow('Iron law violated');
    });
    it('should generate workflow report', async () => {
        const coordinator = new WorkflowCoordinator();
        await coordinator.startMVP('Test project');
        await coordinator.completeCurrentWorkflow();
        const report = coordinator.generateReport();
        expect(report.workflow).toBe('mvp');
        expect(report.status).toBe('completed');
        expect(report.totalSteps).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=WorkflowCoordinator.test.js.map