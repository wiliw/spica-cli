import { SkillBase } from './SkillBase';
const CYCLE_STEPS = [
    { name: 'judge', description: 'Judge request type' },
    { name: 'execute', description: 'Execute type-specific flow' },
    { name: 'test', description: 'Run tests' },
    { name: 'update_docs', description: 'Update docs' },
    { name: 'demo', description: 'Demo result' },
];
const CYCLE_IRON_LAWS = [
    'All tests must pass',
    'No regressions',
];
const WORKFLOW_MAP = {
    bug: ['diagnose', 'fix', 'test', 'verify_fix'],
    simple: ['implement', 'test'],
    complex: ['write_tests', 'implement', 'verify'],
};
const STEP_TODOS_BY_TYPE = {
    execute: {
        bug: ['Diagnose root cause', 'Apply fix', 'Verify fix'],
        simple: ['Implement change', 'Run tests'],
        complex: ['Write tests first', 'Implement feature', 'Verify all tests pass'],
    },
};
export class CycleSkill extends SkillBase {
    fixAttempts = [];
    requestType = 'simple';
    constructor() {
        super('cycle', 'Cycle workflow: judge type → execute → test → update docs → demo', CYCLE_STEPS);
        for (const law of CYCLE_IRON_LAWS) {
            this.addIronLaw(law);
        }
    }
    judgeRequestType(request) {
        const lower = request.toLowerCase();
        if (lower.includes('fix') || lower.includes('bug') || lower.includes('error') || lower.includes('crash')) {
            return 'bug';
        }
        if (lower.includes('add') || lower.includes('create') || lower.includes('implement') || lower.includes('system')) {
            return 'complex';
        }
        return 'simple';
    }
    createWorkflow(type) {
        return WORKFLOW_MAP[type];
    }
    async autoFixLoop(testFn, options) {
        let attempts = 0;
        while (attempts < options.maxAttempts) {
            attempts++;
            const result = await testFn();
            if (result.success) {
                return result;
            }
        }
        return { success: false, error: 'Max attempts reached' };
    }
    recordFixAttempt(attemptNumber, description) {
        this.fixAttempts.push({
            attemptNumber,
            description,
            timestamp: Date.now(),
        });
    }
    getFixAttempts() {
        return [...this.fixAttempts];
    }
    getStepTodos(stepName, type) {
        if (type && STEP_TODOS_BY_TYPE[stepName]) {
            return STEP_TODOS_BY_TYPE[stepName][type] || [];
        }
        return [];
    }
    async executeStep(index) {
        this.startStep(index);
        const step = this.steps[index];
        if (step.name === 'judge' && this.requestType) {
            this.emit('requestJudged', this.requestType);
        }
        const todos = this.getStepTodos(step.name, this.requestType);
        if (todos.length > 0) {
            this.todoManager.clear();
            todos.forEach(todo => this.todoManager.addTodo(todo));
            for (const todo of todos) {
                this.todoManager.updateTodoStatus(todo, 'in_progress');
                this.emit('todoStarted', todo);
                await new Promise(resolve => setTimeout(resolve, 100));
                this.todoManager.updateTodoStatus(todo, 'completed');
                this.emit('todoCompleted', todo);
            }
        }
        await this.completeStep(index);
    }
}
//# sourceMappingURL=CycleSkill.js.map