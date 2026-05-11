import { LLMClient } from './llm/LLMClient';
import { executeTool, TOOLS_DEFINITIONS } from './tools/index';
import { getProviderConfig } from './utils/config';
import { getSystemPrompt } from './prompts/system';
import { loadHistory, saveHistory } from './utils/history';
import { loadProjectState, saveProjectState, updateProjectTodos, loadProjectContext, saveProjectContext, ensureProjectDir } from './utils/projectState';
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import * as path from 'path';
import type { ChatMessage } from './llm/providers/BaseProvider';

export interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ProjectConfig {
  type?: string;
  framework?: string;
  language?: string;
  commands?: {
    build?: string;
    test?: string;
    dev?: string;
  };
  constraints?: string[];
}

export class SpicaAgent extends EventEmitter {
  private llm: LLMClient | null = null;
  private interruptFlag = false;
  private workspacePath: string;
  private projectConfig: ProjectConfig = {};
  private _todos: Todo[] = [];
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;
  private _providerName?: string;

  constructor(providerName?: string, workspacePath?: string) {
    super();
    this._providerName = providerName;
    this.workspacePath = workspacePath || process.cwd();
  }

  get todos(): Todo[] {
    return this._todos;
  }

  interrupt() {
    this.interruptFlag = true;
    if (this.llm) {
      this.llm.interrupt();
    }
  }

async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;
    
    this._initPromise = this._doInit();
    await this._initPromise;
    this._initialized = true;
    this._initPromise = null;
  }
  
  private async _doInit(): Promise<void> {
    const config = await getProviderConfig(this._providerName);
    this.llm = new LLMClient({
      provider: this._providerName || 'openai',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      name: config.name,
    });
    
    ensureProjectDir(this.workspacePath);
    const projectContext = loadProjectContext(this.workspacePath);
    if (projectContext.length > 0) {
      this.llm.setMessages(projectContext);
      console.log(`Loaded ${projectContext.length} messages from project context`);
    }
    
    const projectState = loadProjectState(this.workspacePath);
    if (projectState) {
      this._todos = projectState.todos;
    }
    
    await this.loadProjectConfig();
    
    this.llm.setSystemPrompt(getSystemPrompt(this.projectConfig));
    
    this.llm.on('chunk', (chunk: string) => {
      this.emit('stream', { chunk });
    });
    
    this.llm.on('reasoning', (content: string) => {
      this.emit('reasoning', { content });
    });
    
    this.emit('initialized', { 
      model: config.model, 
      project: this.projectConfig,
    });
  }

  private async loadProjectConfig(): Promise<void> {
    const configPath = path.join(this.workspacePath, '.spica.md');
    
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      this.projectConfig = this.parseSpicaMd(content);
      this.emit('projectLoaded', this.projectConfig);
    } else {
      const autoConfig = await this.autoDetectProject();
      this.projectConfig = autoConfig;
      await this.createDefaultSpicaMd(autoConfig);
      this.emit('projectCreated', autoConfig);
    }
  }

  private async autoDetectProject(): Promise<ProjectConfig> {
    const config: ProjectConfig = {};
    
    const pkgPath = path.join(this.workspacePath, 'package.json');
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJson(pkgPath);
      config.type = 'Node.js';
      config.language = 'TypeScript/JavaScript';
      config.commands = {
        build: pkg.scripts?.build || 'npm run build',
        test: pkg.scripts?.test || 'npm test',
        dev: pkg.scripts?.dev || 'npm run dev',
      };
      
      if (pkg.devDependencies?.typescript) config.language = 'TypeScript';
      if (pkg.dependencies?.react || pkg.dependencies?.ink) config.type = 'React CLI';
      if (pkg.dependencies?.express || pkg.dependencies?.fastify) config.type = 'Webapp';
      return config;
    }
    
    const goModPath = path.join(this.workspacePath, 'go.mod');
    if (await fs.pathExists(goModPath)) {
      return {
        type: 'Go',
        language: 'Go',
        commands: { build: 'go build', test: 'go test ./...', dev: 'go run .' },
      };
    }
    
    const pyPath = path.join(this.workspacePath, 'requirements.txt');
    if (await fs.pathExists(pyPath)) {
      return {
        type: 'Python',
        language: 'Python',
        commands: { test: 'pytest', dev: 'python main.py' },
      };
    }
    
    const cargoPath = path.join(this.workspacePath, 'Cargo.toml');
    if (await fs.pathExists(cargoPath)) {
      return {
        type: 'Rust',
        language: 'Rust',
        commands: { build: 'cargo build', test: 'cargo test', dev: 'cargo run' },
      };
    }
    
    return { type: 'Unknown', language: 'Unknown' };
  }

  private async createDefaultSpicaMd(config: ProjectConfig): Promise<void> {
    const content = `# Spica Project Config

## Project Info
- Type: ${config.type || 'Unknown'}
- Framework: ${config.type || 'Unknown'}
- Language: ${config.language || 'Unknown'}

## Commands
- Build: \`${config.commands?.build || 'N/A'}\`
- Test: \`${config.commands?.test || 'N/A'}\`
- Dev: \`${config.commands?.dev || 'N/A'}\`

## Constraints
- Code style: No comments unless asked
- Testing: Use appropriate test framework
`;
    
    await fs.writeFile(path.join(this.workspacePath, '.spica.md'), content);
  }

  private parseSpicaMd(content: string): ProjectConfig {
    const config: ProjectConfig = {};
    
    const typeMatch = content.match(/Type:\s*(.+)/);
    if (typeMatch) config.type = typeMatch[1].trim();
    
    const frameworkMatch = content.match(/Framework:\s*(.+)/);
    if (frameworkMatch) config.framework = frameworkMatch[1].trim();
    
    const langMatch = content.match(/Language:\s*(.+)/);
    if (langMatch) config.language = langMatch[1].trim();
    
    const buildMatch = content.match(/Build:\s*`(.+)`/);
    const testMatch = content.match(/Test:\s*`(.+)`/);
    const devMatch = content.match(/Dev:\s*`(.+)`/);
    
    if (buildMatch || testMatch || devMatch) {
      config.commands = {};
      if (buildMatch) config.commands.build = buildMatch[1];
      if (testMatch) config.commands.test = testMatch[1];
      if (devMatch) config.commands.dev = devMatch[1];
    }
    
    return config;
  }

  setTodos(todos: string[]) {
    this._todos = todos.map(t => ({ content: t, status: 'pending' }));
    this.emit('todos_set', this._todos);
    updateProjectTodos(this.workspacePath, this._todos);
  }

  updateTodo(index: number, status: Todo['status']) {
    if (index >= 0 && index < this._todos.length) {
      this._todos[index].status = status;
      this.emit('todo_update', { index, status, todos: this._todos });
    }
  }

  setSystemPrompt(prompt: string) {
    if (this.llm) {
      this.llm.setSystemPrompt(prompt);
    }
  }

  async runLoop(prompt: string, maxIterations = 50): Promise<string> {
    this.interruptFlag = false;
    if (!this.llm) {
      await this.init();
    }
    
    if (!this.llm) {
      throw new Error('LLM client not initialized');
    }

    const projectContext = this.projectConfig.type ? `
Project Context (from .spica.md):
- Type: ${this.projectConfig.type}
- Framework: ${this.projectConfig.framework}
- Commands: Build=${this.projectConfig.commands?.build}, Test=${this.projectConfig.commands?.test}
` : '';

    this.emit('message', { role: 'user', content: prompt });

    let response = await this.llm.generate(prompt + projectContext, TOOLS_DEFINITIONS);
    
    let iterations = 0;

    while (!response.finished && iterations < maxIterations && !this.interruptFlag) {
      iterations++;
      
      if (this.interruptFlag) break;
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await Promise.all(response.toolCalls.map(async (tc) => {
          if (this.interruptFlag) return { name: tc.name, id: tc.id, result: 'interrupted' };
          
          this.emit('tool_call', { name: tc.name, arguments: tc.arguments });
          
          const result = await executeTool(tc.name, tc.arguments);
          
          this.emit('tool_result', { 
            name: tc.name, 
            success: result.success,
            output: result.output,
            error: result.error,
            diff: result.diff,
          });
          
          return { name: tc.name, id: tc.id, result: result.output || result.error || '' };
        }));
        
        if (this.interruptFlag) break;
        
        for (const { name, id, result } of toolResults) {
          response = await this.llm.continueWithToolResult(name, result, TOOLS_DEFINITIONS);
        }
      } else {
        break;
      }
    }

    const assistantContent = response.content || 
      this.llm?.getMessages().filter(m => m.role === 'assistant').pop()?.content || '';
    
    if (assistantContent) {
      this.emit('message', { role: 'assistant', content: assistantContent });
    }
    
    if (this.llm) {
      const allMessages = this.llm.getMessages();
      
      const simplifiedMessages = allMessages.filter(m => 
        m.role === 'user' || (m.role === 'assistant' && m.content && !m.toolCalls)
      );
      
      // 只保存项目级记忆，不保存全局记忆
      saveProjectContext(this.workspacePath, simplifiedMessages);
      
      if (this._todos.length > 0) {
        const state = loadProjectState(this.workspacePath) || {
          phase: 'unknown' as const,
          todos: [],
          decisions: [],
          lastActivity: new Date().toISOString(),
          recentFiles: [],
        };
        state.todos = this._todos;
        saveProjectState(this.workspacePath, state);
      }
    }

    return assistantContent;
  }

  getProjectConfig(): ProjectConfig {
    return this.projectConfig;
  }

  getWorkspacePath(): string {
    return this.workspacePath;
  }
}