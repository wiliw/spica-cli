import { Todo } from '../../agent';
export type WorkflowState = 'mvp' | 'cycle' | 'archive';
export interface AgentState {
    currentWorkflow: WorkflowState | null;
    todos: Todo[];
    messages: Message[];
    output: string[];
    isRunning: boolean;
    error: string | null;
}
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}
export declare function useAgent(): {
    state: AgentState;
    startWorkflow: (workflow: WorkflowState, input: string) => Promise<void>;
    addOutput: (line: string) => void;
    addMessage: (message: Omit<Message, "timestamp">) => void;
    reset: () => void;
};
//# sourceMappingURL=useAgent.d.ts.map