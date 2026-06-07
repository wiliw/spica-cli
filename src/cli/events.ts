import { SpicaAgent } from '../agent';
import { getScreenManager } from './ui/screenManager';
import { COLORS } from './ui/colors';
import { TokenCounter } from '../llm/TokenCounter';
import { getRuntimeState } from '../core/RuntimeState';
import * as os from 'os';

// 事件数据类型定义
interface ConnectionErrorData {
  type: string;
  hint: string;
  error?: string;
}

interface StreamData {
  chunk: string;
}

interface ReasoningData {
  content: string;
}

interface ToolCallData {
  name: string;
  arguments: Record<string, unknown>;
  id?: string;  // 工具调用 ID（用于匹配结果）
}

interface ToolResultData {
  name: string;
  success: boolean;
  output?: string;
  error?: string;
  diff?: string;
  syntaxErrors?: string[];
  id?: string;  // 工具调用 ID（用于匹配）
}

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

interface MessageData {
  role: string;
  content: string;
}


const screen = getScreenManager();
const state = getRuntimeState();

// ============================================
// 工具调用追踪系统（解决并行调用结果匹配问题）
// ============================================

interface ToolCallRecord {
  seq: number;           // 序号（用于显示）
  name: string;          // 工具名称
  args: Record<string, unknown>;  // 参数
  startTime: number;     // 开始时间（用于计算耗时）
  id?: string;           // 工具调用 ID
  outputLines: string[]; // 输出缓冲（verbose 模式）
}

// 当前活跃的工具调用（按序号索引）
const activeToolCalls: Map<number, ToolCallRecord> = new Map();
// ID 到序号的映射（用于匹配结果）
const idToSeq: Map<string, number> = new Map();
// 下一个序号
let nextToolSeq = 1;
// 当前批次的工具调用数量（用于显示并行状态）
let batchToolCount = 0;

// 重置工具追踪状态（每次新对话开始时）
function resetToolTracking(): void {
  activeToolCalls.clear();
  idToSeq.clear();
  nextToolSeq = 1;
  batchToolCount = 0;
}

// 注册工具调用
function registerToolCall(data: ToolCallData): number {
  const seq = nextToolSeq++;
  const record: ToolCallRecord = {
    seq,
    name: data.name,
    args: data.arguments || {},
    startTime: Date.now(),
    id: data.id,
    outputLines: [],
  };
  activeToolCalls.set(seq, record);
  if (data.id) {
    idToSeq.set(data.id, seq);
  }
  batchToolCount++;
  return seq;
}

// 匹配工具结果（通过 ID 或名称）
function matchToolResult(data: ToolResultData): ToolCallRecord | null {
  // 优先通过 ID 匹配
  if (data.id && idToSeq.has(data.id)) {
    const seq = idToSeq.get(data.id)!;
    const record = activeToolCalls.get(seq);
    if (record) {
      idToSeq.delete(data.id);
      activeToolCalls.delete(seq);
      return record;
    }
  }
  
  // 备用：通过名称匹配最近的未完成调用
  // 注意：并行调用同名工具时可能匹配错误，但这是 fallback
  for (const [seq, record] of activeToolCalls) {
    if (record.name === data.name) {
      activeToolCalls.delete(seq);
      if (record.id) idToSeq.delete(record.id);
      return record;
    }
  }
  
  return null;
}

// 计算耗时
function calcElapsedMs(startTime: number): number {
  return Date.now() - startTime;
}

// ============================================
// 终端宽度自适应
// ============================================

function getTerminalWidth(): number {
  return screen.state.terminalWidth || process.stdout.columns || 80;
}

// 截断字符串到指定宽度（考虑中文字符宽度）
function truncateToWidth(str: string, maxWidth: number): string {
  const width = getStringDisplayWidth(str);
  if (width <= maxWidth) return str;
  
  // 从末尾截断
  let result = '';
  let currentWidth = 0;
  const graphemes = Array.from(str);
  
  for (const char of graphemes) {
    const charWidth = getCharDisplayWidth(char);
    if (currentWidth + charWidth > maxWidth - 3) {
      return result + '...';
    }
    result += char;
    currentWidth += charWidth;
  }
  return result;
}

function getCharDisplayWidth(char: string): number {
  if (char === '\n') return 0;
  if (char === '\t') return 2;
  const codePoint = char.codePointAt(0);
  if (!codePoint) return 1;
  // Emoji 和其他复杂 grapheme cluster 宽度为 2
  if (char.length > 1 || codePoint > 0xFFFF) return 2;
  // 全角字符宽度为 2
  if (isFullWidth(char)) return 2;
  return 1;
}

function getStringDisplayWidth(str: string): number {
  let width = 0;
  const graphemes = Array.from(str);
  for (const char of graphemes) {
    width += getCharDisplayWidth(char);
  }
  return width;
}

function isFullWidth(char: string): boolean {
  const codePoint = char.codePointAt(0) || 0;
  // CJK 统一汉字范围
  if (codePoint >= 0x4E00 && codePoint <= 0x9FFF) return true;
  // CJK 扩展 A
  if (codePoint >= 0x3400 && codePoint <= 0x4DBF) return true;
  // CJK 扩展 B-F
  if (codePoint >= 0x20000 && codePoint <= 0x2CEAF) return true;
  // 日文平假名、片假名
  if (codePoint >= 0x3040 && codePoint <= 0x30FF) return true;
  // 韩文
  if (codePoint >= 0xAC00 && codePoint <= 0xD7AF) return true;
  // 全角符号
  if (codePoint >= 0xFF00 && codePoint <= 0xFFEF) return true;
  return false;
}

// ============================================
// 格式化函数
// ============================================

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

// 格式化参数（简洁版）
function formatArgsCompact(args: Record<string, unknown>, maxWidth: number): string {
  if (!args || Object.keys(args).length === 0) return '';
  
  // 过滤掉内部参数
  const filteredKeys = Object.keys(args).filter(k => !k.startsWith('_'));
  if (filteredKeys.length === 0) return '';
  
  const parts = filteredKeys.slice(0, 3).map(k => {
    const v = args[k];
    if (typeof v === 'string') {
      // 路径只显示文件名
      if (k === 'path' || k === 'source' || k === 'destination') {
        const filename = v.split('/').pop() || v.split('\\').pop() || v;
        return filename.length > 20 ? filename.slice(0, 17) + '...' : filename;
      }
      // 其他字符串截断
      if (v.length > 15) return v.slice(0, 12) + '...';
      return v;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      return String(v);
    }
    return k;
  });
  
  const result = parts.join(' ');
  return truncateToWidth(result, maxWidth);
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

// 格式化工具结果摘要
function formatToolSummary(data: { name: string; success: boolean; output?: string; error?: string; content?: string }): string {
  if (!data.success) {
    const errorMsg = data.error ? data.error.slice(0, 40) : '';
    return errorMsg ? `err: ${errorMsg}` : 'failed';
  }

  const name = data.name;
  const output = data.output || '';

  switch (name) {
    case 'file_read': {
      const lines = output.split('\n').length;
      return `${lines} lines`;
    }
    case 'file_write':
    case 'file_edit':
    case 'file_multi_edit': {
      const added = countDiffLines(output, '+');
      const removed = countDiffLines(output, '-');
      if (added > 0 && removed > 0) {
        return `+${added}/-${removed}`;
      } else if (added > 0) {
        return `+${added}`;
      } else if (removed > 0) {
        return `-${removed}`;
      }
      return 'done';
    }
    case 'bash': {
      const bashLines = output.split('\n').filter(l => l.trim()).length;
      const timeMatch = output.match(/\((\d+\.?\d*)s\)/);
      const time = timeMatch ? timeMatch[1] : '';
      return time ? `${bashLines} lines, ${time}s` : `${bashLines} lines`;
    }
    case 'grep': {
      const matchCount = countMatches(output);
      return matchCount > 0 ? `${matchCount} matches` : '0 matches';
    }
    case 'glob': {
      const fileCount = countFiles(output);
      return fileCount > 0 ? `${fileCount} files` : '0 files';
    }
    case 'test': {
      const passed = countTestPassed(output);
      const failed = countTestFailed(output);
      if (failed > 0) {
        return `${passed}✓ ${failed}✗`;
      }
      return passed > 0 ? `${passed}✓` : 'done';
    }
    case 'lint': {
      const errors = countLintErrors(output);
      return errors > 0 ? `${errors} errors` : 'clean';
    }
    case 'git':
      return 'done';
    case 'monitor': {
      const taskId = data.content || '';
      return taskId ? taskId.slice(0, 15) : 'started';
    }
    case 'task_stop':
      return 'stopped';
    case 'skill':
      return 'loaded';
    case 'task': {
      const agentCount = countAgents(output);
      return agentCount > 0 ? `${agentCount} agents` : 'done';
    }
    default:
      return 'done';
  }
}

// 格式化耗时
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 1000)}s`;
}

// ============================================
// 新的工具显示格式
// ============================================

// 简洁的工具结果显示（统一格式）
function displayToolResult(record: ToolCallRecord, data: ToolResultData): void {
  const elapsed = formatElapsed(calcElapsedMs(record.startTime));
  const icon = data.success ? COLORS.success('✓') : COLORS.error('✗');
  const summary = formatToolSummary(data);

  if (state.isVerboseMode()) {
    // Verbose模式：详细显示
    screen.appendScroll(COLORS.tool(`\n${record.name}`));

    // 显示文件名（完整路径）
    const filePath = record.args.path as string;
    if (filePath) {
      screen.appendScroll(COLORS.file(` ${filePath}`));
    }

    // 显示命令（如果是bash）
    if (record.name === 'bash') {
      const cmd = record.args.command as string;
      if (cmd) {
        screen.appendScroll(COLORS.muted(`\n  cmd: ${cmd.slice(0, 200)}\n`));
      }
    }

    screen.appendScroll(COLORS.muted(` → `));
    screen.appendScroll(COLORS.primary(`${summary}`));
    screen.appendScroll(` ${icon}`);
    screen.appendScroll(COLORS.muted(` ${elapsed}\n`));

    // 显示完整输出（不限行数）
    const output = data.output || data.error || '';
    if (output) {
      screen.appendScroll(COLORS.muted(`\n  Output:\n`));
      const outputLines = output.split('\n').slice(0, 20);
      for (const line of outputLines) {
        screen.appendScroll(COLORS.muted(`  ${line}\n`));
      }
      if (output.split('\n').length > 20) {
        screen.appendScroll(COLORS.muted(`  ... (${output.split('\n').length - 20} more lines)\n`));
      }
    }

    // 显示diff（如果有）
    if (data.diff) {
      screen.appendScroll(COLORS.muted(`\n  Diff:\n`));
      const diffLines = data.diff.split('\n').slice(0, 15);
      for (const line of diffLines) {
        if (line.startsWith('+')) {
          screen.appendScroll(COLORS.diffAdd(`  ${line}\n`));
        } else if (line.startsWith('-')) {
          screen.appendScroll(COLORS.diffRemove(`  ${line}\n`));
        } else {
          screen.appendScroll(COLORS.muted(`  ${line}\n`));
        }
      }
    }
  } else {
    // Compact模式：简洁显示
    screen.appendScroll(COLORS.tool(`${record.name}`));

    // 显示文件名（只显示basename）
    const filePath = record.args.path as string;
    if (filePath) {
      const filename = filePath.split('/').pop() || filePath;
      screen.appendScroll(COLORS.file(` ${filename}`));
    }

    screen.appendScroll(COLORS.muted(` → `));
    screen.appendScroll(COLORS.primary(`${summary}`));
    screen.appendScroll(` ${icon}`);
    screen.appendScroll(COLORS.muted(` ${elapsed}\n`));
  }
}

// 获取工具的主要参数（用于显示）
function getMainArg(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case 'file_read':
    case 'file_write':
    case 'file_edit':
    case 'file_multi_edit':
      return (args.path as string)?.split('/').pop() || null;
    case 'bash':
      const cmd = (args.command as string) || '';
      return cmd.slice(0, 30) + (cmd.length > 30 ? '...' : '');
    case 'grep':
      return (args.pattern as string) || null;
    case 'glob':
      return (args.pattern as string) || null;
    default:
      return null;
  }
}

// ============================================
// Subagent 状态面板
// ============================================

interface SubAgentRecord {
  id: string;
  type: string;
  description: string;
  status: 'running' | 'done' | 'error';
  startTime: number;
  summary?: string;
  error?: string;
}

const activeSubAgents: Map<string, SubAgentRecord> = new Map();
let subAgentSeq = 0;

function displaySubAgentPanel(): void {
  const termWidth = getTerminalWidth();
  const agents = Array.from(activeSubAgents.values());
  
  if (agents.length === 0) return;
  
  // 面板标题
  const running = agents.filter(a => a.status === 'running').length;
  const done = agents.filter(a => a.status === 'done').length;
  const error = agents.filter(a => a.status === 'error').length;
  
  const title = `Subagents (${running} running, ${done} done, ${error} error)`;
  const boxWidth = Math.min(termWidth - 4, Math.max(getStringDisplayWidth(title) + 4, 40));
  
  screen.appendScroll(COLORS.secondary(`\n┌${'─'.repeat(boxWidth - 2)}┐\n`));
  screen.appendScroll(COLORS.secondary(`│ ${title}${' '.repeat(Math.max(0, boxWidth - 2 - getStringDisplayWidth(title)))}│\n`));
  
  // 每个 subagent 的状态
  for (const agent of agents.slice(0, 3)) { // 最多显示 3 个
    const elapsed = formatElapsed(Date.now() - agent.startTime);
    const statusIcon = agent.status === 'running' ? '⏳' : agent.status === 'done' ? '✓' : '✗';
    const statusColor = agent.status === 'running' ? COLORS.warning : agent.status === 'done' ? COLORS.success : COLORS.error;
    
    const line = `${statusIcon} [${agent.type}] ${truncateToWidth(agent.description, 20)} (${elapsed})`;
    screen.appendScroll(statusColor(`│ ${line}${' '.repeat(Math.max(0, boxWidth - 2 - getStringDisplayWidth(line)))}│\n`));
  }
  
  if (agents.length > 3) {
    screen.appendScroll(COLORS.muted(`│ ... (${agents.length - 3} more)${' '.repeat(Math.max(0, boxWidth - 15))}│\n`));
  }
  
  screen.appendScroll(COLORS.secondary(`└${'─'.repeat(boxWidth - 2)}┘\n`));
}

// ============================================
// 主事件处理
// ============================================

export function setupAgentEvents(
  agent: SpicaAgent,
  _interactive: boolean = false,
  model?: string,
  _tokenCounter?: TokenCounter
): () => void {
  // 收集所有注册的监听器，用于 cleanup
  type EventHandler = (...args: any[]) => void;
  const listeners: Array<{ event: string; handler: EventHandler }> = [];
  const on = (event: string, handler: EventHandler) => {
    agent.on(event, handler);
    listeners.push({ event, handler });
  };

  // 追踪 reasoning 状态
  let reasoningStarted = false;
  let justSwitchedFromReasoning = false;

  // 每次新对话开始时重置状态
  on('waiting_for_llm', () => {
    reasoningStarted = false;
    justSwitchedFromReasoning = false;
    resetToolTracking();
    activeSubAgents.clear();
    subAgentSeq = 0;
    // 清除thinking动画
    screen.clearThinkingAnimation();
  });

  on('connection_error', (data: ConnectionErrorData) => {
    state.setConnectionErrorShown(true);
    screen.appendScroll(COLORS.error(`\n[ERR] ${data.type}: ${data.hint}\n`));
    if (data.error) {
      screen.appendScroll(COLORS.muted(`Details: ${data.error}\n`));
    }
  });

  on('stream', (data: StreamData) => {
    // 从 reasoning 切换到 stream 时，清除thinking动画
    if (reasoningStarted && !justSwitchedFromReasoning) {
      justSwitchedFromReasoning = true;
      screen.clearThinkingAnimation();
      screen.appendScroll('\n');
    }

    // 设置流式状态
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      screen.setStreaming(true);
    }
    // AI流式输出使用行缓冲
    screen.appendStreamChunk(COLORS.primary(data.chunk));
  });

  on('reasoning', (data: ReasoningData) => {
    if (!reasoningStarted) {
      reasoningStarted = true;
      justSwitchedFromReasoning = false;
      // compact模式：启动thinking动画
      if (!state.isVerboseMode()) {
        screen.startThinkingAnimation();
      }
      if (!state.isStreamingOutput()) {
        state.setStreamingOutput(true);
        screen.setStreaming(true);
      }
    }

    // verbose 模式下显示完整 reasoning（使用行缓冲）
    if (state.isVerboseMode()) {
      screen.appendStreamChunk(COLORS.reasoning(data.content));
    }
  });

  // 工具调用开始
  on('tool_call', (data: ToolCallData) => {
    state.setStreamingOutput(false);
    screen.setStreaming(false);

    if (reasoningStarted) {
      screen.appendScroll('\n');
      reasoningStarted = false;
      // 清除thinking动画
      screen.clearThinkingAnimation();
    }

    // 注册工具调用
    const seq = registerToolCall(data);

    // 显示并行状态（如果有多个工具同时调用）
    if (batchToolCount > 1 && seq === 1) {
      screen.appendScroll(COLORS.muted(`\n[tools] ${batchToolCount} parallel calls...\n`));
    }

    // 简洁显示：只显示工具名（不显示序号）
    screen.appendScroll(COLORS.tool(`\n${data.name}`));
    screen.flushOutput();
  });

  // 工具调用结果
  on('tool_result', (data: ToolResultData) => {
    state.setStreamingOutput(false);
    screen.setStreaming(false);

    // 匹配工具调用
    const record = matchToolResult(data);

    if (record) {
      // 显示简洁的结果行（不显示序号）
      displayToolResult(record, data);
    } else {
      // 未找到匹配，显示简单格式
      const icon = data.success ? COLORS.success('✓') : COLORS.error('✗');
      const summary = formatToolSummary(data);
      screen.appendScroll(`${icon} ${data.name} → ${summary}\n`);
    }
    // 强制刷新
    screen.flushOutput();

    // 更新状态栏
    if (model) {
      screen.setStatus(buildStatusText(agent, model));
    }

    screen.restoreCursor();
    screen.refreshInput();
  });

  // Diff 预览
  on('diff_preview', (data: DiffPreviewData) => {
    screen.appendScroll(COLORS.file(`\n[diff] ${data.filePath}\n`));
    const lines = data.diff.split('\n').slice(0, 10);
    for (const line of lines) {
      if (line.startsWith('+')) {
        screen.appendScroll(COLORS.diffAdd(`  ${line}\n`));
      } else if (line.startsWith('-')) {
        screen.appendScroll(COLORS.diffRemove(`  ${line}\n`));
      } else {
        screen.appendScroll(COLORS.muted(`  ${line}\n`));
      }
    }
    screen.restoreCursor();
  });

  on('error_suggestion', (data: ErrorSuggestionData) => {
    screen.appendScroll(COLORS.warning(`\n[hint] ${data.suggestion}\n`));
  });

  on('empty_response_warning', (data: { iteration: number; message: string }) => {
    screen.appendScroll(COLORS.warning(`\n[warn] Empty response, retrying...\n`));
  });

  on('retry_attempt', (data: RetryAttemptData) => {
    screen.appendScroll(COLORS.muted(`\n[retry] ${data.operation} #${data.attempt}/${data.maxRetries} in ${Math.floor(data.delay/1000)}s\n`));
    screen.restoreCursor();
  });

  on('workspace_changed', (data: WorkspaceChangedData) => {
    screen.appendScroll(COLORS.file(`\n[dir] ${data.path}\n`));
  });

  // Subagent 事件
  on('sub_agent_start', (data: SubAgentStartData) => {
    subAgentSeq++;
    activeSubAgents.set(data.id, {
      id: data.id,
      type: data.type || 'sub',
      description: truncateToWidth(data.description || data.prompt.slice(0, 50), 30),
      status: 'running',
      startTime: Date.now(),
    });
    
    // 显示状态面板
    displaySubAgentPanel();
  });

  on('sub_agent_tool_call', (data: SubAgentToolCallData) => {
    // Subagent 内部的工具调用（缩进显示）
    screen.appendScroll(COLORS.subAgent(`    → ${data.name}\n`));
  });

  on('sub_agent_tool_result', (data: SubAgentToolResultData) => {
    const icon = data.success ? '✓' : '✗';
    const colorFn = data.success ? COLORS.success : COLORS.error;
    screen.appendScroll(colorFn(`    ${icon} ${data.name}\n`));
  });

  on('sub_agent_done', (data: SubAgentDoneData) => {
    const record = activeSubAgents.get(data.id);
    if (record) {
      record.status = 'done';
      record.summary = truncateToWidth(data.summary || 'done', 30);
    }
    
    // 更新状态面板
    displaySubAgentPanel();
  });

  on('sub_agent_error', (data: SubAgentErrorData) => {
    const record = activeSubAgents.get(data.id);
    if (record) {
      record.status = 'error';
      record.error = truncateToWidth(data.error, 30);
    }
    
    // 更新状态面板
    displaySubAgentPanel();
  });

  on('hook_blocked', (data: HookBlockedData) => {
    screen.appendScroll(COLORS.error(`\n[block] ${data.tool}: ${data.reason}\n`));
  });

  on('queue_injected', (data: QueueInjectedData) => {
    screen.appendScroll(COLORS.primary(`\n[queue] ${data.input}...\n`));
  });

  on('hook_warning', (data: HookWarningData) => {
    screen.appendScroll(COLORS.warning(`\n[warn] ${data.message}\n`));
  });

  on('hook_log', (data: HookLogData) => {
    screen.appendScroll(COLORS.muted(`\n[log] ${data.message}\n`));
  });

  on('pending_input_detected', (data: PendingInputDetectedData) => {
    screen.appendScroll(COLORS.warning(`\n[input] ${data.input?.slice(0, 30)}...\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  on('tool_stuck_warning', (data: ToolStuckWarningData) => {
    const elapsedSec = (data.elapsedMs ?? data.timeout) / 1000;
    screen.appendScroll(COLORS.warning(`\n[stuck] ${data.tool} ${elapsedSec}s, aborting...\n`));
  });

  on('tool_aborted', (data: ToolAbortedData) => {
    screen.appendScroll(COLORS.warning(`\n[abort] ${data.tool}\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  on('tool_conflict_warning', (data: { conflicts: Array<{ path: string; tools: string[] }>; message: string }) => {
    screen.appendScroll(COLORS.warning(`\n[conflict] ${data.message}\n`));
    for (const conflict of data.conflicts) {
      screen.appendScroll(COLORS.muted(`  ${conflict.path}: ${conflict.tools.join(', ')}\n`));
    }
  });

  on('context_warning', (data: ContextWarningData) => {
    const color = data.level === 'warning' ? COLORS.warning : COLORS.muted;
    screen.appendScroll(color(`\n[ctx] ${data.message}\n`));
    if (data.suggestion) {
      screen.appendScroll(COLORS.muted(`  → ${data.suggestion}\n`));
    }
  });

  on('checkpoint_created', (data: { hash: string; message: string }) => {
    screen.appendScroll(COLORS.muted(`\n[ckpt] ${data.message.slice(0, 30)}\n`));
  });

  on('agent_interrupted', (data: AgentInterruptedData) => {
    state.setStreamingOutput(false);
    screen.setStreaming(false);
    
    screen.appendScroll(COLORS.warning(`\n[interrupt] stopped\n`));
    if (data.toolResults && data.toolResults.length > 0) {
      screen.appendScroll(COLORS.muted(`  tools: ${data.toolResults.map(t => t.name).join(', ')}\n`));
    }
    screen.restoreCursor();
    screen.refreshInput();
  });

  on('agent_stopped_on_error', (data: AgentStoppedOnErrorData) => {
    screen.appendScroll(COLORS.error(`\n[stop] ${data.tool}: ${data.error?.slice(0, 50)}\n`));
    screen.appendScroll(COLORS.warning(`  → ${data.suggestion}\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  on('agent_blocked', (data: {
    status: string;
    task: string;
    attempted: string[];
    failed: string[];
    error: string;
    suggestions: string[];
    timestamp: string;
  }) => {
    screen.appendScroll(COLORS.error(`\n[block] need help\n`));
    screen.appendScroll(COLORS.muted(`  task: ${data.task.slice(0, 50)}\n`));
    screen.appendScroll(COLORS.warning(`  error: ${data.error.slice(0, 50)}\n`));
    data.suggestions.slice(0, 2).forEach(s => {
      screen.appendScroll(COLORS.primary(`  → ${s.slice(0, 50)}\n`));
    });
    screen.restoreCursor();
    screen.refreshInput();
  });

  // Todo progress
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

    screen.appendScroll(COLORS.secondary('\n[tasks]\n'));
    todos.forEach((todo) => {
      const icon = statusIcons[todo.status] || '◻';
      const colorFn = todo.status === 'completed'
        ? COLORS.success
        : todo.status === 'in_progress'
          ? COLORS.primary
          : COLORS.muted;
      // 不截断，完整显示todo内容
      screen.appendScroll(colorFn(`  ${icon} ${todo.content}\n`));
    });
    if (todos.length > 5) {
      screen.appendScroll(COLORS.muted(`  ... (${todos.length - 5} more)\n`));
    }
    screen.restoreCursor();
    screen.refreshInput();
  }

  on('context_compressed', (data: ContextCompressedData) => {
    const formatTokens = (t: number) => t >= 1000 ? `${Math.floor(t/1000)}k` : `${t}`;
    const tokensInfo = data.tokensBefore && data.tokensAfter
      ? ` (${formatTokens(data.tokensBefore)}→${formatTokens(data.tokensAfter)})`
      : '';
    screen.appendScroll(COLORS.secondary(`\n[compress] ${data.before}→${data.after}${tokensInfo}\n`));
    screen.restoreCursor();
  });

  // 返回 cleanup 函数
  return () => {
    for (const { event, handler } of listeners) {
      agent.off(event, handler);
    }
    listeners.length = 0;
  };
}

// 格式化运行统计
export function formatRunStats(
  elapsedMs: number,
  agent: SpicaAgent,
  tokenCounter: TokenCounter
): string {
  const messages = agent.getMessages();
  const usedTokens = tokenCounter.estimateMessages(messages);
  const contextWindow = tokenCounter.getContextWindow();

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const outputTokens = lastAssistant ? tokenCounter.estimateMessage(lastAssistant) : 0;
  const inputTokens = Math.max(0, usedTokens - outputTokens);

  const toolCallCount = messages.filter(m => m.role === 'tool').length;

  const elapsed = elapsedMs < 1000
    ? `${elapsedMs}ms`
    : `${(elapsedMs / 1000).toFixed(1)}s`;

  const fmt = (t: number) => t >= 1000 ? `${(t / 1000).toFixed(1)}k` : String(t);

  return `${elapsed} | ${fmt(inputTokens)} in | ${fmt(outputTokens)} out | ${toolCallCount} tools | ${fmt(usedTokens)}/${fmt(contextWindow)} ctx`;
}