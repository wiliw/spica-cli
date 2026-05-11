import { LLMClientConfig } from '../llm/LLMClient';
import { ContextManager } from './ContextManager';
import { ConversationManager } from './ConversationManager';
export interface AgentConfig {
    llm: LLMClientConfig;
    rootPath: string;
    maxIterations?: number;
}
export interface Todo {
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
}
export interface SkillResult {
    success: boolean;
    content?: string;
    errors?: string[];
    todos?: Todo[];
}
export declare class Agent {
    private llm;
    private context;
    private conversation;
    private prompts;
    private parser;
    private todos;
    private maxIterations;
    private currentSkill;
    constructor(config: AgentConfig);
    ExecuteSkill(skill: string, input: string): Promise<SkillResult>;
    private InitializeTodos;
    private RunLoop;
    private ExecuteToolCall;
    private UpdateTodoProgress;
    private GetOperationFromTool;
    private CompleteAllTodos;
    private PrintTodos;
    getContext(): ContextManager;
    getConversation(): ConversationManager;
    getTodos(): Todo[];
    clear(): void;
}
//# sourceMappingURL=Agent.d.ts.map