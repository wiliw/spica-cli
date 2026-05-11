import { useState } from 'react';
import { SpicaAgent } from '../../agent';
export function useAgent() {
    const [state, setState] = useState({
        currentWorkflow: null,
        todos: [],
        messages: [],
        output: [],
        isRunning: false,
        error: null,
    });
    const [agent] = useState(() => new SpicaAgent());
    const startWorkflow = async (workflow, input) => {
        setState(prev => ({
            ...prev,
            currentWorkflow: workflow,
            isRunning: true,
            error: null,
            output: [],
        }));
        try {
            if (workflow === 'mvp') {
                await agent.executeMVP(input);
            }
            else if (workflow === 'cycle') {
                await agent.executeCycle(input);
            }
            else if (workflow === 'archive') {
                await agent.executeArchive(input);
            }
            setState(prev => ({ ...prev, isRunning: false }));
        }
        catch (error) {
            setState(prev => ({
                ...prev,
                isRunning: false,
                error: error.message || 'Unknown error',
            }));
        }
    };
    const addOutput = (line) => {
        setState(prev => ({
            ...prev,
            output: [...prev.output, line],
        }));
    };
    const addMessage = (message) => {
        setState(prev => ({
            ...prev,
            messages: [...prev.messages, { ...message, timestamp: new Date() }],
        }));
    };
    const reset = () => {
        setState({
            currentWorkflow: null,
            todos: [],
            messages: [],
            output: [],
            isRunning: false,
            error: null,
        });
    };
    return {
        state,
        startWorkflow,
        addOutput,
        addMessage,
        reset,
    };
}
//# sourceMappingURL=useAgent.js.map