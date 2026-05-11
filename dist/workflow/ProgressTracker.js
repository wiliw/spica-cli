import { EventEmitter } from 'node:events';
export class ProgressTracker extends EventEmitter {
    steps = new Map();
    totalSteps = 0;
    currentStep = null;
    setTotalSteps(count) {
        this.totalSteps = count;
    }
    startStep(name, description) {
        const step = {
            name,
            description,
            status: 'in_progress',
            startTime: Date.now(),
        };
        this.steps.set(name, step);
        this.currentStep = step;
        this.emit('stepStarted', step);
    }
    completeStep(name) {
        const step = this.steps.get(name);
        if (step) {
            step.status = 'completed';
            step.endTime = Date.now();
            this.emit('stepCompleted', step);
        }
    }
    failStep(name, error) {
        const step = this.steps.get(name);
        if (step) {
            step.status = 'failed';
            step.error = error;
            step.endTime = Date.now();
            this.emit('stepFailed', { step, error });
        }
    }
    getStep(name) {
        return this.steps.get(name);
    }
    getCurrentStep() {
        return this.currentStep;
    }
    getOverallProgress() {
        if (this.totalSteps === 0)
            return 0;
        const completed = Array.from(this.steps.values())
            .filter(s => s.status === 'completed').length;
        return (completed / this.totalSteps) * 100;
    }
    getStepDuration(name) {
        const step = this.steps.get(name);
        if (step?.startTime && step?.endTime) {
            return step.endTime - step.startTime;
        }
        return 0;
    }
    generateReport() {
        const stepsArray = Array.from(this.steps.values());
        const completed = stepsArray.filter(s => s.status === 'completed').length;
        const inProgress = stepsArray.filter(s => s.status === 'in_progress').length;
        const pending = this.totalSteps - completed - inProgress;
        return {
            totalSteps: this.totalSteps,
            completedSteps: completed,
            inProgressSteps: inProgress,
            pendingSteps: pending,
            progressPercent: this.getOverallProgress(),
        };
    }
    on(event, listener) {
        return super.on(event, listener);
    }
}
//# sourceMappingURL=ProgressTracker.js.map