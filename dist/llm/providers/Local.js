import { BaseProvider } from './BaseProvider';
export class LocalProvider extends BaseProvider {
    baseUrl;
    constructor(config) {
        super(config);
        this.baseUrl = config.baseUrl || 'http://localhost:8080/v1';
    }
    async generate(prompt, tools) {
        if (prompt) {
            this.messages.push({ role: 'user', content: prompt });
        }
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: this.messages.map(m => {
                    if (m.role === 'tool') {
                        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
                    }
                    if (m.role === 'assistant' && m.toolCalls) {
                        return {
                            role: 'assistant',
                            content: m.content,
                            tool_calls: m.toolCalls.map(tc => ({
                                id: tc.id,
                                type: 'function',
                                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                            })),
                        };
                    }
                    return { role: m.role, content: m.content };
                }),
                tools: tools?.map(t => ({
                    type: 'function',
                    function: { name: t.name, description: t.description, parameters: t.parameters },
                })),
            }),
        });
        const data = await response.json();
        const message = data.choices?.[0]?.message;
        if (message?.content) {
            this.messages.push({ role: 'assistant', content: message.content });
            return { content: message.content, finished: true };
        }
        if (message?.tool_calls) {
            const toolCalls = message.tool_calls.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments),
            }));
            this.messages.push({ role: 'assistant', content: '', toolCalls: toolCalls });
            return { toolCalls, finished: false };
        }
        return { finished: true };
    }
    async continueWithToolResult(toolCallId, result, tools) {
        this.messages.push({ role: 'tool', content: result, toolCallId: toolCallId });
        return this.generate('', tools);
    }
}
//# sourceMappingURL=Local.js.map