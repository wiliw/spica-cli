import { LLMClient } from './llm/LLMClient';
import { executeTool, getAllToolDefinitions, setWorkspace, getWorkspace } from './tools/index';
import { initMCP, shutdownMCP } from './mcp/client';
import { getProviderConfig } from './utils/config';
import { getSystemPrompt } from './prompts/system';
import { loadProjectConfig as loadAgentsConfig, autoDetectProject, createAgentsMd } from './utils/projectConfig';
import { loadProjectState, saveProjectState, updateProjectTodos, loadProjectContext, saveProjectContext, ensureProjectDir } from './utils/projectState';
import { runPreHooks, runPostHooks } from './hooks';
import { createCheckpoint, analyzeError, getRecoveryStrategy, restoreCheckpoint, getLastCheckpoint } from './utils/errorRecovery';
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
  private _initAbortController: AbortController | null = null;

  // 权限确认状态
  private permissionQueue: Array<{ reason: string; resolve: (approved: boolean) => void }> = [];
  private permissionPending = false;
  private permissionResolve: ((approved: boolean) => void) | null = null;
  private bypassPermissions = false;  // 跳过权限请求模式

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
    // 中断 init 中的连接检测
    if (this._initAbortController) {
      this._initAbortController.abort();
    }
    if (this.llm) {
      this.llm.interrupt();
    }
    // 拒绝所有待处理的权限请求
    this.permissionQueue.forEach(p => p.resolve(false));
    this.permissionQueue = [];
    this.permissionPending = false;
  }

  // 权限检查
  private checkNeedsPermission(toolName: string, args: Record<string, any>): string | null {
    const safeArgs = args || {};

    if (toolName === 'file_delete') {
      return `Delete: ${safeArgs.path || 'unknown'}`;
    }

    if (toolName === 'bash') {
      const cmd = String(safeArgs.command || '');

      // 更精确的危险命令检测
      const dangerousPatterns = [
        { pattern: 'rm -rf', name: '删除整个目录' },
        { pattern: 'rm /*', name: '删除根目录' },
        { pattern: 'chmod 777', name: '开放所有权限' },
        { pattern: 'sudo ', name: '使用sudo权限' },
        { pattern: 'dd if=', name: '磁盘操作' },
        { pattern: 'mkfs', name: '格式化磁盘' },
        { pattern: '> /dev/', name: '写入设备文件' },
        { pattern: 'mv /', name: '移动根目录文件' },
        { pattern: 'git push --force', name: '强制推送' },
        { pattern: 'git reset --hard', name: '硬重置' },
      ];

      for (const { pattern, name } of dangerousPatterns) {
        if (cmd.includes(pattern)) {
          return `${name}: ${cmd.slice(0, 60)}`;
        }
      }
    }

    return null;
  }

  // 等待权限确认（串行处理）
  async waitForPermission(reason: string): Promise<boolean> {
    // 如果bypass模式开启，自动批准
    if (this.bypassPermissions) {
      this.emit('permission_bypassed', { reason });
      return true;
    }

    // 将请求加入队列
    const request = { reason, resolve: null as ((approved: boolean) => void) | null };
    const promise = new Promise<boolean>((resolve) => {
      request.resolve = resolve;
    });
    this.permissionQueue.push(request as any);

    // 如果当前没有正在处理的请求，开始处理队列
    if (!this.permissionPending) {
      this.processPermissionQueue();
    }

    return promise;
  }

  // 处理权限队列
  private async processPermissionQueue(): Promise<void> {
    while (this.permissionQueue.length > 0 && !this.interruptFlag) {
      this.permissionPending = true;
      const request = this.permissionQueue.shift()!;

      // 发送事件给CLI
      this.emit('permission_request', { reason: request.reason });

      // 等待用户响应（通过 approvePermission/denyPermission）
      const approved = await new Promise<boolean>((resolve) => {
        this.permissionResolve = resolve;
      });

      // 处理结果
      if (request.resolve) {
        request.resolve(approved);
      }
      this.emit('permission_result', { approved });
    }
    this.permissionPending = false;
    this.permissionResolve = null;
  }

  // 用户批准（处理当前请求）
  approvePermission() {
    if (this.permissionResolve) {
      this.permissionResolve(true);
      this.permissionResolve = null;
    }
  }

  // 用户拒绝（处理当前请求）
  denyPermission() {
    if (this.permissionResolve) {
      this.permissionResolve(false);
      this.permissionResolve = null;
    }
  }

  get isPermissionPending(): boolean {
    return this.permissionPending;
  }

  // 设置bypass模式
  setBypassPermissions(enabled: boolean): void {
    this.bypassPermissions = enabled;
    this.emit('bypass_changed', { enabled });
  }

  get isBypassPermissions(): boolean {
    return this.bypassPermissions;
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
    this._initAbortController = new AbortController();

    // 初始化MCP服务器连接
    try {
      await initMCP();
    } catch (error) {
      // MCP初始化失败不影响主流程
      console.log('MCP init skipped (no config or servers unavailable)');
    }

    const config = await getProviderConfig(this._providerName);
    this.llm = new LLMClient({
      provider: this._providerName || 'openai',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      name: config.name,
    });

    // 检查API连接（支持中断）
    const connectionResult = await this.llm.checkConnection(this._initAbortController.signal);
    this._initAbortController = null;

    if (!connectionResult.success) {
      this.emit('connection_error', {
        type: connectionResult.type,
        error: connectionResult.error,
        hint: connectionResult.hint,
        provider: this._providerName,
        model: config.model,
      });
      throw new Error(`API连接失败: ${connectionResult.type}\n${connectionResult.hint}\n详情: ${connectionResult.error}`);
    }

    ensureProjectDir(this.workspacePath);
    const projectContext = loadProjectContext(this.workspacePath);
    if (projectContext.length > 0) {
      this.llm.setMessages(projectContext);
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
    // 使用新的 projectConfig.ts（兼容多种格式）
    const loadedConfig = loadAgentsConfig(this.workspacePath);

    if (loadedConfig) {
      this.projectConfig = loadedConfig;
      this.emit('projectLoaded', this.projectConfig);
    } else {
      // 无配置文件，自动检测并创建 AGENTS.md
      const autoConfig = autoDetectProject(this.workspacePath);
      this.projectConfig = autoConfig;
      await createAgentsMd(this.workspacePath);
      this.emit('projectCreated', autoConfig);
    }
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

  getMessages(): ChatMessage[] {
    return this.llm?.getMessages() || [];
  }

  setMessages(messages: ChatMessage[]) {
    if (this.llm) {
      this.llm.setMessages(messages);
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

    // Pre-request compression: 压缩现有消息历史
    const existingMessages = this.llm.getMessages();
    if (existingMessages.length > 15) {
      const compressed = this.compressHistory(existingMessages);
      this.llm.setMessages(compressed);
      this.emit('context_compressed', { before: existingMessages.length, after: compressed.length });
    }

    // 创建checkpoint（在开始任务前）
    await createCheckpoint(`Task: ${prompt.slice(0, 50)}`);

    // Simplified project context (减少token)
    const projectContext = this.projectConfig.type
      ? `Project: ${this.projectConfig.type}, Build: ${this.projectConfig.commands?.build || 'N/A'}, Test: ${this.projectConfig.commands?.test || 'N/A'}`
      : '';

    this.emit('message', { role: 'user', content: prompt });

    const toolDefinitions = getAllToolDefinitions();
    let response = await this.llm.generate(prompt + (projectContext ? `\n${projectContext}` : ''), toolDefinitions);

    let iterations = 0;

    const allToolResults: Array<{ name: string; id: string; result: string }> = [];

    while (!response.finished && iterations < maxIterations && !this.interruptFlag) {
      iterations++;

      if (this.interruptFlag) {
        break;
      }

      // 检查response状态
      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (response.content) {
          break;
        }
        break;
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await Promise.all(response.toolCalls.map(async (tc) => {
          if (this.interruptFlag) return { name: tc.name, id: tc.id, result: 'interrupted' };

          const tcArgs = tc.arguments || {};  // 确保 arguments 存在

          // Hooks检查（优先于权限检查）
          const hookResult = runPreHooks(tc.name, tcArgs);
          if (hookResult.matched) {
            if (hookResult.action === 'block') {
              this.emit('tool_result', {
                name: tc.name,
                success: false,
                error: `Blocked: ${hookResult.message}`,
              });
              this.emit('hook_blocked', { tool: tc.name, reason: hookResult.message });
              return { name: tc.name, id: tc.id, result: `Blocked: ${hookResult.message}` };
            }

            if (hookResult.action === 'confirm') {
              const approved = await this.waitForPermission(hookResult.message);
              if (!approved) {
                this.emit('tool_result', {
                  name: tc.name,
                  success: false,
                  error: 'Permission denied by user',
                });
                return { name: tc.name, id: tc.id, result: 'Permission denied by user' };
              }
            }

            if (hookResult.action === 'warn') {
              this.emit('hook_warning', { tool: tc.name, message: hookResult.message });
            }
          }

          // 权限检查（原有逻辑）
          const permissionReason = this.checkNeedsPermission(tc.name, tcArgs);
          if (permissionReason) {
            const approved = await this.waitForPermission(permissionReason);
            if (!approved) {
              this.emit('tool_result', {
                name: tc.name,
                success: false,
                error: 'Permission denied by user',
              });
              return { name: tc.name, id: tc.id, result: 'Permission denied by user' };
            }
          }

          this.emit('tool_call', { name: tc.name, arguments: tcArgs });

          // 同步 workspace 到 tools 模块
          setWorkspace(this.workspacePath);

          // 事件回调 - 用于转发子agent事件
          const eventCallback = (event: string, data: any) => {
            this.emit(event, data);
          };

          const result = await executeTool(tc.name, tcArgs, eventCallback);

          if (!result.success) {
            this.emit('error_suggestion', {
              toolName: tc.name,
              error: result.error,
              suggestion: this.generateErrorSuggestion(tc.name, result.error, tcArgs),
            });
          }

          // 文件编辑成功时发送diff预览
          if (result.success && (tc.name === 'file_write' || tc.name === 'file_edit') && result.diff) {
            this.emit('diff_preview', {
              filePath: tcArgs.path || tcArgs.file_path,
              diff: result.diff,
            });
          }

          this.emit('tool_result', {
            name: tc.name,
            success: result.success,
            output: result.output,
            error: result.error,
            diff: result.diff,
          });

          // PostToolUse hooks
          const postHookMessage = runPostHooks(tc.name, tcArgs, result);
          if (postHookMessage) {
            this.emit('hook_log', { tool: tc.name, message: postHookMessage });
          }

          // workspace切换处理
          if (tc.name === 'workspace' && result.success && tcArgs.path) {
            await this.switchWorkspace(tcArgs.path);
          }

          return { name: tc.name, id: tc.id, result: result.output || result.error || '' };
        }));

        allToolResults.push(...toolResults);

        if (this.interruptFlag) break;

        // 所有工具完成后，一次性发送所有结果给LLM继续生成
        if (toolResults.length > 0) {
          response = await this.llm.continueWithAllToolResults(
            toolResults.map(t => ({ name: t.name, result: t.result })),
            toolDefinitions
          );
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

      // 上下文压缩：保留最近20条消息，压缩旧消息
      const compressedMessages = this.compressHistory(allMessages);

      const simplifiedMessages = compressedMessages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, toolCallId: m.toolCallId };
        }

        if (m.toolCalls && allToolResults.length > 0) {
          const enrichedToolCalls = m.toolCalls.map(tc => {
            const matchingResult = allToolResults.find(tr => tr.name === tc.name);
            return {
              ...tc,
              result: matchingResult?.result || '',
            };
          });

          return {
            role: m.role,
            content: m.content,
            toolCalls: enrichedToolCalls,
          };
        }

        return {
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
        };
      }).filter(m => m.role === 'user' || m.role === 'assistant');

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

  async switchWorkspace(newPath: string): Promise<void> {
    this.workspacePath = newPath;

    // 重置状态
    this.projectConfig = {};
    this._todos = [];
    this._initialized = false;
    this._initPromise = null;

    // 清空LLM消息历史
    if (this.llm) {
      this.llm.setMessages([]);
    }

    // 发送workspace变更事件
    this.emit('workspace_changed', { path: newPath });

    // 重新初始化（检测新项目）
    await this.init();
  }

  private generateErrorSuggestion(toolName: string, error: string, args: any): string {
    const lastCp = getLastCheckpoint();
    const suggestions: Record<string, (e: string, a: any) => string> = {
      file_read: (e, a) =>
        e.includes('ENOENT') ? `文件不存在: ${a.path}. 建议: 检查路径或使用glob查找`
        : e.includes('EACCES') ? `无权限读取: ${a.path}. 建议: 检查文件权限`
        : `读取失败. 建议: 确认路径正确`,
      file_write: (e, a) =>
        e.includes('EACCES') ? `无权限写入: ${a.path}. 建议: 检查文件权限`
        : e.includes('ENOENT') ? `目录不存在: ${a.path}. 建议: 先创建目录`
        : `写入失败. 建议: 确认路径和内容`,
      bash: (e, a) =>
        e.includes('command not found') ? `命令不存在: ${a.command}. 建议: 安装对应工具`
        : e.includes('Permission denied') ? `权限不足: ${a.command}. 建议: 检查权限或使用sudo`
        : `执行失败. 建议: 检查命令语法`,
      glob: (e, a) => `搜索失败. 建议: 检查pattern: ${a.pattern}`,
      grep: (e, a) => `搜索失败. 建议: 检查pattern和路径`,
    };

    let baseSuggestion = suggestions[toolName]?.(error, args) || `工具 ${toolName} 失败. 建议: 检查参数`;

    // 如果有checkpoint，添加回滚选项
    if (lastCp && (toolName === 'file_write' || toolName === 'file_edit' || toolName === 'bash')) {
      baseSuggestion += `. 如需回滚，可恢复到checkpoint`;
    }

    return baseSuggestion;
  }

  // 公开方法：手动压缩历史
  public compact(): void {
    if (!this.llm) return;
    const allMessages = this.llm.getMessages();
    const compressed = this.compressHistory(allMessages);
    this.llm.setMessages(compressed);
  }

  private compressHistory(messages: ChatMessage[]): ChatMessage[] {
    const MAX_MESSAGES = 15;  // 减少到15条以加速处理

    if (messages.length <= MAX_MESSAGES) {
      return messages;
    }

    // 1. 识别重要消息（决策、成功、失败、错误）
    const importantKeywords = ['决定', '决策', '成功', '完成', '失败', '错误', '结论', '重要'];
    const importantMessages: ChatMessage[] = [];

    messages.forEach(m => {
      const content = m.content || '';
      if (importantKeywords.some(k => content.includes(k)) ||
          (m.role === 'assistant' && content.length > 100)) {
        // 保留完整的重要assistant消息
        importantMessages.push(m);
      }
    });

    // 2. 压缩工具调用结果（更激进压缩）
    const compressedMessages: ChatMessage[] = [];
    let lastWasTool = false;
    let toolSummary = '';

    messages.forEach(m => {
      if (m.role === 'tool') {
        // 工具结果压缩为简短摘要（更激进）
        const content = m.content || '';
        if (content.length > 30) {
          toolSummary += content.slice(0, 15) + '... ';
        } else {
          toolSummary += content + ' ';
        }
        lastWasTool = true;
      } else {
        if (lastWasTool && toolSummary) {
          // 插入工具摘要（限制长度）
          compressedMessages.push({
            role: 'assistant',
            content: `[工具] ${toolSummary.slice(0, 100)}`,
          });
          toolSummary = '';
        }
        compressedMessages.push(m);
        lastWasTool = false;
      }
    });

    // 3. 合并：保留重要消息 + 最近消息
    const recentCount = Math.min(MAX_MESSAGES - importantMessages.length, 10);
    const recentMessages = compressedMessages.slice(-recentCount);

    // 组合结果
    const result: ChatMessage[] = [];

    // 插入重要消息（排除已在recent中的）
    importantMessages.forEach(m => {
      if (!recentMessages.includes(m)) {
        result.push(m);
      }
    });

    // 插入摘要
    if (messages.length > MAX_MESSAGES + 5) {
      const summary = this.createSummary(messages.slice(0, -MAX_MESSAGES));
      result.push({
        role: 'assistant',
        content: `[历史摘要] ${summary}`,
      });
    }

    // 添加最近消息
    result.push(...recentMessages);

    // 确保不超过限制
    return result.slice(-MAX_MESSAGES);
  }

  private createSummary(messages: ChatMessage[]): string {
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
    const assistantMessages = messages.filter(m => m.role === 'assistant').map(m => m.content);

    const userTopics = userMessages.map(c => c.slice(0, 50)).join('; ');
    const assistantTopics = assistantMessages.map(c => c.slice(0, 50)).join('; ');

    return `之前讨论: ${userTopics.slice(0, 200)}. 已完成: ${assistantTopics.slice(0, 200)}`;
  }
}