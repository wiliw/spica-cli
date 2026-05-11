export class ResponseParser {
    parse(response) {
        return {
            content: response,
            toolCalls: [],
            actions: this.extractActions(response),
            errors: this.extractErrors(response),
        };
    }
    parseToolCalls(toolCalls) {
        return toolCalls.map(tc => this.toolCallToAction(tc));
    }
    toolCallToAction(tc) {
        return {
            type: tc.name,
            params: tc.arguments,
        };
    }
    extractActions(response) {
        const actions = [];
        const fileWritePattern = /(?:write|create|save)\s+(?:file\s+)?`([^`]+)`\s*(?:with\s+content:?\s*)?/gi;
        let match;
        while ((match = fileWritePattern.exec(response)) !== null) {
            actions.push({
                type: 'file_write',
                params: { path: match[1] },
            });
        }
        const bashPattern = /(?:run|execute)\s+`([^`]+)`/gi;
        while ((match = bashPattern.exec(response)) !== null) {
            actions.push({
                type: 'bash',
                params: { command: match[1] },
            });
        }
        return actions;
    }
    extractErrors(response) {
        const errors = [];
        const errorPattern = /(?:error|failed|exception):\s*([^\n]+)/gi;
        let match;
        while ((match = errorPattern.exec(response)) !== null) {
            errors.push(match[1].trim());
        }
        return errors;
    }
    extractIntent(response) {
        const intentPattern = /(?:I will|I'm going to|Let me|Now I'll)\s+([^\n]+)/i;
        const match = response.match(intentPattern);
        return match ? match[1].trim() : null;
    }
    extractQuestions(response) {
        const questions = [];
        const questionPattern = /\d+\.\s+([^\n]+\?)/g;
        let match;
        while ((match = questionPattern.exec(response)) !== null) {
            questions.push(match[1].trim());
        }
        return questions;
    }
    extractCodeBlocks(response) {
        const blocks = [];
        const codePattern = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codePattern.exec(response)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2].trim(),
            });
        }
        return blocks;
    }
    extractFilePaths(response) {
        const paths = [];
        const pathPattern = /(?:file|path):\s*`([^`]+)`/gi;
        let match;
        while ((match = pathPattern.exec(response)) !== null) {
            paths.push(match[1]);
        }
        return paths;
    }
}
//# sourceMappingURL=ResponseParser.js.map