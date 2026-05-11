import simpleGit from 'simple-git';
export class GitOperationsCapability {
    git;
    constructor(cwd) {
        this.git = simpleGit(cwd);
    }
    async status(params) {
        try {
            const git = simpleGit(params.cwd);
            const status = await git.status();
            const branchInfo = await git.branch();
            return {
                success: true,
                data: {
                    modified: status.modified,
                    added: status.created,
                    deleted: status.deleted,
                    untracked: status.not_added,
                    branch: status.current || 'HEAD',
                    ahead: status.ahead,
                    behind: status.behind,
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
    async commit(params) {
        try {
            const git = simpleGit(params.cwd);
            if (params.files && params.files.length > 0) {
                await git.add(params.files);
            }
            else {
                await git.add('.');
            }
            const result = await git.commit(params.message);
            return {
                success: true,
                data: {
                    commitHash: result.commit,
                    message: params.message,
                    files: params.files || [],
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
    async diff(params) {
        try {
            const git = simpleGit(params.cwd);
            let diffResult;
            if (params.staged) {
                diffResult = await git.diff(['--cached']);
            }
            else if (params.file) {
                diffResult = await git.diff([params.file]);
            }
            else {
                diffResult = await git.diff();
            }
            const status = await git.status();
            const files = params.staged
                ? [...status.staged]
                : [...status.modified, ...status.created, ...status.deleted];
            return {
                success: true,
                data: {
                    diff: diffResult,
                    files,
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
    async history(params) {
        try {
            const git = simpleGit(params.cwd);
            const options = {
                '--max-count': params.maxCount || 50,
            };
            if (params.file) {
                options.file = params.file;
            }
            const log = await git.log(options);
            return {
                success: true,
                data: {
                    commits: log.all.map(commit => ({
                        hash: commit.hash,
                        author: commit.author_name,
                        date: commit.date,
                        message: commit.message,
                    })),
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
//# sourceMappingURL=GitOperations.js.map