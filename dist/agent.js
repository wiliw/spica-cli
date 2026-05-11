import { LLMClient } from './llm/LLMClient';
import { executeTool, TOOLS_DEFINITIONS } from './tools/index';
import { logger } from './utils/logger';
import { getProviderConfig } from './utils/config';
import chalk from 'chalk';
export class SpicaAgent {
    llm = null;
    providerName;
    todos = [];
    constructor(providerName) {
        this.providerName = providerName;
    }
    async init() {
        const config = await getProviderConfig(this.providerName);
        this.llm = new LLMClient({
            provider: this.providerName || 'openai',
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            model: config.model,
            name: config.name,
        });
    }
    async executeMVP(description) {
        try {
            await this.init();
        }
        catch (error) {
            logger.error(`Configuration error: ${error.message}`);
            console.log(chalk.yellow('\nPlease configure API key first:'));
            console.log(chalk.cyan('  Option 1: Environment variable'));
            console.log(chalk.gray('    export OPENAI_API_KEY=your-key'));
            console.log(chalk.cyan('  Option 2: TUI configuration'));
            console.log(chalk.gray('    ./bin/spica'));
            console.log(chalk.gray('    Press S to configure\n'));
            return;
        }
        if (!this.llm) {
            throw new Error('LLM client not initialized');
        }
        this.todos = [
            { content: 'Gather requirements', status: 'pending' },
            { content: 'Recommend tech stack', status: 'pending' },
            { content: 'Design architecture', status: 'pending' },
            { content: 'Implement core', status: 'pending' },
            { content: 'Create documents', status: 'pending' },
            { content: 'Demo result', status: 'pending' },
        ];
        logger.info('Starting MVP workflow...');
        this.printTodos();
        const systemPrompt = `You are an AI coding agent implementing MVP workflow.

You MUST follow these steps in order:
1. REQUIREMENTS: Ask user 3 core questions (core function, deadline, tech constraints). Use console output to interact.
2. TECH STACK: Recommend tech stack with rationale. Write a tech-stack.md file.
3. DESIGN: Design extensible architecture. Write an architecture.md file.
4. IMPLEMENT: Implement core function. Write actual code files. Run tests to verify.
5. DOCUMENTS: Create spec.md, tasks.md, and project-log.md files.
6. DEMO: Show working result and verify core function works.

IMPORTANT: 
- Use tools to take action (file_write, bash, etc)
- After each step, mark it complete and move to next
- Create working, testable code
- If tests fail, fix them before moving on

Tools available: file_write, file_read, file_edit, bash, git_commit

Start with step 1: REQUIREMENTS. Ask the 3 core questions now.`;
        this.llm.setSystemPrompt(systemPrompt);
        const steps = [
            'Ask the 3 core questions about requirements and wait for user input',
            'Recommend tech stack and write tech-stack.md',
            'Design architecture and write architecture.md',
            'Implement core function with working code and tests',
            'Create spec.md, tasks.md, and project-log.md',
            'Demo the result and verify everything works'
        ];
        for (let i = 0; i < steps.length; i++) {
            this.todos[i].status = 'in_progress';
            this.printTodos();
            const stepPrompt = i === 0
                ? `User wants to build: ${description}\n\n${steps[i]}`
                : `Continue to step ${i + 1}: ${steps[i]}`;
            await this.runLoop(stepPrompt);
            this.todos[i].status = 'completed';
            this.printTodos();
        }
        logger.success('MVP workflow completed!');
    }
    async executeCycle(request) {
        try {
            await this.init();
        }
        catch (error) {
            logger.error(`Configuration error: ${error.message}`);
            console.log(chalk.yellow('\nPlease configure API key first:'));
            console.log(chalk.cyan('  Option 1: Environment variable'));
            console.log(chalk.gray('    export OPENAI_API_KEY=your-key'));
            console.log(chalk.cyan('  Option 2: TUI configuration'));
            console.log(chalk.gray('    ./bin/spica'));
            console.log(chalk.gray('    Press S to configure\n'));
            return;
        }
        if (!this.llm) {
            throw new Error('LLM client not initialized');
        }
        this.todos = [
            { content: 'Judge type (bug/simple/complex)', status: 'pending' },
            { content: 'Implement', status: 'pending' },
            { content: 'Test', status: 'pending' },
            { content: 'Update docs', status: 'pending' },
            { content: 'Demo', status: 'pending' },
        ];
        logger.info('Starting Cycle workflow...');
        this.printTodos();
        const systemPrompt = `You are an AI coding agent implementing Cycle workflow.

You MUST follow these steps:
1. JUDGE: Determine if this is a bug fix, simple change, or complex feature
   - Bug fix: has "fix", "bug", "error", "crash" keywords
   - Complex: has "add", "create", "implement", "system" keywords  
   - Simple: minor tweaks or improvements

2. IMPLEMENT based on type:
   - Bug: diagnose → fix → test → verify (repeat if needed, max 5 times)
   - Simple: implement → test
   - Complex: write tests first → implement → verify all tests pass

3. TEST: Run tests to verify the change works
4. UPDATE_DOCS: Update tasks.md if it exists
5. DEMO: Show the result

IMPORTANT:
- Use tools to take action
- If tests fail, diagnose and fix (max 5 attempts)
- Create working, tested code

Tools: file_write, file_read, file_edit, bash, git_commit`;
        this.llm.setSystemPrompt(systemPrompt);
        const response = await this.llm.generate(`Analyze and implement this request: ${request}`, TOOLS_DEFINITIONS);
        if (response.content) {
            console.log(response.content);
        }
        this.todos[0].status = 'completed';
        this.todos[1].status = 'in_progress';
        this.printTodos();
        await this.runLoop(`Now implement the change for: ${request}`);
        this.todos[1].status = 'completed';
        this.todos[2].status = 'in_progress';
        this.printTodos();
        await this.runLoop('Run tests to verify the implementation works');
        this.todos[2].status = 'completed';
        this.todos[3].status = 'in_progress';
        this.printTodos();
        await this.runLoop('Update documentation (tasks.md if exists)');
        this.todos[3].status = 'completed';
        this.todos[4].status = 'in_progress';
        this.printTodos();
        await this.runLoop('Demo the result and verify it works');
        this.todos[4].status = 'completed';
        this.printTodos();
        logger.success('Cycle workflow completed!');
    }
    async executeArchive(version) {
        try {
            await this.init();
        }
        catch (error) {
            logger.error(`Configuration error: ${error.message}`);
            console.log(chalk.yellow('\nPlease configure API key first:'));
            console.log(chalk.cyan('  Option 1: Environment variable'));
            console.log(chalk.gray('    export OPENAI_API_KEY=your-key'));
            console.log(chalk.cyan('  Option 2: TUI configuration'));
            console.log(chalk.gray('    ./bin/spica'));
            console.log(chalk.gray('    Press S to configure\n'));
            return;
        }
        if (!this.llm) {
            throw new Error('LLM client not initialized');
        }
        this.todos = [
            { content: 'Verify tests pass', status: 'pending' },
            { content: 'Check tasks completion', status: 'pending' },
            { content: 'Update CHANGELOG', status: 'pending' },
            { content: 'Git commit', status: 'pending' },
            { content: 'Archive', status: 'pending' },
        ];
        logger.info('Starting Archive workflow...');
        this.printTodos();
        const systemPrompt = `You are an AI coding agent archiving a project.

You MUST follow these steps:
1. VERIFY_TESTS: Run all tests and ensure they pass
2. CHECK_TASKS: Check tasks.md completion status, list any incomplete items
3. UPDATE_CHANGELOG: Update CHANGELOG.md with version ${version}
4. GIT_COMMIT: Stage all changes and commit with message "Release ${version}"
5. ARCHIVE: Create archive record

IMPORTANT:
- Use tools to verify and execute each step
- Do NOT proceed if tests fail
- Ensure git is clean before archiving

Tools: file_write, file_read, file_edit, bash, git_commit`;
        this.llm.setSystemPrompt(systemPrompt);
        this.todos[0].status = 'in_progress';
        this.printTodos();
        await this.runLoop('Run all tests and verify they pass');
        this.todos[0].status = 'completed';
        this.todos[1].status = 'in_progress';
        this.printTodos();
        await this.runLoop('Check tasks.md completion status');
        this.todos[1].status = 'completed';
        this.todos[2].status = 'in_progress';
        this.printTodos();
        await this.runLoop(`Update CHANGELOG.md with version ${version}`);
        this.todos[2].status = 'completed';
        this.todos[3].status = 'in_progress';
        this.printTodos();
        await this.runLoop(`Commit all changes with message "Release ${version}"`);
        this.todos[3].status = 'completed';
        this.todos[4].status = 'in_progress';
        this.printTodos();
        await this.runLoop('Create archive record');
        this.todos[4].status = 'completed';
        this.printTodos();
        logger.success(`Archived version ${version}!`);
    }
    async runLoop(prompt) {
        if (!this.llm) {
            throw new Error('LLM client not initialized');
        }
        let response = await this.llm.generate(prompt, TOOLS_DEFINITIONS);
        let iterations = 0;
        const maxIterations = 50;
        while (!response.finished && iterations < maxIterations) {
            iterations++;
            if (response.toolCalls && response.toolCalls.length > 0) {
                for (const tc of response.toolCalls) {
                    logger.step(`Executing ${tc.name}...`);
                    const result = await executeTool(tc.name, tc.arguments);
                    if (!result.success) {
                        logger.error(result.error || 'Tool failed');
                        console.log(chalk.red(`Error: ${result.error}`));
                    }
                    else {
                        logger.success(result.output || 'Success');
                        if (result.output) {
                            console.log(chalk.gray(result.output.substring(0, 200)));
                        }
                    }
                    response = await this.llm.continueWithToolResult(tc.name, result.output || result.error || '', TOOLS_DEFINITIONS);
                }
            }
            else {
                break;
            }
        }
        if (response.content) {
            console.log(chalk.cyan(response.content));
        }
        if (iterations >= maxIterations) {
            logger.warning('Reached maximum iterations');
        }
    }
    printTodos() {
        console.log('\nTodos:');
        this.todos.forEach((t, i) => {
            const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
            const color = t.status === 'completed' ? chalk.green : t.status === 'in_progress' ? chalk.cyan : chalk.gray;
            console.log(color(`  ${i + 1}. ${icon} ${t.content}`));
        });
        console.log('');
    }
}
//# sourceMappingURL=agent.js.map