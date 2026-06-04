import { LLMClient } from './llm/LLMClient';
import { TokenCounter } from './llm/TokenCounter';
import { executeTool, getAllToolDefinitions, setWorkspace, getWorkspace } from './tools/index';
import { initMCP, shutdownMCP } from './mcp/client';
import { initSkills, listSkills, getSkill, buildSkillPrompt } from './skills/index';
import { getProviderConfig } from './utils/settings';
import { getSystemPrompt, getCompactPrompt } from './prompts/system';
import { loadProjectConfig as loadAgentsConfig, autoDetectProject, createAgentsMd } from './utils/projectConfig';
import { SkillDefinition } from './utils/settings';
import { cleanMessages } from './utils/messageCleaner';
import { loadProjectState, saveProjectState, updateProjectTodos, loadProjectContext, saveProjectContext, ensureProjectDir } from './storage/projectState';
import { loadSession } from './utils/session';
import { runPreHooks, runPostHooks } from './hooks';
import { COLORS } from './cli/ui/colors';
import { createCheckpoint, listCheckpoints, type CheckpointMeta } from './storage/checkpointManager';
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import * as path from 'path';
import os from 'os';
import simpleGit from 'simple-git';
import type { ChatMessage } from './llm/providers/BaseProvider';

// 工具冲突检测：提取资源路径
function extractResourcePath(toolName: string, args: Record<string, unknown>): string | null {
  // 文件操作工具
  if (['file_read', 'file_write', 'file_edit', 'file_multi_edit', 'file_delete', 'file_copy', 'file_move', 'file_exists', 'file_patch'].includes(toolName)) {
    return (args.path || args.file_path || args.source || args.from) as string | null;
  }
  // bash 命令中可能涉及的文件（检测 rm、mv、cp 等操作）
  if (toolName === 'bash') {
    const cmd = (args.command as string) || '';
    // 提取 rm/mv/cp/cat/echo > 等操作的文件路径
    const fileOpMatch = cmd.match(/(?:rm|mv|cp|cat|head|tail|sed|awk|echo\s*>>|echo\s*>)\s+(['"]?)([^\s'"]+)\1/);
    if (fileOpMatch) return fileOpMatch[2];
  }
  // git 操作（整个仓库）
  if (toolName === 'git') {
    return 'git:repo';  // git 操作视为同资源
  }
  return null;
}

// 检测工具调用冲突：返回需要顺序执行的工具组
function detectToolConflicts(toolCalls: Array<{ name: string; id: string; arguments: Record<string, unknown> }>): {
  parallel: Array<{ name: string; id: string; arguments: Record<string, unknown> }>;
  sequential: Array<Array<{ name: string; id: string; arguments: Record<string, unknown> }>>;
  conflicts: Array<{ path: string; tools: string[] }>;
} {
  const pathToTools: Map<string, Array<{ name: string; id: string; arguments: Record<string, unknown> }>> = new Map();
  const noConflictTools: Array<{ name: string; id: string; arguments: Record<string, unknown> }> = [];

  for (const tc of toolCalls) {
    const resourcePath = extractResourcePath(tc.name, tc.arguments);
    if (resourcePath) {
      if (!pathToTools.has(resourcePath)) {
        pathToTools.set(resourcePath, []);
      }
      pathToTools.get(resourcePath)!.push(tc);
    } else {
      noConflictTools.push(tc);
    }
  }

  // 分组：无冲突的并行执行，有冲突的顺序执行
  const sequential: Array<Array<{ name: string; id: string; arguments: Record<string, unknown> }>> = [];
  const parallel: Array<{ name: string; id: string; arguments: Record<string, unknown> }> = [...noConflictTools];
  const conflicts: Array<{ path: string; tools: string[] }> = [];

  for (const [path, tools] of pathToTools) {
    if (tools.length === 1) {
      // 单个工具操作该资源，可以并行
      parallel.push(tools[0]);
    } else {
      // 多个工具操作同一资源，需要顺序执行
      sequential.push(tools);
      conflicts.push({ path, tools: tools.map(t => t.name) });
    }
  }

  return { parallel, sequential, conflicts };
}

/**
 * Todo item for task tracking
 */
export interface Todo {
  /** Task content/description */
  content: string;
  /** Task status: pending, in_progress, or completed */
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Project configuration detected from workspace
 */
export interface ProjectConfig {
  /** Project type: e.g., 'typescript', 'python' */
  type?: string;
  /** Framework: e.g., 'react', 'vue' */
  framework?: string;
  /** Primary language */
  language?: string;
  /** Build/test/dev commands */
  commands?: {
    build?: string;
    test?: string;
    dev?: string;
  };
  /** Project-specific constraints */
  constraints?: string[];
}

export class InterruptError extends Error {
  constructor(message = 'Interrupted by user') {
    super(message);
    this.name = 'InterruptError';
  }
}

/**
 * SpicaAgent - AI coding agent with three-step workflow
 *
 * Core responsibilities:
 * - Manage LLM client and tool orchestration
 * - Handle interrupt signals (ESC ESC / Ctrl+C)
 * - Manage project state and session persistence
 * - Coordinate MCP servers and skills
 *
 * @extends EventEmitter
 * @example
 * ```ts
 * const agent = new SpicaAgent('openai', '/path/to/workspace');
 * await agent.init();
 * const result = await agent.runLoop('fix the bug in app.ts');
 * ```
 */
export class SpicaAgent extends EventEmitter {
  private llm: LLMClient | null = null;

  /**
   * Get the LLM client instance
   * @returns LLMClient instance or null if not initialized
   */
  getLLM(): LLMClient | null {
    return this.llm;
  }
  private interruptFlag = false;
  private workspacePath: string;
  private projectConfig: ProjectConfig = {};
  private _todos: Todo[] = [];
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;
  private _providerName?: string;
  private _initAbortController: AbortController | null = null;
  private _cachedSkills: SkillDefinition[] = [];
  private _compacting = false;

  // 极危险操作模式（即使在 bypass 模式也需要确认）
  private static readonly DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /rm\s+-rf\s+\//, label: 'Recursive force delete root' },
    { pattern: /rm\s+-rf\s+\*/, label: 'Recursive force delete all' },
    { pattern: />\s*\/dev\//, label: 'Write to device' },
    { pattern: /mkfs\./, label: 'Filesystem format' },
    { pattern: /dd\s+if=/, label: 'Disk copy' },
    { pattern: /chmod\s+777/, label: 'World-writable permissions' },
    { pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/, label: 'Fork bomb' },
    { pattern: /sudo\s+su\b/, label: 'Switch to root' },
  ];

  // 检查是否为极危险操作
  isDangerousOperation(command: string): boolean {
    return SpicaAgent.DANGEROUS_PATTERNS.some(p => p.pattern.test(command));
  }

  // 获取危险操作的标签
  getDangerLabel(command: string): string | null {
    for (const { pattern, label } of SpicaAgent.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return label;
      }
    }
    return null;
  }

  // 工具级 AbortController（用于中断单个工具）
  private toolAbortControllers: Map<string, AbortController> = new Map();

  // 待处理的新输入（用于在工具执行间隙插入新指令）
  private pendingInput: string | null = null;
  
  // 队列输入注入回调（由 CLI 设置，用于在迭代间隙获取队列输入）
  private queueInputCallback: (() => string | null) | null = null;

  // 工具白名单（用于限制subagent工具访问）
  private toolWhitelist: string[] | null = null;

  constructor(providerName?: string, workspacePath?: string) {
    super();
    this._providerName = providerName;
    this.workspacePath = workspacePath || process.cwd();
  }

  get todos(): Todo[] {
    return this._todos;
  }

  /**
 * Interrupt agent execution
 *
 * Effects:
 * - Sets interrupt flag to stop current operation
 * - Aborts initialization if in progress
 * - Interrupts LLM streaming
 * - Aborts all active tool executions
 *
 * @emits tool_aborted when a tool is aborted
 */
interrupt() {
    this.interruptFlag = true;
    // 中断 init 中的连接检测
    if (this._initAbortController) {
      this._initAbortController.abort();
    }
    if (this.llm) {
      this.llm.interrupt();
    }
    // 中断所有正在执行的工具
    this.toolAbortControllers.forEach((controller, toolName) => {
      controller.abort();
      this.emit('tool_aborted', { tool: toolName });
    });
    this.toolAbortControllers.clear();
  }

  
  // 中断单个工具（不中断整个 runLoop）
  abortTool(toolName: string): void {
    const controller = this.toolAbortControllers.get(toolName);
    if (controller) {
      controller.abort();
      this.toolAbortControllers.delete(toolName);
      this.emit('tool_aborted', { tool: toolName });
    }
  }

  // 注册工具 AbortController
  registerToolAbortController(toolName: string, controller: AbortController): void {
    this.toolAbortControllers.set(toolName, controller);
  }

  // 清除工具 AbortController
  clearToolAbortController(toolName: string): void {
    this.toolAbortControllers.delete(toolName);
  }

  // 设置待处理的新输入（用于在工具执行间隙插入新指令）
  setPendingInput(input: string | null): void {
    this.pendingInput = input;
  }

  // 获取待处理的新输入
  getPendingInput(): string | null {
    return this.pendingInput;
  }

  // 设置队列输入回调（由 CLI 设置，用于在迭代间隙获取队列输入）
  setQueueInputCallback(callback: (() => string | null) | null): void {
    this.queueInputCallback = callback;
  }

  // 检查并获取队列输入
  checkQueueInput(): string | null {
    if (this.queueInputCallback) {
      return this.queueInputCallback();
    }
    return this.pendingInput;
  }

  setToolWhitelist(allowedTools: string[]): void {
    this.toolWhitelist = allowedTools;
  }

  // 创建自动 checkpoint（文件快照，不创建 git commit）
  private async createAutoCheckpoint(prompt: string): Promise<CheckpointMeta | null> {
    try {
      const meta = await createCheckpoint(this.workspacePath, prompt);

      if (meta) {
        this.emit('checkpoint_created', {
          id: meta.id,
          message: meta.message,
          filesBackedUp: meta.filesBackedUp.length,
        });
      }

      return meta;
    } catch (error) {
      // checkpoint 失败不影响 AI 工作
      this.emit('checkpoint_warning', { error: 'Failed to create checkpoint' });
      return null;
    }
  }

  // 获取最近的 checkpoint 列表
  async getCheckpoints(): Promise<CheckpointMeta[]> {
    return await listCheckpoints(this.workspacePath, 50);
  }

  // 获取git状态（辅助方法）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- simpleGit status.files type is complex
  private async getGitStatus(): Promise<{ files: any[] }> {
    try {
      const git = simpleGit(this.workspacePath);
      const status = await git.status();
      return { files: status.files };
    } catch {
      return { files: [] };
    }
  }


// 判断错误是否可重试
  private isRetryableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const code = String((error as { code?: unknown; status?: unknown }).code || (error as { code?: unknown; status?: unknown }).status || '');

    // 不可重试的错误
    const nonRetryablePatterns = [
      '400',  // 请求格式错误（如不支持的消息角色）
      '401',  // 认证失败
      '403',  // 权限不足
      '404',  // 资源不存在
      'invalid', 'unauthorized', 'permission',
    ];

    for (const pattern of nonRetryablePatterns) {
      if (message.includes(pattern) || code === pattern) {
        return false;
      }
    }

    // 可重试的错误：网络问题、超时、速率限制、服务器错误
    const retryablePatterns = [
      'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
      '429', '500', '502', '503',
      'timeout', 'network', 'connection', 'rate limit',
    ];

    for (const pattern of retryablePatterns) {
      if (message.toLowerCase().includes(pattern.toLowerCase()) || code === pattern) {
        return true;
      }
    }

    // 默认：未知错误也重试（网络波动等临时问题）
    return true;
  }

  // 判断工具错误是否是"关键错误"（应该停止整个生成循环）
  private isCriticalToolError(toolName: string, result: { success: boolean; error?: string; output?: string }): boolean {
    if (result.success) return false;

    const error = result.error || '';

    // Web 工具的特殊处理优先：网络/API 错误不应该停止整个任务
    // Agent 应该尝试其他方案或使用已有信息继续
    if (toolName === 'web_search' || toolName === 'web_fetch') {
      return false;  // web 工具错误永远不 critical
    }

    // 只有 AI 调用相关的错误才是 critical
    const criticalPatterns = [
      'invalid API key', 'authentication failed',
      'ECONNREFUSED', 'ENOTFOUND', 'API connection failed',
      // 注意：403/401 对于非 AI 调用不 critical（如 web 工具已在上面处理）
    ];

    for (const pattern of criticalPatterns) {
      if (error.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  // 带重试的 LLM 调用（参考 Claude Code 等 coding agent 的重试策略）
  private async callLLMWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 10
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.interruptFlag) {
        throw new Error('Interrupted by user');
      }

      try {
        return await operation();
      } catch (error: unknown) {
        // InterruptError: don't retry, propagate immediately
        if (error instanceof InterruptError || (error instanceof Error && error.name === 'InterruptError')) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // 最后一次尝试不再重试
        if (attempt === maxRetries) {
          break;
        }

        if (this.interruptFlag) {
          break;
        }

        // 检查是否可重试（认证等错误直接抛出）
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!this.isRetryableError(error)) {
          this.emit('error_suggestion', {
            tool: operationName,
            error: errorMsg,
            suggestion: `Error not retryable, user needs to handle: ${errorMsg}`
          });
          throw error;
        }

        if (this.interruptFlag) {
          break;
        }

        // 指数退避：2s, 4s, 8s, 16s, 32s, 64s, 120s...（最大120秒）
        const delay = Math.min(2000 * Math.pow(2, attempt), 120000);
        this.emit('retry_attempt', {
          operation: operationName,
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: errorMsg,
        });

        const start = Date.now();
        while (Date.now() - start < delay) {
          if (this.interruptFlag) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.interruptFlag) {
          break;
        }
      }
    }

    throw lastError;
  }

/**
 * Initialize agent and LLM client
 *
 * Steps:
 * 1. Initialize skills system
 * 2. Initialize MCP servers
 * 3. Load provider configuration
 * 4. Create LLM client instance
 * 5. Load workspace state and session
 *
 * @returns Promise that resolves when initialization complete
 * @throws Error if initialization fails or is interrupted
 */
async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;
    
    this._initPromise = this._doInit();
    try {
      await this._initPromise;
      this._initialized = true;
    } finally {
      this._initPromise = null;
    }
  }
  
  private async _doInit(): Promise<void> {
    this._initAbortController = new AbortController();

    // 初始化Skills（首次运行时复制默认包）
    await initSkills();

    // 初始化MCP服务器连接
    try {
      await initMCP();
    } catch (error) {
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
      throw new Error(`API connection failed: ${connectionResult.type}\n${connectionResult.hint}\nDetails: ${connectionResult.error}`);
    }

    ensureProjectDir(this.workspacePath);

    // 从session文件加载完整历史（不是损坏的context.json）
    const session = loadSession(this.workspacePath);
    if (session && session.messages.length > 0) {
      // session.messages已经通过cleanMessages清理过了
      this.llm.setMessages(session.messages);
    }

    const projectState = loadProjectState(this.workspacePath);
    if (projectState) {
      this._todos = projectState.todos;
    }
    
    await this.loadProjectConfig();
    
    // Build skills metadata for system prompt
    const skills = listSkills(this.workspacePath);
    const skillsMetadata = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    
    this.llm.setSystemPrompt(getSystemPrompt(this.projectConfig, skillsMetadata, this.workspacePath));
    
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
      const cleanedMessages = this.cleanMessagesForLLM(messages);
      this.llm.setMessages(cleanedMessages);
    }
  }

  private cleanMessagesForLLM(messages: ChatMessage[]): ChatMessage[] {
    return cleanMessages(messages);
  }

  /**
 * Main agent execution loop
 *
 * Workflow:
 * 1. Match skill if input matches skill pattern
 * 2. Create auto checkpoint before work
 * 3. Compress context if needed
 * 4. Generate LLM response
 * 5. Execute tools (parallel or sequential based on conflicts)
 * 6. Continue until finished or max iterations
 *
 * @param prompt - User input/prompt
 * @param maxIterations - Maximum loop iterations (default: 50)
 * @returns Final response string
 * @throws InterruptError if interrupted by user
 */
async runLoop(prompt: string, maxIterations = 50): Promise<string> {
    this.interruptFlag = false;

    // 验证 prompt 不为空
    if (!prompt || prompt.trim().length === 0) {
      this.emit('empty_input');
      return 'Empty input - no task to execute. Please provide a prompt.';
    }

    if (!this.llm) {
      await this.init();
    }

    if (!this.llm) {
      throw new Error('LLM client not initialized');
    }

    // 🔒 自动checkpoint：在AI工作前创建备份点（文件快照，不污染git）
    await this.createAutoCheckpoint(prompt);
    
    // Pre-request: 基于token数判断是否需要压缩
    const existingMessages = this.llm.getMessages();
    const tokenCounter = new TokenCounter();

    // 从provider获取上下文窗口大小
    const provider = this.llm.getProvider();
    const contextWindow = provider.getContextWindow();
    tokenCounter.setContextWindow(contextWindow);

    const usedTokens = tokenCounter.estimateMessages(existingMessages);
    const usagePercent = Math.floor(usedTokens / contextWindow * 100);
    
    // 多级预警机制（上下文管理优化）
    if (usagePercent >= 50 && usagePercent < 60) {
      this.emit('context_warning', {
        level: 'info',
        usage: usagePercent,
        message: `Context at ${usagePercent}% - consider using subagent for complex tasks`,
        suggestion: 'Use task tool to dispatch subagent and avoid dumbzone'
      });
    } else if (usagePercent >= 60 && usagePercent < 70) {
      this.emit('context_warning', {
        level: 'warning',
        usage: usagePercent,
        message: `Context at ${usagePercent}% - strongly recommend subagent`,
        suggestion: 'Dispatch independent tasks to subagents immediately'
      });
    }

    const triggerThreshold = Math.floor(contextWindow * 0.7);  // 触发阈值：70%（现代设计，更早触发避免过满）

    // 当使用超过触发阈值时自动压缩（compact 内部会 emit context_compressed 事件）
    if (usedTokens > triggerThreshold) {
      await this.compact();
    }

    this.emit('message', { role: 'user', content: prompt });

    const toolDefinitions = getAllToolDefinitions();
    this.emit('waiting_for_llm');  // 通知外部启动心跳

    let response;
    try {
      response = await this.callLLMWithRetry(
        () => this.llm!.generate(prompt, toolDefinitions),
        'llm_generate'
      );
    } catch (llmError: unknown) {
      const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
      this.emit('error_suggestion', {
        tool: 'llm_generate',
        error: errorMsg,
        suggestion: 'Network or API temporary error. Check network connection and retry later.'
      });
      return `LLM request failed (retried 10 times): ${errorMsg}. Check API config and network.`;
    }

    // 防御性检查：确保 response 存在
    if (!response) {
      this.emit('error_suggestion', {
        tool: 'llm_generate',
        error: 'LLM returned undefined',
        suggestion: 'LLM returned exception, please retry'
      });
      return 'LLM returned exception, please retry';
    }

    let iterations = 0;

    const allToolResults: Array<{ name: string; id: string; result: string }> = [];
    let criticalErrorDetected: { tool: string; error: string; suggestion: string } | null = null;
    let queueInjectedThisIteration = false;  // 防止同一迭代内重复注入队列

    while (!response.finished && iterations < maxIterations && !this.interruptFlag) {
      iterations++;
      queueInjectedThisIteration = false;  // 每次迭代重置

      if (this.interruptFlag) {
        break;
      }

      // 检查队列输入：在每次迭代开始时（LLM响应后）检查是否有新输入
      const queuedInputAtStart = this.checkQueueInput();
      if (queuedInputAtStart) {
        this.emit('queue_injected', { input: queuedInputAtStart.slice(0, 50) });
        // 将队列输入作为用户消息注入
        this.llm!.addMessage({ role: 'user', content: `[QUEUED INPUT] ${queuedInputAtStart}` });
        queueInjectedThisIteration = true;  // 标记已注入
      }

      // 检查response状态
      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (response.content) {
          // 有内容输出，任务完成
          break;
        }
        // 空响应：LLM没有输出任何内容或工具调用
        // 不应该直接退出，而是警告并继续尝试
        this.emit('empty_response_warning', {
          iteration: iterations,
          message: 'LLM returned empty response, retrying...'
        });

        // 如果连续多次空响应，停止并报告问题
        if (iterations >= maxIterations - 1) {
          this.emit('error_suggestion', {
            tool: 'llm_generate',
            error: 'Multiple empty responses from LLM',
            suggestion: 'LLM may be stuck. Try providing more specific instructions or check API status.'
          });
          break;
        }

        // 添加提示消息，让LLM继续尝试
        this.llm!.addMessage({
          role: 'user' as const,
          content: '[SYSTEM] Previous response was empty. Please continue working on the task and provide a response or use tools.'
        });

        // 重新调用LLM获取新响应
        this.emit('waiting_for_llm');
        try {
          response = await this.callLLMWithRetry(
            () => this.llm!.generate('', toolDefinitions),
            'llm_generate_empty_retry'
          );
        } catch (retryError: unknown) {
          const errorMsg = retryError instanceof Error ? retryError.message : String(retryError);
          this.emit('error_suggestion', {
            tool: 'llm_generate',
            error: errorMsg,
            suggestion: 'LLM retry failed after empty response. Check API status.'
          });
          break;
        }
        continue;
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        // 冲突检测：检测同一资源的并发操作
        const { parallel, sequential, conflicts } = detectToolConflicts(response.toolCalls);

        // 发送冲突警告
        if (conflicts.length > 0) {
          this.emit('tool_conflict_warning', {
            conflicts,
            message: `Detected ${conflicts.length} resource conflicts. Tools targeting same resources will execute sequentially.`
          });
        }

        // 执行单个工具的内部函数
        const executeSingleTool = async (tc: { name: string; id: string; arguments: Record<string, unknown> }): Promise<{ name: string; id: string; result: string; isCritical?: boolean; referencedSkills?: string[] }> => {
          if (this.interruptFlag) return { name: tc.name, id: tc.id, result: 'interrupted' };

          const tcArgs = tc.arguments || {};

          // Hooks检查
          const hookResult = runPreHooks(tc.name, tcArgs);
          if (hookResult.matched) {
            if (hookResult.action === 'block') {
              this.emit('tool_result', { name: tc.name, success: false, error: `Blocked: ${hookResult.message}` });
              this.emit('hook_blocked', { tool: tc.name, reason: hookResult.message });
              return { name: tc.name, id: tc.id, result: `Blocked: ${hookResult.message}` };
            }

            if (hookResult.action === 'warn') {
              this.emit('hook_warning', { tool: tc.name, message: hookResult.message });
            }
          }

          // 工具白名单检查
          if (this.toolWhitelist && !this.toolWhitelist.includes(tc.name)) {
            this.emit('tool_result', { name: tc.name, success: false, error: `Tool ${tc.name} not allowed for this subagent` });
            return { name: tc.name, id: tc.id, result: `Tool ${tc.name} blocked by whitelist` };
          }

          this.emit('tool_call', { name: tc.name, arguments: tcArgs });
          setWorkspace(this.workspacePath);

          const toolAbortController = new AbortController();
          this.registerToolAbortController(tc.name, toolAbortController);
          tcArgs._abortSignal = toolAbortController.signal;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eventCallback = (event: string, data: any) => {
            this.emit(event, data);
            if (event === 'tool_stuck_warning') {
              this.abortTool(tc.name);
              this.interruptFlag = true;
            }
          };

          try {
            const result = await executeTool(tc.name, tcArgs, eventCallback);
            this.clearToolAbortController(tc.name);

            if (!result.success) {
              if (result.error?.includes('aborted') || result.error?.includes('interrupted')) {
                this.emit('tool_result', { name: tc.name, success: false, error: `Tool execution aborted (stuck or interrupted). Try: detached=true, shorter timeout, or interactive mode.` });
                return { name: tc.name, id: tc.id, result: `Tool interrupted, need to try other approaches`, isCritical: true };
              }

              if (this.isCriticalToolError(tc.name, result)) {
                const suggestion = this.generateErrorSuggestion(tc.name, result.error || '', tcArgs);
                criticalErrorDetected = { tool: tc.name, error: result.error || 'Unknown error', suggestion };
                this.emit('tool_result', { name: tc.name, success: false, error: result.error });
                return { name: tc.name, id: tc.id, result: `Critical error: ${result.error}`, isCritical: true };
              }

              this.emit('error_suggestion', { toolName: tc.name, error: result.error || 'Unknown error', suggestion: this.generateErrorSuggestion(tc.name, result.error || '', tcArgs) });
            }

            if (result.success && (tc.name === 'file_write' || tc.name === 'file_edit' || tc.name === 'file_multi_edit') && result.diff) {
              this.emit('diff_preview', { filePath: tcArgs.path || tcArgs.file_path, diff: result.diff });
            }

            this.emit('tool_result', { name: tc.name, success: result.success, output: result.output, error: result.error, diff: result.diff });

            const postHookMessage = runPostHooks(tc.name, tcArgs, result);
            if (postHookMessage) {
              this.emit('hook_log', { tool: tc.name, message: postHookMessage });
            }

            if (tc.name === 'workspace' && result.success && tcArgs.path) {
              await this.switchWorkspace(tcArgs.path as string);
            }

            return {
              name: tc.name,
              id: tc.id,
              result: result.content || result.output || result.error || '',
              referencedSkills: tc.name === 'skill' && result.success ? result.referencedSkills : undefined
            };
          } catch (toolError: unknown) {
            this.clearToolAbortController(tc.name);
            const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
            this.emit('tool_result', { name: tc.name, success: false, error: errorMsg });
            return { name: tc.name, id: tc.id, result: `Tool execution error: ${errorMsg}` };
          }
        };

        // 并行执行无冲突的工具
        const parallelResults = await Promise.all(parallel.map(tc => executeSingleTool(tc)));

        // 顺序执行有冲突的工具组
        const sequentialResults: Array<{ name: string; id: string; result: string; isCritical?: boolean; referencedSkills?: string[] }> = [];
        for (const conflictGroup of sequential) {
          for (const tc of conflictGroup) {
            if (this.interruptFlag) {
              sequentialResults.push({ name: tc.name, id: tc.id, result: 'interrupted' });
              break;
            }
            const result = await executeSingleTool(tc);
            sequentialResults.push(result);
          }
        }

        // 合并所有结果
        const toolResults = [...parallelResults, ...sequentialResults];

        allToolResults.push(...toolResults);

        // 中断检查：如果被中断，先保存tool results到历史，再停止
        if (this.interruptFlag) {
          // 重要：保存已执行的tool results，避免历史损坏（缺少tool messages导致API报错）
          if (toolResults.length > 0 && this.llm) {
            this.llm.addToolMessages(toolResults.map(t => ({ id: t.id, result: t.result })));
          }
          this.emit('agent_interrupted', {
            toolResults: toolResults.map(t => ({ name: t.name, result: t.result.slice(0, 100) })),
          });
          return '[INTERRUPTED] Agent execution stopped by user (ESC ESC). You can retry or continue with a new request.';
        }

        // 关键错误检查：如果检测到关键错误，停止生成并报告
        const criticalError = criticalErrorDetected as { tool: string; error: string; suggestion: string } | null;
        if (criticalError) {
          this.emit('agent_stopped_on_error', {
            tool: criticalError.tool,
            error: criticalError.error,
            suggestion: criticalError.suggestion,
          });
          return `[STOPPED] Agent stopped due to critical error in ${criticalError.tool}.\nError: ${criticalError.error}\nSuggestion: ${criticalError.suggestion}\nPlease fix the issue and retry.`;
        }

        // Skill chain: collect referenced skills for post-tool injection
        const referencedSkills = toolResults
          .filter(t => t.referencedSkills && t.referencedSkills.length > 0)
          .flatMap(t => t.referencedSkills || []);
        
        const skillMessages = referencedSkills.map(refName => ({
          role: 'system' as const,
          content: `REQUIRED_SKILL: ${refName}`
        }));

        // 检查队列输入：在工具执行完成后注入新指令（如果迭代开始时没有注入过）
        // 只有当迭代开始时没有注入队列，才在这里检查并注入
        let queuedInput: string | null = null;
        if (!queueInjectedThisIteration) {
          queuedInput = this.checkQueueInput();
          if (queuedInput) {
            this.emit('queue_injected', { input: queuedInput.slice(0, 50) });
          }
        }

        // 合并所有后置消息
        const postToolMessages = [
          ...skillMessages,
          ...(queuedInput ? [{ role: 'user' as const, content: `[QUEUED INPUT] ${queuedInput}` }] : [])
        ];

        // 所有工具完成后，一次性发送所有结果给LLM继续生成
        if (toolResults.length > 0) {
          this.emit('waiting_for_llm');  // 通知外部启动心跳
          try {
            response = await this.callLLMWithRetry(
              () => this.llm!.continueWithAllToolResults(
                toolResults.map(t => ({ name: t.name, result: t.result, id: t.id })),
                toolDefinitions,
                postToolMessages  // 在 tool 消息之后添加
              ),
              'llm_continue'
            );
          } catch (llmError: unknown) {
            const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
            const isRetryable = this.isRetryableError(llmError);

            // 关键修复：保留已执行的 tool results，不要丢弃
            // 只有当工具确实执行了才保留，否则清理不完整序列
            const toolsActuallyExecuted = toolResults.filter(t => t.result !== 'interrupted' && !t.result.includes('blocked by whitelist'));

            this.emit('error_suggestion', {
              tool: 'llm_continue',
              error: errorMsg,
              suggestion: isRetryable
                ? 'Network or API temporary error (retried 10 times). Tool results preserved - continue conversation.'
                : `Error not retryable: ${errorMsg}. Tool results preserved.`
            });

            // 添加一个用户消息记录已执行的操作（方便继续）
            if (toolsActuallyExecuted.length > 0) {
              const resultsSummary = toolsActuallyExecuted.map(t => `[${t.name}] ${t.result.slice(0, 200)}`).join('\n');
              this.llm?.addMessage({
                role: 'user' as const,
                content: `[SYSTEM NOTE] Previous operations completed but LLM response failed. Results:\n${resultsSummary}\nError: ${errorMsg}\nPlease continue based on these results.`
              });
            }

            // 不清理 tool messages，保留完整历史
            // cleanMessages 会在下次 generate 时处理不完整序列

            const resultsSummary = toolResults.map(t => `${t.name}: ${t.result.slice(0, 100)}`).join('\n');
            return `Operations completed but LLM continuation failed.\nError: ${errorMsg}\nCompleted operations:\n${resultsSummary}\nTool results preserved in history. Continue conversation to proceed.`;
          }
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

      // 结束时保存，只保留 user 和 assistant 消息，移除 toolCalls 防止 API 报错
      const simplifiedMessages = allMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role,
          content: m.content || '',
        }));

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

  private generateErrorSuggestion(toolName: string, error: string, args: Record<string, unknown>): string {
    const suggestions: Record<string, (e: string, a: Record<string, unknown>) => string> = {
      file_read: (e, a) =>
        e.includes('ENOENT') ? `File not found: ${a.path}. Check path or use glob.`
        : e.includes('EACCES') ? `Permission denied: ${a.path}. Check file permissions.`
        : `Read failed. Check path.`,
      file_write: (e, a) =>
        e.includes('EACCES') ? `Permission denied: ${a.path}. Check file permissions.`
        : e.includes('ENOENT') ? `Directory not found: ${a.path}. Create directory first.`
        : `Write failed. Check path and content.`,
      bash: (e, a) =>
        e.includes('command not found') ? `Command not found: ${a.command}. Install required tool.`
        : e.includes('Permission denied') ? `Permission denied: ${a.command}. Check permissions or use sudo.`
        : `Execution failed. Check command syntax.`,
      glob: (e, a) => `Search failed. Check pattern: ${a.pattern}`,
      grep: (e, a) => `Search failed. Check pattern and path.`,
    };

    let baseSuggestion = suggestions[toolName]?.(error, args) || `Tool ${toolName} failed. Check parameters.`;

    return baseSuggestion;
  }

  // 公开方法：手动压缩历史（使用 LLM 生成摘要）
  /**
 * Compact message history to reduce token usage
 *
 * Triggered when:
 * - Used tokens > 80% of context window
 *
 * Effects:
 * - Summarizes old messages
 * - Keeps recent tool calls and results
 * - Emits 'context_compressed' event
 *
 * @returns Promise that resolves when compression complete
 * @emits context_compressed with { before, after, removed }
 */
public async compact(): Promise<void> {
    if (!this.llm || this._compacting) return;
    this._compacting = true;
    try {
      const provider = this.llm.getProvider();
      const targetTokens = Math.floor(provider.getContextWindow() * 0.3);
      await this.compactToTarget(targetTokens);
    } finally {
      this._compacting = false;
    }
  }

  // 压缩到指定目标tokens以下
  private async compactToTarget(targetTokens: number): Promise<void> {
    if (!this.llm) return;
    const allMessages = this.llm.getMessages();
    const tokenCounter = new TokenCounter();
    const provider = this.llm.getProvider();
    tokenCounter.setContextWindow(provider.getContextWindow());
    const contextWindow = provider.getContextWindow();

    const usedTokens = tokenCounter.estimateMessages(allMessages);

    // 如果 tokens 已经低于目标，不需要压缩
    if (usedTokens < targetTokens) {
      this.emit('context_compressed', { before: allMessages.length, after: allMessages.length, tokensBefore: usedTokens, tokensAfter: usedTokens });
      return;
    }

    // 根据超量程度决定保留消息数量
    const ratio = usedTokens / targetTokens;
    let keepCount = ratio > 2 ? 5 : ratio > 1.5 ? 8 : 12;
    // 确保最小保留 5 条，最大保留不超过 15 条，且不超过总数的 25%
    // 测试证明 min=3 max=8 过于激进，会丢失太多上下文
    // Adaptive floor: small windows keep fewer, large windows keep more
    const minKeep = Math.max(3, Math.min(8, Math.ceil(contextWindow / 50000)));
    keepCount = Math.max(minKeep, Math.min(keepCount, Math.max(minKeep + 2, 15), Math.floor(allMessages.length * 0.25)));

    const recentMessages = allMessages.slice(-keepCount);
    const oldMessages = allMessages.slice(0, -keepCount);

    // Adaptive truncation: 1% of context window, floor 500 chars
    const maxContentLength = Math.max(500, Math.floor(contextWindow * 0.01));

    // 对 recentMessages 中的超长内容进行截断
    const truncatedRecent = recentMessages.map(m => {
      // 截断 content（adaptive to context window）
      const truncatedContent = (m.content || '').length > maxContentLength
        ? (m.content || '').slice(0, maxContentLength) + '...[truncated]'
        : m.content;

      // 截断 toolCalls（adaptive to context window）
      const maxToolCalls = Math.max(3, Math.min(10, Math.floor(contextWindow / 25000)));
      let truncatedToolCalls = m.toolCalls;
      if (m.toolCalls && m.toolCalls.length > maxToolCalls) {
        truncatedToolCalls = m.toolCalls.slice(0, maxToolCalls);
        // 标记被截断
        truncatedToolCalls.push({
          id: 'truncated',
          name: '...[truncated]',
          arguments: {}
        });
      }

      return {
        ...m,
        content: truncatedContent,
        toolCalls: truncatedToolCalls,
      };
    });

    // 用 LLM 生成摘要（如果还有旧消息）
    // Safety: if kept messages alone exceed 70% of target, reduce until they fit
    const MAX_COMPACT_ITERATIONS = 5;
    let safetyTruncated = [...truncatedRecent];
    let safetyTokens = tokenCounter.estimateMessages(safetyTruncated);
    let compactIterations = 0;

    // 从后面移除消息（保留前面的assistant-tool配对）
    while (safetyTokens > targetTokens * 0.7 && safetyTruncated.length > 3) {
      compactIterations++;
      if (compactIterations > MAX_COMPACT_ITERATIONS) {
        this.emit('context_warning', {
          level: 'warning',
          usage: 100,
          message: `Compact loop exceeded ${MAX_COMPACT_ITERATIONS} iterations. Keeping remaining messages.`,
        });
        break;
      }
      safetyTruncated.pop();  // 从后面移除
      safetyTokens = tokenCounter.estimateMessages(safetyTruncated);
    }
    // Recompute oldMessages to match possibly reduced recent set
    const finalOldMessages = allMessages.slice(0, allMessages.length - safetyTruncated.length);

    if (finalOldMessages.length > 0) {
      const summary = await this.generateSummary(finalOldMessages);
      // 保留 assistant + 对应的 tool messages，过滤掉孤立的 tool messages
      const safetyTruncatedClean: ChatMessage[] = [];
      const existingToolMessageIds = new Set<string>();
      const assistantToolCallIds = new Set<string>();

      // 第一遍：收集所有存在的 tool message 的 toolCallId，以及所有 assistant 的 toolCall id
      for (const m of safetyTruncated) {
        if (m.role === 'tool' && m.toolCallId) {
          existingToolMessageIds.add(m.toolCallId);
        }
        if (m.role === 'assistant' && m.toolCalls) {
          for (const tc of m.toolCalls) {
            assistantToolCallIds.add(tc.id);
          }
        }
      }

      // 第二遍：保留 user/assistant/system，以及匹配的 tool messages
      for (const m of safetyTruncated) {
        if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
          // 如果是 assistant with toolCalls，检查每个toolCall是否有对应的tool message
          if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            const hasAllToolMessages = m.toolCalls.every(tc => existingToolMessageIds.has(tc.id));
            if (!hasAllToolMessages) {
              // 缺少部分 tool messages，去掉所有 toolCalls
              safetyTruncatedClean.push({ ...m, toolCalls: undefined });
            } else {
              safetyTruncatedClean.push(m);
            }
          } else {
            safetyTruncatedClean.push(m);
          }
        } else if (m.role === 'tool' && m.toolCallId) {
          // 只保留有对应 assistant message 的 tool message
          if (assistantToolCallIds.has(m.toolCallId)) {
            safetyTruncatedClean.push(m);
          }
        }
      }

      const compressed = [summary, ...safetyTruncatedClean];
      this.llm.setMessages(compressed);

      // 检查压缩后的 tokens，如果仍然超限，继续压缩
      const newTokens = tokenCounter.estimateMessages(compressed);
      if (newTokens > targetTokens && compressed.length > 3) {
        // 再次压缩，只保留最近 2 条 + 摘要
        const finalMessages = compressed.slice(-2);
        const secondSummary = await this.generateSummary(compressed.slice(0, -2));
        this.llm.setMessages([secondSummary, ...finalMessages]);
      }
    } else {
      // 没有旧消息，只截断（也要过滤）
      const safetyTruncatedClean = safetyTruncated.filter(m => 
        m.role === 'user' || m.role === 'assistant' || m.role === 'system'
      );
      this.llm.setMessages(safetyTruncatedClean);
    }

    this.emit('context_compressed', {
      before: allMessages.length,
      after: this.llm.getMessages().length,
      tokensBefore: usedTokens,
      tokensAfter: tokenCounter.estimateMessages(this.llm.getMessages()),
    });
  }

  // Generate history summary using LLM
  private async generateSummary(messages: ChatMessage[]): Promise<ChatMessage> {
    // Filter out tool messages before compression
    const filteredMessages = messages.filter(m => 
      m.role === 'user' || m.role === 'assistant' || m.role === 'system'
    );
    
    // Build messages text (smart truncation)
    const messagesText = filteredMessages.map(m => {
      const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'AI' : 'System';
      let content = m.content || '';
      
      // Preserve tool call info
      if (m.toolCalls && m.toolCalls.length > 0) {
        const toolInfo = m.toolCalls.map(tc => {
          // Preserve key args (path, command, etc.)
          const args = tc.arguments || {};
          const keyArgs = args.path || args.command || args.files || '';
          return `${tc.name}${keyArgs ? `(${keyArgs})` : ''}`;
        }).join(', ');
        content = `[Tools: ${toolInfo}] ${content.slice(0, 50)}`;
      }
      
      // Smart truncation: preserve start and end
      if (content.length > 150) {
        return `${role}: ${content.slice(0, 80)}...${content.slice(-40)}`;
      }
      return `${role}: ${content}`;
    }).join('\n');

    const prompt = getCompactPrompt(messagesText);

    try {
      const response = await this.llm!.generateDirect(prompt);
      return {
        role: 'assistant',
        content: `[History Summary] ${response.content || 'Early conversation compressed'}`,
      };
    } catch {
      // Fallback: preserve user questions AND tool call names in order
      const items: string[] = [];
      for (const m of messages) {
        if (m.role === 'user') {
          items.push((m.content || '').slice(0, 60));
        } else if (m.toolCalls && m.toolCalls.length > 0) {
          const toolNames = m.toolCalls.map(tc => tc.name).join(', ');
          items.push(`[${toolNames}]`);
        }
      }
      const summary = items.slice(0, 10).join(' | ');
      return {
        role: 'assistant',
        content: `[History Summary] Task chain: ${summary}`,
      };
    }
  }

  // 旧的简单压缩方法（备用）
  }