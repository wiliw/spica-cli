import { SpicaAgent } from '../agent';
import { getScreenManager } from './ui/screenManager';
import { COLORS } from './ui/colors';
import { TokenCounter } from '../llm/TokenCounter';
import { getRuntimeState } from '../core/RuntimeState';
import os from 'os';

// 事件数据类型定义
interface ConnectionErrorData {
  type: string;
  hint: string;
  error?: string;
}

interface StreamData {
  chunk: string;
}

// Note: Some interfaces are kept for future use or documentation purposes
interface ReasoningData {
  content: string;
}

interface ToolCallData {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResultData {
  name: string;
  success: boolean;
  output?: string;
  error?: string;
  diff?: string;
  syntaxErrors?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for documentation
interface ContextWarningData {
  level: string;
  usage: number;
  message: string;
  suggestion?: string;
}

interface ContextCompressedData {
  before: number;
  after: number;
  tokensBefore?: number;
  tokensAfter?: number;
  message?: string;
}

interface QueueInjectedData {
  input: string;
}

interface RetryAttemptData {
  operation: string;
  attempt: number;
  maxRetries: number;
  delay: number;
  error: string;
}

interface ErrorSuggestionData {
  tool?: string;
  toolName?: string;
  error: string;
  suggestion: string;
}

interface DiffPreviewData {
  filePath: string;
  diff: string;
}

interface HookBlockedData {
  tool: string;
  reason: string;
}

interface HookWarningData {
  tool: string;
  message: string;
}

interface HookLogData {
  tool: string;
  message: string;
}

interface WorkspaceChangedData {
  path: string;
}

interface SubAgentStartData {
  id: string;
  prompt: string;
  type?: string;
  description?: string;
}

interface SubAgentToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface SubAgentToolResultData {
  id: string;
  name: string;
  result: string;
  success?: boolean;
}

interface SubAgentDoneData {
  id: string;
  result: string;
  summary?: string;
}

interface SubAgentErrorData {
  id: string;
  error: string;
}

interface PendingInputDetectedData {
  content: string;
  input?: string;
}

interface ToolStuckWarningData {
  tool: string;
  timeout: number;
  elapsedMs?: number;
}

interface ToolAbortedData {
  tool: string;
  reason: string;
}

interface TodoUpdateData {
  todos: Array<{ content: string; status: string }>;
}

interface AgentInterruptedData {
  toolResults: Array<{ name: string; result: string }>;
}

interface AgentStoppedOnErrorData {
  tool: string;
  error: string;
  suggestion: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for documentation
interface MessageData {
  role: string;
  content: string;
}


const screen = getScreenManager();
const state = getRuntimeState();

// 构建状态栏文本（状态 | 模型 | 工作区）
function buildStatusText(
  agent: SpicaAgent,
  model: string | undefined
): string {
  const isBusy = state.isProcessing();
  const statusText = isBusy ? COLORS.warning('busy') : COLORS.success('idle');

  // 工作区路径显示（智能缩写）
  const workspace = agent.getWorkspacePath();
  const homeDir = os.homedir();
  let displayPath = workspace;

  // 缩写用户目录为 ~
  if (workspace.startsWith(homeDir)) {
    displayPath = '~' + workspace.slice(homeDir.length);
  }

  // 路径过长时显示最后两级
  if (displayPath.length > 30) {
    const parts = displayPath.split(/[/\\]/);
    if (parts.length > 2) {
      displayPath = '...' + parts.slice(-2).join('/');
    }
  }

  return `${statusText} | ${model || '?'} | ${displayPath}`;
}

function formatArgs(args: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '';
  const keys = Object.keys(args);
  const parts = keys.map(k => {
    const v = args[k];
    if (typeof v === 'string') {
      if (k === 'path' || k === 'source' || k === 'destination') {
        return `${k}=${v.split('/').pop() || v}`;
      }
      return `${k}=${v}`;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      return `${k}=${v}`;
    }
    return k;
  });
  return `(${parts.join(', ')})`;
}

// 工具摘要辅助函数
function countDiffLines(text: string, prefix: '+' | '-'): number {
  return text.split('\n').filter(l => l.startsWith(prefix) && !l.startsWith(prefix + prefix)).length;
}

function countMatches(output: string): number {
  const match = output.match(/(\d+)\s+matches/i) || output.match(/Found\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

function countFiles(output: string): number {
  const lines = output.split('\n').filter(l => l.trim() && !l.includes('found'));
  return lines.length;
}

function countTestPassed(output: string): number {
  const match = output.match(/(\d+)\s+passed/i) || output.match(/✓\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function countTestFailed(output: string): number {
  const match = output.match(/(\d+)\s+failed/i) || output.match(/✗\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function countLintErrors(output: string): number {
  const match = output.match(/(\d+)\s+errors/i) || output.match(/(\d+)\s+problems/i);
  return match ? parseInt(match[1], 10) : 0;
}

function countAgents(output: string): number {
  const match = output.match(/(\d+)\s+agents/i) || output.match(/(\d+)\s+tasks/i);
  return match ? parseInt(match[1], 10) : 0;
}

function formatToolSummary(data: { name: string; success: boolean; output?: string; error?: string; content?: string }): string {
  if (!data.success) {
    const errorMsg = data.error ? data.error.slice(0, 50) : '';
    return errorMsg ? ` (${errorMsg})` : '';
  }

  const name = data.name;
  const output = data.output || '';

  switch (name) {
    case 'file_read': {
      const lines = output.split('\n').length;
      return ` (${lines} lines)`;
    }
    case 'file_write':
    case 'file_edit':
    case 'file_multi_edit': {
      const added = countDiffLines(output, '+');
      const removed = countDiffLines(output, '-');
      if (added > 0 && removed > 0) {
        return ` (+${added}/-${removed} lines)`;
      } else if (added > 0) {
        return ` (+${added} lines)`;
      } else if (removed > 0) {
        return ` (-${removed} lines)`;
      }
      return '';
    }
    case 'bash': {
      const bashLines = output.split('\n').filter(l => l.trim()).length;
      const timeMatch = output.match(/\((\d+\.?\d*)s\)/);
      const time = timeMatch ? timeMatch[1] : '';
      return time ? ` (${bashLines} lines, ${time}s)` : ` (${bashLines} lines)`;
    }
    case 'grep': {
      const matchCount = countMatches(output);
      return matchCount > 0 ? ` → ${matchCount} matches` : '';
    }
    case 'glob': {
      const fileCount = countFiles(output);
      return fileCount > 0 ? ` → ${fileCount} files` : '';
    }
    case 'test': {
      const passed = countTestPassed(output);
      const failed = countTestFailed(output);
      if (failed > 0) {
        return ` (${passed} passed, ${failed} failed)`;
      }
      return passed > 0 ? ` (${passed} passed)` : '';
    }
    case 'lint': {
      const errors = countLintErrors(output);
      return errors > 0 ? ` (${errors} errors)` : ' (0 errors)';
    }
    case 'git':
      return '';
    case 'monitor': {
      const taskId = data.content || '';
      return taskId ? ` (${taskId.slice(0, 20)})` : '';
    }
    case 'task_stop':
      return '';
    case 'skill':
      return '';
    case 'task': {
      const agentCount = countAgents(output);
      return agentCount > 0 ? ` (${agentCount} agents)` : '';
    }
    default:
      return '';
  }
}

export function setupAgentEvents(
  agent: SpicaAgent,
  _interactive: boolean = false,
  model?: string,
  _tokenCounter?: TokenCounter
): () => void {
  // 收集所有注册的监听器，用于 cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- EventEmitter requires any[] for handler compatibility
  type EventHandler = (...args: any[]) => void;
  const listeners: Array<{ event: string; handler: EventHandler }> = [];
  const on = (event: string, handler: EventHandler) => {
    agent.on(event, handler);
    listeners.push({ event, handler });
  };

  // 追踪 reasoning 状态
  let reasoningStarted = false;
  let justSwitchedFromReasoning = false;

  // 每次新对话开始时重置 reasoning 状态
  on('waiting_for_llm', () => {
    reasoningStarted = false;
    justSwitchedFromReasoning = false;
  });

  on('connection_error', (data: ConnectionErrorData) => {
    state.setConnectionErrorShown(true);
    screen.appendScroll(COLORS.error(`\n[ERR] ${data.type}: ${data.hint}\n`));
    if (data.error) {
      screen.appendScroll(COLORS.muted(`Details: ${data.error}\n`));
    }
  });

  on('stream', (data: StreamData) => {

    // 从 reasoning 切换到 stream 时，加分隔线
    if (reasoningStarted && !justSwitchedFromReasoning) {
      justSwitchedFromReasoning = true;
      if (state.isVerboseMode()) {
        screen.appendScroll('\n' + COLORS.muted('---\n'));
      } else {
        screen.appendScroll('\n');
      }
    }

    // 设置流式状态（防止输入刷新干扰输出）
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      screen.setStreaming(true);
    }
    screen.appendScroll(COLORS.primary(data.chunk));
  });

  on('reasoning', (data: ReasoningData) => {
    // 只在第一次显示 thinking 提示
    if (!reasoningStarted) {
      reasoningStarted = true;
      justSwitchedFromReasoning = false;
      if (state.isVerboseMode()) {
        screen.appendScroll('\n' + COLORS.reasoning('[THINKING]\n'));
        if (!state.isStreamingOutput()) {
          state.setStreamingOutput(true);
          screen.setStreaming(true);
        }
      } else {
        screen.appendScroll(COLORS.muted('[thinking]'));
      }
    }

    // verbose 模式下显示完整 reasoning content
    if (state.isVerboseMode()) {
      screen.appendScroll(COLORS.reasoning(data.content));
    }
  });

  on('tool_call', (data: ToolCallData) => {
    state.setStreamingOutput(false);
    screen.setStreaming(false);
    // 从reasoning切换到tool_call时，需要换行
    if (reasoningStarted) {
      screen.appendScroll('\n');
      reasoningStarted = false;  // 重置reasoning状态
    }
    const argsStr = formatArgs(data.arguments);
    // 显示工具调用区块开始
    const toolLabel = `${data.name}${argsStr ? ` ${argsStr}` : ''}`;
    const boxWidth = Math.max(toolLabel.length + 4, 20);
    screen.appendScroll(COLORS.tool(`\n┌─ ${toolLabel} ${'─'.repeat(boxWidth - toolLabel.length - 4)}┐\n`));

  });

  on('tool_result', (data: ToolResultData) => {
    state.setStreamingOutput(false);
    screen.setStreaming(false);
    const icon = data.success ? '✓' : '✗';
    const colorFn = data.success ? COLORS.success : COLORS.error;

    // 显示语法错误（如果有）
    if (data.syntaxErrors && data.syntaxErrors.length > 0) {
      screen.appendScroll(COLORS.error(`  ⚠ Syntax errors:\n`));
      data.syntaxErrors.forEach((err: string) => {
        screen.appendScroll(COLORS.error(`    ${err}\n`));
      });
    }

    // 显示输出内容（不折叠）
    const output = data.output || data.error || '';
    if (output && !data.diff) {
      output.split('\n').forEach((line: string) => {
        screen.appendScroll(COLORS.muted(`  │ ${line}\n`));
      });
    }

    // 显示工具区块结束边框
    const statusLabel = `${icon} ${data.name}`;
    const boxWidth = Math.max(statusLabel.length + 4, 20);
    screen.appendScroll(colorFn(`└─ ${statusLabel} ${'─'.repeat(boxWidth - statusLabel.length - 4)}┘\n`));

    // Diff 预览单独显示（不在区块内）
    if (data.diff && !['file_write', 'file_edit', 'file_multi_edit'].includes(data.name)) {
      screen.appendScroll(COLORS.muted(`${data.diff}\n`));
    }

    // 输出完成，恢复光标到输入框并刷新显示
    screen.restoreCursor();
    screen.refreshInput();
  });

  // Diff预览（文件编辑时显示详细diff）
  on('diff_preview', (data: DiffPreviewData) => {
    screen.appendScroll(COLORS.file(`\n[DIFF] ${data.filePath}\n`));
    screen.appendScroll(data.diff + '\n');
    screen.restoreCursor();
  });

  on('error_suggestion', (data: ErrorSuggestionData) => {
    screen.appendScroll(COLORS.warning(`\n[HINT] ${data.suggestion}\n`));
  });

  on('empty_response_warning', (data: { iteration: number; message: string }) => {
    screen.appendScroll(COLORS.warning(`\n[WARN] Empty response at iteration ${data.iteration}. Retrying...\n`));
  });

  on('retry_attempt', (data: RetryAttemptData) => {
    screen.appendScroll(COLORS.muted(`\n[RETRY] ${data.operation} attempt ${data.attempt}/${data.maxRetries} in ${Math.floor(data.delay/1000)}s...\n`));
    screen.appendScroll(COLORS.muted(`  Error: ${data.error}\n`));
    screen.restoreCursor();
  });

  on('workspace_changed', (data: WorkspaceChangedData) => {
    screen.appendScroll(COLORS.file(`\n[DIR] Workspace: ${data.path}\n`));
  });

  // 工具执行完成后刷新状态栏（更新工作区等）
  on('tool_result', () => {
    if (model) {
      screen.setStatus(buildStatusText(agent, model));
    }
  });

  on('sub_agent_start', (data: SubAgentStartData) => {
    screen.appendScroll(COLORS.subAgent(`\n  [${data.type || 'sub'}] ${data.description}\n`));
  });

  on('sub_agent_tool_call', (data: SubAgentToolCallData) => {
    screen.appendScroll(COLORS.subAgent(`    -> [sub] ${data.name}\n`));
  });

  on('sub_agent_tool_result', (data: SubAgentToolResultData) => {
    const icon = data.success ? COLORS.success('[OK]') : COLORS.error('[ERR]');
    screen.appendScroll(COLORS.subAgent(`    ${icon} [sub] ${data.name}\n`));
  });

  on('sub_agent_done', (data: SubAgentDoneData) => {
    screen.appendScroll(COLORS.success(`\n  [OK] [sub] Done: ${data.summary}\n`));
  });

  on('sub_agent_error', (data: SubAgentErrorData) => {
    screen.appendScroll(COLORS.error(`\n  [ERR] [sub] Error: ${data.error}\n`));
  });

  on('hook_blocked', (data: HookBlockedData) => {
    screen.appendScroll(COLORS.error(`\n[BLOCKED] ${data.tool} - ${data.reason}\n`));
  });

  on('queue_injected', (data: QueueInjectedData) => {
    screen.appendScroll(COLORS.primary(`\n[QUEUE] Injected: ${data.input}...\n`));
  });

  on('hook_warning', (data: HookWarningData) => {
    screen.appendScroll(COLORS.warning(`\n[WARN] ${data.message}\n`));
  });

  on('hook_log', (data: HookLogData) => {
    screen.appendScroll(COLORS.muted(`\n[LOG] ${data.message}\n`));
  });

  on('pending_input_detected', (data: PendingInputDetectedData) => {
    screen.appendScroll(COLORS.warning(`\n[NEW INPUT] Detected during tool execution\n`));
    screen.appendScroll(COLORS.muted(`  ${data.input}\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  on('tool_stuck_warning', (data: ToolStuckWarningData) => {
    const elapsedSec = (data.elapsedMs ?? data.timeout) / 1000;
    screen.appendScroll(COLORS.warning(`\n[STUCK] ${data.tool}: stalled ${elapsedSec}s. Auto-aborting and retrying with alternative strategy...\n`));
  });

  on('tool_aborted', (data: ToolAbortedData) => {
    screen.appendScroll(COLORS.warning(`\n[ABORT] ${data.tool} 已中断\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  on('tool_conflict_warning', (data: { conflicts: Array<{ path: string; tools: string[] }>; message: string }) => {
    screen.appendScroll(COLORS.warning(`\n[CONFLICT] ${data.message}\n`));
    for (const conflict of data.conflicts) {
      screen.appendScroll(COLORS.muted(`  ${conflict.path}: ${conflict.tools.join(', ')} (sequential)\n`));
    }
  });

  // 上下文警告（添加遗漏的处理）
  on('context_warning', (data: { level: string; usage: number; message: string; suggestion?: string }) => {
    const color = data.level === 'warning' ? COLORS.warning : COLORS.muted;
    screen.appendScroll(color(`\n[CONTEXT] ${data.message}\n`));
    if (data.suggestion) {
      screen.appendScroll(COLORS.muted(`  Suggestion: ${data.suggestion}\n`));
    }
  });

  // Checkpoint 创建（添加遗漏的处理）
  on('checkpoint_created', (data: { hash: string; message: string }) => {
    screen.appendScroll(COLORS.muted(`\n[CHECKPOINT] ${data.message} (${data.hash.slice(0, 7)})\n`));
  });

  on('agent_interrupted', (data: AgentInterruptedData) => {
    // 重置流式状态
    state.setStreamingOutput(false);
    screen.setStreaming(false);

    screen.appendScroll(COLORS.warning(`\n[INTERRUPTED] Agent stopped. Press Enter to continue.\n`));
    if (data.toolResults && data.toolResults.length > 0) {
      screen.appendScroll(COLORS.muted(`  Interrupted tools: ${data.toolResults.map(t => t.name).join(', ')}\n`));
    }
    screen.restoreCursor();
    screen.refreshInput();
  });

  on('agent_stopped_on_error', (data: AgentStoppedOnErrorData) => {
    screen.appendScroll(COLORS.error(`\n[STOPPED] Agent stopped due to critical error.\n`));
    screen.appendScroll(COLORS.muted(`  Error: ${data.error || 'Unknown'}\n`));
    screen.appendScroll(COLORS.muted(`  Tool: ${data.tool || 'Unknown'}\n`));
    screen.appendScroll(COLORS.warning(`  Suggestion: ${data.suggestion || 'Check the error and retry.'}\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  // Agent blocked - needs user guidance
  on('agent_blocked', (data: {
    status: string;
    task: string;
    attempted: string[];
    failed: string[];
    error: string;
    suggestions: string[];
    timestamp: string;
  }) => {
    screen.appendScroll(COLORS.error(`\n[BLOCKED] Agent needs your help.\n`));
    screen.appendScroll(COLORS.muted(`  Task: ${data.task.slice(0, 100)}\n`));
    screen.appendScroll(COLORS.muted(`  Attempted: ${data.attempted.join(', ')}\n`));
    screen.appendScroll(COLORS.muted(`  Failed: ${data.failed.slice(0, 3).join(', ')}\n`));
    screen.appendScroll(COLORS.warning(`  Error: ${data.error}\n`));
    screen.appendScroll(COLORS.primary(`  Suggestions:\n`));
    data.suggestions.forEach(s => {
      screen.appendScroll(COLORS.primary(`    - ${s}\n`));
    });
    screen.appendScroll(COLORS.muted(`\nPlease provide guidance or break down the task.\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  // Todo progress display
  on('todos_set', (todos: TodoUpdateData['todos']) => {
    if (todos.length > 0) {
      displayTodoProgress(todos);
    }
  });

  on('todo_update', (data: TodoUpdateData) => {
    if (data.todos && data.todos.length > 0) {
      displayTodoProgress(data.todos);
    }
  });

  function displayTodoProgress(todos: TodoUpdateData['todos']) {
    const statusIcons: Record<string, string> = {
      'completed': '✔',
      'in_progress': '◼',
      'pending': '◻',
    };

    const lines: string[] = [];
    todos.forEach((todo, _i) => {
      const icon = statusIcons[todo.status] || '◻';
      const colorFn = todo.status === 'completed'
        ? COLORS.success
        : todo.status === 'in_progress'
          ? COLORS.primary
          : COLORS.muted;
      lines.push(colorFn(`  ${icon} ${todo.content}`));
    });

    screen.appendScroll(COLORS.secondary('\n[TASKS]\n'));
    lines.forEach(line => screen.appendScroll(line + '\n'));
    screen.restoreCursor();
    screen.refreshInput();
  }

  on('context_compressed', (data: ContextCompressedData) => {
    const formatTokens = (t: number) => t >= 1000 ? `${Math.floor(t/1000)}k` : `${t}`;
    const tokensInfo = data.tokensBefore && data.tokensAfter
      ? ` (${formatTokens(data.tokensBefore)} -> ${formatTokens(data.tokensAfter)} tokens)`
      : '';
    screen.appendScroll(COLORS.secondary(`\n[COMPRESS] ${data.message || `${data.before} -> ${data.after} messages`}${tokensInfo}\n`));
    screen.restoreCursor();
  });

  // 返回 cleanup 函数：移除所有注册的监听器
  return () => {
    for (const { event, handler } of listeners) {
      agent.off(event, handler);
    }
    listeners.length = 0;
  };
}

// 格式化运行统计（耗时 + token 用量）
export function formatRunStats(
  elapsedMs: number,
  agent: SpicaAgent,
  tokenCounter: TokenCounter
): string {
  const messages = agent.getMessages();
  const usedTokens = tokenCounter.estimateMessages(messages);
  const contextWindow = tokenCounter.getContextWindow();

  // 估算本次响应的 output tokens（最后一条 assistant 消息）
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const outputTokens = lastAssistant ? tokenCounter.estimateMessage(lastAssistant) : 0;
  const inputTokens = Math.max(0, usedTokens - outputTokens);

  // 估算本次 tool 调用数
  const toolCallCount = messages.filter(m => m.role === 'tool').length;

  // 格式化耗时
  const elapsed = elapsedMs < 1000
    ? `${elapsedMs}ms`
    : `${(elapsedMs / 1000).toFixed(1)}s`;

  // 格式化 token 数
  const fmt = (t: number) => t >= 1000 ? `${(t / 1000).toFixed(1)}k` : String(t);

  return `${elapsed} | ${fmt(inputTokens)} in | ${fmt(outputTokens)} out | ${toolCallCount} tools | ${fmt(usedTokens)}/${fmt(contextWindow)} ctx`;
}