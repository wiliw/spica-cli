import { SkillBase } from './SkillBase';
const ARCHIVE_STEPS = [
    { name: 'verify_tests', description: 'Verify tests pass' },
    { name: 'check_tasks', description: 'Check tasks completion', requires: ['verify_tests'] },
    { name: 'update_changelog', description: 'Update CHANGELOG', requires: ['check_tasks'] },
    { name: 'git_commit', description: 'Git commit + tag', requires: ['update_changelog'] },
    { name: 'archive', description: 'Archive change', requires: ['git_commit'] },
];
const ARCHIVE_IRON_LAWS = [
    'All tests must pass',
    'CHANGELOG must be updated',
    'Git must be clean',
];
const STEP_TODOS = {
    verify_tests: ['Run all tests', 'Verify all pass'],
    check_tasks: ['Check tasks.md completion', 'List incomplete items'],
    update_changelog: ['Update CHANGELOG.md', 'Add version entry', 'List changes'],
    git_commit: ['Stage all changes', 'Create commit', 'Create git tag'],
    archive: ['Move to archive directory', 'Create archive record'],
};
export class ArchiveSkill extends SkillBase {
    version = '';
    commitHash = '';
    archiveDate = null;
    testResults = { passed: 0, failed: 0 };
    taskCompletion = { total: 0, completed: 0 };
    constructor() {
        super('archive', 'Archive workflow: verify tests → check tasks → changelog → commit → archive', ARCHIVE_STEPS);
        for (const law of ARCHIVE_IRON_LAWS) {
            this.addIronLaw(law);
        }
    }
    getStepTodos(stepName) {
        return STEP_TODOS[stepName] || [];
    }
    setTestResults(results) {
        this.testResults = results;
    }
    canProceedToCommit() {
        return this.testResults.failed === 0;
    }
    setTaskCompletion(completion) {
        this.taskCompletion = completion;
    }
    allTasksCompleted() {
        return this.taskCompletion.total === this.taskCompletion.completed;
    }
    generateChangelogEntry(version, changes) {
        const date = new Date().toISOString().split('T')[0];
        const changesList = changes.map(c => `- ${c}`).join('\n');
        return `## ${version}\n\nReleased: ${date}\n\n${changesList}`;
    }
    setVersion(version) {
        this.version = version;
    }
    setCommitHash(hash) {
        this.commitHash = hash;
    }
    setArchiveDate(date) {
        this.archiveDate = date;
    }
    getArchiveMetadata() {
        return {
            version: this.version,
            commitHash: this.commitHash,
            date: this.archiveDate || new Date(),
        };
    }
    serialize() {
        return {
            ...super.serialize(),
            version: this.version,
            commitHash: this.commitHash,
        };
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
        if (step.name === 'git_commit' && !this.canProceedToCommit()) {
            this.markIronLawViolated('All tests must pass');
            throw new Error('Cannot proceed to commit: tests are failing');
        }
        await this.completeStep(index);
    }
}
//# sourceMappingURL=ArchiveSkill.js.map