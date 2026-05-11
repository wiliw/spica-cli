import fs from 'fs-extra';
export class FileWriteCapability {
    name = 'file_write';
    description = 'Write content to a file';
    async execute(params) {
        try {
            const encoding = params.encoding || 'utf-8';
            await fs.ensureFile(params.path);
            await fs.writeFile(params.path, params.content, encoding);
            return {
                success: true,
                data: {
                    path: params.path,
                    bytesWritten: Buffer.byteLength(params.content, encoding),
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
//# sourceMappingURL=FileWrite.js.map