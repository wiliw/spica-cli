export class FunctionCaller {
    toolExecutors = new Map();
    RegisterTool(name, executor) {
        this.toolExecutors.set(name, executor);
    }
    RegisterMultiple(tools) {
        for (const [name, executor] of Object.entries(tools)) {
            this.toolExecutors.set(name, executor);
        }
    }
    async Execute(toolCall) {
        const executor = this.toolExecutors.get(toolCall.name);
        if (!executor) {
            return {
                success: false,
                error: `Unknown tool: ${toolCall.name}`,
            };
        }
        try {
            return await executor(toolCall.name, toolCall.arguments);
        }
        catch (error) {
            return {
                success: false,
                error: error.message || String(error),
            };
        }
    }
    async ExecuteMultiple(toolCalls) {
        return Promise.all(toolCalls.map(tc => this.Execute(tc)));
    }
    hasTool(name) {
        return this.toolExecutors.has(name);
    }
    getRegisteredTools() {
        return Array.from(this.toolExecutors.keys());
    }
}
//# sourceMappingURL=FunctionCaller.js.map