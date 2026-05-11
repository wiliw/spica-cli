import { glob } from 'glob';
import fs from 'fs-extra';
export class FileSearchCapability {
    name = 'file_search';
    description = 'Search for files and content within files';
    async execute(params) {
        try {
            const pattern = params.include || '**/*';
            const files = await glob(pattern, {
                cwd: params.path,
                ignore: params.exclude ? [params.exclude] : undefined,
                nodir: true,
            });
            const matches = [];
            const regex = new RegExp(params.pattern, 'g');
            for (const file of files) {
                const filePath = `${params.path}/${file}`;
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (regex.test(line)) {
                        matches.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim(),
                        });
                    }
                    regex.lastIndex = 0;
                });
            }
            return {
                success: true,
                data: {
                    matches,
                    totalMatches: matches.length,
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
//# sourceMappingURL=FileSearch.js.map