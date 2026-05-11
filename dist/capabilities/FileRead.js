import fs from 'fs-extra';
export class FileReadCapability {
    name = 'file_read';
    description = 'Read content from a file';
    async execute(params) {
        try {
            const encoding = params.encoding || 'utf-8';
            const content = await fs.readFile(params.path, encoding);
            const stats = await fs.stat(params.path);
            return {
                success: true,
                data: {
                    content,
                    size: stats.size,
                    path: params.path,
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
}
//# sourceMappingURL=FileRead.js.map