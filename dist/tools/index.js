import fs from 'fs-extra';
import { execa } from 'execa';
import simpleGit from 'simple-git';
export const TOOLS_DEFINITIONS = [
    {
        name: 'file_write',
        description: 'Write content to a file',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                content: { type: 'string', description: 'File content' },
            },
            required: ['path', 'content'],
        },
    },
    {
        name: 'file_read',
        description: 'Read file content',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
        },
    },
    {
        name: 'file_edit',
        description: 'Edit file by replacing exact text',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path' },
                old: { type: 'string', description: 'Text to replace' },
                new: { type: 'string', description: 'New text' },
            },
            required: ['path', 'old', 'new'],
        },
    },
    {
        name: 'bash',
        description: 'Execute bash command',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Command to execute' },
            },
            required: ['command'],
        },
    },
    {
        name: 'git_commit',
        description: 'Git commit with message',
        parameters: {
            type: 'object',
            properties: {
                message: { type: 'string', description: 'Commit message' },
            },
            required: ['message'],
        },
    },
];
export async function executeTool(name, args) {
    try {
        switch (name) {
            case 'file_write':
                await fs.writeFile(args.path, args.content, 'utf-8');
                return { success: true, output: `Wrote ${args.path}` };
            case 'file_read':
                const content = await fs.readFile(args.path, 'utf-8');
                return { success: true, output: content };
            case 'file_edit':
                const fileContent = await fs.readFile(args.path, 'utf-8');
                if (!fileContent.includes(args.old)) {
                    return { success: false, error: `Text not found in ${args.path}` };
                }
                const newContent = fileContent.replace(args.old, args.new);
                await fs.writeFile(args.path, newContent, 'utf-8');
                return { success: true, output: `Edited ${args.path}` };
            case 'bash':
                const result = await execa(args.command, { shell: true });
                return { success: true, output: result.stdout };
            case 'git_commit':
                const git = simpleGit();
                await git.add('.');
                await git.commit(args.message);
                return { success: true, output: `Committed: ${args.message}` };
            default:
                return { success: false, error: `Unknown tool: ${name}` };
        }
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
//# sourceMappingURL=index.js.map