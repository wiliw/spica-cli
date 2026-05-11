import { EventEmitter } from 'node:events';
import { TodoManager } from './TodoManager';
import { ProgressTracker } from './ProgressTracker';
export class SkillBase extends EventEmitter {
    name;
    description;
    steps;
    ironLaws = [];
    violatedIronLaws = new Set();
    currentStepIndex = -1;
    status = 'idle';
    completedSteps = new Set();
    todoManager = new TodoManager();
    progressTracker = new ProgressTracker();
    constructor(name, description, steps) {
        super();
        this.name = name;
        this.description = description;
        this.steps = steps.map(s => ({ ...s, status: 'pending' }));
        this.progressTracker.setTotalSteps(steps.length);
    }
    getName() {
        return this.name;
    }
    getDescription() {
        return this.description;
    }
    getSteps() {
        return this.steps;
    }
    addIronLaw(law) {
        this.ironLaws.push(law);
    }
    getIronLaws() {
        return [...this.ironLaws];
    }
    markIronLawViolated(law) {
        this.violatedIronLaws.add(law);
    }
    checkIronLaws() {
        const violatedLaws = Array.from(this.violatedIronLaws);
        for (const law of violatedLaws) {
            if (this.ironLaws.includes(law)) {
                throw new Error(`Iron law violated: ${law}`);
            }
        }
    }
    checkPrerequisites(stepIndex) {
        const step = this.steps[stepIndex];
        if (step.requires) {
            for (const requiredStep of step.requires) {
                const requiredIndex = this.steps.findIndex(s => s.name === requiredStep);
                if (requiredIndex >= 0 && !this.completedSteps.has(requiredIndex)) {
                    throw new Error(`Prerequisite not met: ${requiredStep}`);
                }
            }
        }
    }
    startStep(index) {
        this.checkIronLaws();
        this.checkPrerequisites(index);
        this.currentStepIndex = index;
        this.status = 'running';
        this.steps[index].status = 'in_progress';
        this.progressTracker.startStep(this.steps[index].name, this.steps[index].description);
        this.emit('stepStarted', this.steps[index]);
    }
    completeStep(index) {
        this.checkIronLaws();
        this.steps[index].status = 'completed';
        this.completedSteps.add(index);
        this.progressTracker.completeStep(this.steps[index].name);
        this.emit('stepCompleted', this.steps[index]);
        if (this.completedSteps.size === this.steps.length) {
            this.status = 'completed';
        }
    }
    getStatus() {
        return this.status;
    }
    serialize() {
        return {
            name: this.name,
            currentStepIndex: this.currentStepIndex,
            status: this.status,
            completedSteps: Array.from(this.completedSteps),
        };
    }
    restore(state) {
        this.currentStepIndex = state.currentStepIndex;
        this.status = state.status;
        this.completedSteps = new Set(state.completedSteps);
        for (const index of this.completedSteps) {
            this.steps[index].status = 'completed';
        }
        if (state.status === 'running' && this.currentStepIndex >= 0 && !this.completedSteps.has(this.currentStepIndex)) {
            this.steps[this.currentStepIndex].status = 'in_progress';
        }
    }
    on(event, listener) {
        return super.on(event, listener);
    }
}
//# sourceMappingURL=SkillBase.js.map