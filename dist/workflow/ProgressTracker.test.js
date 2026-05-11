import { describe, it, expect } from 'vitest';
import { ProgressTracker } from './ProgressTracker';
describe('ProgressTracker', () => {
    it('should track step progress', () => {
        const tracker = new ProgressTracker();
        tracker.startStep('requirements', 'Gathering requirements');
        expect(tracker.getCurrentStep()?.name).toBe('requirements');
        expect(tracker.getCurrentStep()?.status).toBe('in_progress');
        tracker.completeStep('requirements');
        expect(tracker.getCurrentStep()?.status).toBe('completed');
    });
    it('should calculate overall progress', () => {
        const tracker = new ProgressTracker();
        tracker.setTotalSteps(4);
        tracker.startStep('step1', 'Step 1');
        tracker.completeStep('step1');
        expect(tracker.getOverallProgress()).toBe(25);
        tracker.startStep('step2', 'Step 2');
        tracker.completeStep('step2');
        expect(tracker.getOverallProgress()).toBe(50);
    });
    it('should track step duration', async () => {
        const tracker = new ProgressTracker();
        tracker.startStep('test', 'Test step');
        await new Promise(r => setTimeout(r, 100));
        tracker.completeStep('test');
        const duration = tracker.getStepDuration('test');
        expect(duration).toBeGreaterThanOrEqual(100);
    });
    it('should generate progress report', () => {
        const tracker = new ProgressTracker();
        tracker.setTotalSteps(3);
        tracker.startStep('step1', 'Step 1');
        tracker.completeStep('step1');
        tracker.startStep('step2', 'Step 2');
        const report = tracker.generateReport();
        expect(report.totalSteps).toBe(3);
        expect(report.completedSteps).toBe(1);
        expect(report.inProgressSteps).toBe(1);
        expect(report.pendingSteps).toBe(1);
        expect(report.progressPercent).toBeCloseTo(33.33);
    });
    it('should emit events on state changes', () => {
        const tracker = new ProgressTracker();
        const events = [];
        tracker.on('stepStarted', (step) => events.push(`started:${step.name}`));
        tracker.on('stepCompleted', (step) => events.push(`completed:${step.name}`));
        tracker.startStep('test', 'Test');
        tracker.completeStep('test');
        expect(events).toEqual(['started:test', 'completed:test']);
    });
    it('should track errors', () => {
        const tracker = new ProgressTracker();
        tracker.startStep('test', 'Test');
        tracker.failStep('test', 'Something went wrong');
        const step = tracker.getStep('test');
        expect(step?.status).toBe('failed');
        expect(step?.error).toBe('Something went wrong');
    });
});
//# sourceMappingURL=ProgressTracker.test.js.map