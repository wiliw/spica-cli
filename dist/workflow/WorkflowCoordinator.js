import { EventEmitter } from 'node:events';
import { MvpSkill } from './MvpSkill';
import { CycleSkill } from './CycleSkill';
import { ArchiveSkill } from './ArchiveSkill';
import { SkillEngine } from './SkillEngine';
export class WorkflowCoordinator extends EventEmitter {
    engine = new SkillEngine();
    mvpSkill = new MvpSkill();
    cycleSkill = new CycleSkill();
    archiveSkill = new ArchiveSkill();
    currentWorkflow = null;
    status = 'idle';
    context = {};
    history = [];
    progress = 0;
    ironLawsViolated = new Set();
    constructor() {
        super();
        this.engine.registerSkill('mvp', {
            name: 'mvp',
            execute: async () => { },
        });
        this.engine.registerSkill('cycle', {
            name: 'cycle',
            execute: async () => { },
        });
        this.engine.registerSkill('archive', {
            name: 'archive',
            execute: async () => { },
        });
    }
    async startMVP(description) {
        this.checkCanStart();
        this.currentWorkflow = 'mvp';
        this.status = 'running';
        this.emit('workflowStarted', 'mvp');
        await this.engine.execute('mvp', { description });
    }
    async startCycle(request) {
        this.checkCanStart();
        this.currentWorkflow = 'cycle';
        this.status = 'running';
        this.emit('workflowStarted', 'cycle');
        const type = this.cycleSkill.judgeRequestType(request);
        const workflow = this.cycleSkill.createWorkflow(type);
        return { type, workflow };
    }
    async startArchive(version) {
        this.checkCanStart();
        this.currentWorkflow = 'archive';
        this.status = 'running';
        this.archiveSkill.setVersion(version);
        this.emit('workflowStarted', 'archive');
        await this.engine.execute('archive', { version });
    }
    checkCanStart() {
        if (this.status === 'running') {
            throw new Error('Workflow already running');
        }
    }
    getState() {
        return {
            currentWorkflow: this.currentWorkflow,
            status: this.status,
        };
    }
    async completeCurrentWorkflow() {
        if (this.ironLawsViolated.size > 0) {
            throw new Error('Iron law violated');
        }
        this.status = 'completed';
        this.history.push({
            type: this.currentWorkflow,
            timestamp: Date.now(),
            status: 'completed',
        });
        this.emit('workflowCompleted', this.currentWorkflow);
    }
    canStartNewWorkflow() {
        return this.status !== 'running';
    }
    setContext(key, value) {
        this.context[key] = value;
    }
    getContext() {
        return { ...this.context };
    }
    getHistory() {
        return [...this.history];
    }
    pause() {
        this.status = 'paused';
    }
    resume() {
        this.status = 'running';
    }
    setProgress(percent) {
        this.progress = percent;
        this.emit('progress', percent);
    }
    violateIronLaw(law) {
        this.ironLawsViolated.add(law);
    }
    getCurrentWorkflow() {
        return this.currentWorkflow;
    }
    generateReport() {
        const historyEntry = this.history[this.history.length - 1];
        let stepsCompleted = 1;
        let totalSteps = 6;
        if (historyEntry?.type === 'mvp') {
            stepsCompleted = this.mvpSkill.getSteps().length;
            totalSteps = this.mvpSkill.getSteps().length;
        }
        else if (historyEntry?.type === 'cycle') {
            stepsCompleted = this.cycleSkill.getSteps().length;
            totalSteps = this.cycleSkill.getSteps().length;
        }
        else if (historyEntry?.type === 'archive') {
            stepsCompleted = this.archiveSkill.getSteps().length;
            totalSteps = this.archiveSkill.getSteps().length;
        }
        return {
            workflow: historyEntry?.type || this.currentWorkflow,
            status: this.status,
            stepsCompleted,
            totalSteps,
        };
    }
    on(event, listener) {
        return super.on(event, listener);
    }
}
//# sourceMappingURL=WorkflowCoordinator.js.map