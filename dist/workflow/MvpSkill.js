import { SkillBase } from './SkillBase';
const MVP_STEPS = [
    { name: 'requirements', description: 'Gather requirements' },
    { name: 'tech_stack', description: 'Recommend tech stack', requires: ['requirements'] },
    { name: 'design', description: 'Design architecture', requires: ['tech_stack'] },
    { name: 'implement', description: 'Implement core', requires: ['design'] },
    { name: 'documents', description: 'Create documents', requires: ['implement'] },
    { name: 'demo', description: 'Demo result', requires: ['documents'] },
];
const MVP_IRON_LAWS = [
    'Core function must work',
    'Tests must pass',
    'No broken builds',
];
const STEP_TODOS = {
    requirements: [
        'Ask 3 core questions',
        'Capture deadline',
        'Note tech constraints',
    ],
    tech_stack: [
        'Recommend stack',
        'Explain rationale',
    ],
    design: [
        'Create extensible architecture',
        'Document decisions',
    ],
    implement: [
        'Write core code',
        'Run tests',
        'Fix failures',
    ],
    documents: [
        'Create spec.md',
        'Create tasks.md',
        'Create project-log.md',
    ],
    demo: [
        'Show working result',
        'Verify core function',
    ],
};
export class MvpSkill extends SkillBase {
    constructor() {
        super('mvp', 'MVP workflow: gather requirements → tech stack → design → implement → documents → demo', MVP_STEPS);
        for (const law of MVP_IRON_LAWS) {
            this.addIronLaw(law);
        }
    }
    getStepTodos(stepName) {
        return STEP_TODOS[stepName] || [];
    }
    getStepRequirements(stepName) {
        const step = this.steps.find(s => s.name === stepName);
        return step?.requires || [];
    }
    async executeStep(index) {
        this.startStep(index);
        const step = this.steps[index];
        const todos = this.getStepTodos(step.name);
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
//# sourceMappingURL=MvpSkill.js.map