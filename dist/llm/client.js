import OpenAI from 'openai';
export class LLMClient {
    client;
    model;
    messages = [];
    constructor(apiKey, model = 'gpt-4', baseUrl) {
        this.client = new OpenAI({
            apiKey,
            baseURL: baseUrl || 'https://api.openai.com/v1',
        });
        this.model = model;
    }
    setSystemPrompt(prompt) {
        this.messages = [{ role: 'system', content: prompt }];
    }
    async generate(prompt, tools) {
        this.messages.push({ role: 'user', content: prompt });
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: this.messages,
            tools: tools?.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                },
            })),
        });
        const choice = response.choices[0];
        const message = choice.message;
        if (message.content) {
            this.messages.push({ role: 'assistant', content: message.content });
            return { content: message.content, finished: true };
        }
        if (message.tool_calls) {
            const toolCalls = message.tool_calls.map(tc => ({
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments),
            }));
            this.messages.push({ role: 'assistant', tool_calls: message.tool_calls });
            return { toolCalls, finished: false };
        }
        return { finished: true };
    }
    async continueWithToolResult(name, result, tools) {
        const lastMessage = this.messages[this.messages.length - 1];
        const toolCallId = lastMessage.tool_calls?.[0]?.id || '';
        this.messages.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content: result,
        });
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: this.messages,
            tools: tools?.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                },
            })),
        });
        const choice = response.choices[0];
        const message = choice.message;
        if (message.content) {
            this.messages.push({ role: 'assistant', content: message.content });
            return { content: message.content, finished: true };
        }
        if (message.tool_calls) {
            const toolCalls = message.tool_calls.map(tc => ({
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments),
            }));
            this.messages.push({ role: 'assistant', tool_calls: message.tool_calls });
            return { toolCalls, finished: false };
        }
        return { finished: true };
    }
    clearHistory() {
        this.messages = [];
    }
}
//# sourceMappingURL=client.js.map