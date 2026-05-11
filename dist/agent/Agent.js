import { LLMClient } from '../llm/LLMClient';
import { ContextManager } from './ContextManager';
import { ConversationManager } from './ConversationManager';
import { PromptManager } from './PromptManager';
import { ResponseParser } from './ResponseParser';
import { executeTool, TOOLS_DEFINITIONS } from '../tools/index';
export class Agent {
    llm;
    context;
    conversation;
    prompts;
    parser;
    todos = [];
    maxIterations;
    currentSkill = null;
    constructor(config) {
        this.llm = new LLMClient(config.llm);
        this.context = new ContextManager(config.rootPath);
        this.conversation = new ConversationManager();
        this.prompts = new PromptManager();
        this.parser = new ResponseParser();
        this.maxIterations = config.maxIterations || 10;
    }
    async ExecuteSkill(skill, input) {
        this.currentSkill = skill;
        this.conversation.setCurrentSkill(skill);
        const skillPrompt = this.prompts.getSkillPrompt(skill);
        if (!skillPrompt) {
            return { success: false, errors: [`Unknown skill: ${skill}`] };
        }
        this.llm.setSystemPrompt(skillPrompt.system);
        this.llm.setToolDefinitions(TOOLS_DEFINITIONS);
        this.todos = this.InitializeTodos(skill);
        this.PrintTodos();
        this.context.addConversationEntry(`Starting ${skill}: ${input}`);
        this.conversation.addUserMessage(input);
        try {
            const result = await this.RunLoop(input);
            this.context.addConversationEntry(`Completed ${skill}`);
            this.conversation.clearCurrentSkill();
            this.currentSkill = null;
            return {
                success: true,
                content: result,
                todos: this.todos,
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error.message],
                todos: this.todos,
            };
        }
    }
    InitializeTodos(skill) {
        switch (skill) {
            case 'mvp':
                return [
                    { content: 'Gather requirements', status: 'pending' },
                    { content: 'Recommend tech stack', status: 'pending' },
                    { content: 'Design architecture', status: 'pending' },
                    { content: 'Implement core', status: 'pending' },
                    { content: 'Create documents', status: 'pending' },
                    { content: 'Demo result', status: 'pending' },
                ];
            case 'cycle':
                return [
                    { content: 'Judge type', status: 'pending' },
                    { content: 'Implement', status: 'pending' },
                    { content: 'Test', status: 'pending' },
                    { content: 'Update docs', status: 'pending' },
                    { content: 'Demo', status: 'pending' },
                ];
            case 'archive':
                return [
                    { content: 'Verify tests', status: 'pending' },
                    { content: 'Check tasks', status: 'pending' },
                    { content: 'Update CHANGELOG', status: 'pending' },
                    { content: 'Git commit', status: 'pending' },
                    { content: 'Archive', status: 'pending' },
                ];
            default:
                return [{ content: 'Execute', status: 'pending' }];
        }
    }
    async RunLoop(initialPrompt) {
        let response = await this.llm.generate(initialPrompt);
        let iterations = 0;
        while (!response.finished && iterations < this.maxIterations) {
            if (response.toolCalls) {
                for (const tc of response.toolCalls) {
                    this.UpdateTodoProgress(tc.name);
                    const result = await this.ExecuteToolCall(tc);
                    this.context.recordFileChange({
                        path: tc.arguments.path || '',
                        operation: this.GetOperationFromTool(tc.name),
                        content: tc.arguments.content,
                        timestamp: Date.now(),
                    });
                    if (result.success) {
                        console.log(`✓ ${tc.name}: ${result.output}`);
                    }
                    else {
                        console.error(`✗ ${tc.name}: ${result.error}`);
                    }
                    response = await this.llm.getProvider().continueWithToolResult(tc.id, result.output || result.error || '', TOOLS_DEFINITIONS);
                }
            }
            iterations++;
        }
        if (response.content) {
            this.conversation.addAssistantMessage(response.content);
            this.CompleteAllTodos();
            this.PrintTodos();
        }
        return response.content || '';
    }
    async ExecuteToolCall(tc) {
        return await executeTool(tc.name, tc.arguments);
    }
    UpdateTodoProgress(toolName) {
        const todoMap = {
            'file_write': 3,
            'file_read': 0,
            'bash': 2,
            'git_commit': 4,
        };
        const index = todoMap[toolName];
        if (index !== undefined && this.todos[index]) {
            if (this.todos[index].status === 'pending') {
                this.todos[index].status = 'in_progress';
            }
        }
    }
    GetOperationFromTool(toolName) {
        switch (toolName) {
            case 'file_write':
                return 'create';
            case 'file_edit':
                return 'modify';
            default:
                return 'modify';
        }
    }
    CompleteAllTodos() {
        this.todos.forEach(t => {
            if (t.status !== 'failed') {
                t.status = 'completed';
            }
        });
    }
    PrintTodos() {
        console.log('\nTodos:');
        this.todos.forEach((t, i) => {
            const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : t.status === 'failed' ? '✗' : '○';
            console.log(`  ${i + 1}. ${icon} ${t.content}`);
        });
        console.log('');
    }
    getContext() {
        return this.context;
    }
    getConversation() {
        return this.conversation;
    }
    getTodos() {
        return this.todos;
    }
    clear() {
        this.llm.clearHistory();
        this.context.clearHistory();
        this.context.clearChanges();
        this.conversation.clear();
        this.todos = [];
    }
}
//# sourceMappingURL=Agent.js.map