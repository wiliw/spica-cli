import fs from 'fs-extra';
export class FileEditCapability {
    name = 'file_edit';
    description = 'Edit a file by replacing exact text matches';
    async execute(params) {
        try {
            const content = await fs.readFile(params.path, 'utf-8');
            if (!content.includes(params.oldString)) {
                return {
                    success: false,
                    error: `Text not found in ${params.path}`,
                };
            }
            let newContent;
            let replacements;
            if (params.replaceAll) {
                const parts = content.split(params.oldString);
                replacements = parts.length - 1;
                newContent = parts.join(params.newString);
            }
            else {
                const index = content.indexOf(params.oldString);
                if (index === -1) {
                    return {
                        success: false,
                        error: `Text not found in ${params.path}`,
                    };
                }
                newContent = content.replace(params.oldString, params.newString);
                replacements = 1;
            }
            await fs.writeFile(params.path, newContent, 'utf-8');
            return {
                success: true,
                data: {
                    path: params.path,
                    replacements,
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
//# sourceMappingURL=FileEdit.js.map