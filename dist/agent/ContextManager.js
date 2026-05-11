export class ContextManager {
    conversationHistory = [];
    fileChanges = [];
    projectState;
    maxHistorySize = 100;
    maxFileSize = 50000;
    constructor(rootPath) {
        this.projectState = {
            rootPath,
            openFiles: [],
            recentChanges: [],
        };
    }
    addConversationEntry(entry) {
        this.conversationHistory.push(entry);
        if (this.conversationHistory.length > this.maxHistorySize) {
            this.conversationHistory.shift();
        }
    }
    recordFileChange(change) {
        this.fileChanges.push(change);
        this.projectState.recentChanges = this.fileChanges.slice(-20);
    }
    setOpenFiles(files) {
        this.projectState.openFiles = files;
    }
    setGitInfo(branch, lastCommit) {
        this.projectState.gitBranch = branch;
        this.projectState.lastCommit = lastCommit;
    }
    getConversationHistory() {
        return this.conversationHistory;
    }
    getRecentChanges() {
        return this.fileChanges.slice(-10);
    }
    getProjectState() {
        return this.projectState;
    }
    getContextSummary() {
        const parts = [];
        parts.push(`Project: ${this.projectState.rootPath}`);
        if (this.projectState.gitBranch) {
            parts.push(`Branch: ${this.projectState.gitBranch}`);
        }
        if (this.projectState.openFiles.length > 0) {
            parts.push(`Open files: ${this.projectState.openFiles.join(', ')}`);
        }
        if (this.fileChanges.length > 0) {
            const recent = this.fileChanges.slice(-5);
            parts.push(`Recent changes: ${recent.map(c => `${c.operation} ${c.path}`).join('; ')}`);
        }
        return parts.join('\n');
    }
    clearHistory() {
        this.conversationHistory = [];
    }
    clearChanges() {
        this.fileChanges = [];
        this.projectState.recentChanges = [];
    }
}
//# sourceMappingURL=ContextManager.js.map