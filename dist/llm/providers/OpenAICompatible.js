import OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
export class OpenAICompatibleProvider extends BaseProvider {
    client;
    providerName;
    constructor(config) {
        super(config);
        this.providerName = config.name || 'OpenAI-compatible';
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        });
    }
    async generate(prompt, tools) {
        this.messages.push({ role: 'user', content: prompt });
        try {
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: this.convertMessages(),
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
                    id: tc.id,
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments),
                }));
                this.messages.push({
                    role: 'assistant',
                    content: '',
                    toolCalls: toolCalls,
                });
                return { toolCalls, finished: false };
            }
            return { finished: true };
        }
        catch (error) {
            throw new Error(`${this.providerName} API error: ${error.message}`);
        }
    }
    async continueWithToolResult(toolCallId, result, tools) {
        this.messages.push({
            role: 'tool',
            content: result,
            toolCallId: toolCallId,
        });
        try {
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: this.convertMessages(),
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
                    id: tc.id,
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments),
                }));
                this.messages.push({ role: 'assistant', content: '', toolCalls: toolCalls });
                return { toolCalls, finished: false };
            }
            return { finished: true };
        }
        catch (error) {
            throw new Error(`${this.providerName} API error: ${error.message}`);
        }
    }
    convertMessages() {
        return this.messages.map(m => {
            if (m.role === 'tool') {
                return {
                    role: 'tool',
                    tool_call_id: m.toolCallId,
                    content: m.content,
                };
            }
            if (m.role === 'assistant' && m.toolCalls) {
                return {
                    role: 'assistant',
                    content: m.content || null,
                    tool_calls: m.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.arguments),
                        },
                    })),
                };
            }
            return { role: m.role, content: m.content };
        });
    }
}
//# sourceMappingURL=OpenAICompatible.js.map