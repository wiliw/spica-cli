export class PromptManager {
    skillPrompts = new Map();
    templates = new Map();
    constructor() {
        this.InitializeDefaults();
    }
    InitializeDefaults() {
        this.skillPrompts.set('mvp', {
            system: `You are an AI coding agent implementing MVP workflow.

Workflow steps:
1. Ask user 3 core questions (core function, deadline, tech constraints)
2. Recommend tech stack with rationale
3. Suggest creative ideas user might not think of
4. Design extensible architecture
5. Implement core function (write files, run tests)
6. Create documents (spec.md, tasks.md, project-log.md)

Tools available: file_write, file_read, file_edit, bash, git_commit

Always use tools to implement. Create working code.`,
            user: '',
            tools: ['file_write', 'file_read', 'file_edit', 'bash', 'git_commit'],
        });
        this.skillPrompts.set('cycle', {
            system: `You are an AI coding agent implementing Cycle workflow.

Workflow:
1. Judge request type (bug/simple/complex)
2. Bug → diagnose, fix, test loop
3. Simple → implement, test
4. Complex → test first, implement, verify
5. Update tasks.md
6. Demo result

Auto-fix loop: if test fails, diagnose → fix → test → repeat (max 5 times)
If cannot fix, ask user.

Tools: file_write, file_read, file_edit, bash, git_commit`,
            user: '',
            tools: ['file_write', 'file_read', 'file_edit', 'bash', 'git_commit'],
        });
        this.skillPrompts.set('archive', {
            system: `You are an AI coding agent archiving project.

Workflow:
1. Run all tests (verify pass)
2. Check tasks.md completion
3. Update CHANGELOG.md with version
4. Git commit + tag
5. Archive change directory

Tools: file_write, file_read, file_edit, bash, git_commit`,
            user: '',
            tools: ['file_write', 'file_read', 'file_edit', 'bash', 'git_commit'],
        });
        this.templates.set('question', `User wants to build: {description}

Ask 3 core questions to understand requirements:
1. What is the core function?
2. What is the deadline/timeline?
3. What are the technical constraints?`);
        this.templates.set('tech_recommendation', `Based on requirements gathered:
{requirements}

Recommend tech stack with rationale. Consider:
- Project type and complexity
- Team familiarity
- Scalability needs
- Quick delivery priority`);
    }
    getSkillPrompt(skillName) {
        return this.skillPrompts.get(skillName);
    }
    setSkillPrompt(skillName, prompt) {
        this.skillPrompts.set(skillName, prompt);
    }
    getTemplate(templateName) {
        return this.templates.get(templateName);
    }
    applyTemplate(templateName, variables) {
        let template = this.templates.get(templateName) || '';
        for (const [key, value] of Object.entries(variables)) {
            template = template.replace(`{${key}}`, value);
        }
        return template;
    }
    addTemplate(name, template) {
        this.templates.set(name, template);
    }
    getAvailableSkills() {
        return Array.from(this.skillPrompts.keys());
    }
    getToolsForSkill(skillName) {
        const prompt = this.skillPrompts.get(skillName);
        return prompt?.tools || [];
    }
    buildPrompt(skillName, context) {
        const skillPrompt = this.skillPrompts.get(skillName);
        if (!skillPrompt)
            return '';
        let prompt = skillPrompt.system;
        if (context) {
            prompt += `\n\nCurrent context:\n${context}`;
        }
        return prompt;
    }
}
//# sourceMappingURL=PromptManager.js.map