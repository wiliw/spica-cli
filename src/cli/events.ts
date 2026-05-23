import { SpicaAgent } from '../agent';
import { getScreenManager } from './ui/screenManager';
import { LAIN_COLORS, format } from './ui/colors';
import prompts from 'prompts';
import { getRuntimeState } from '../core/RuntimeState';
import { startHeartbeat, stopHeartbeat, createHeartbeat } from '../core/Heartbeat';

const screen = getScreenManager();
const state = getRuntimeState();

function formatArgs(args: Record<string, any>): string {
  if (!args || Object.keys(args).length === 0) return '';
  const keys = Object.keys(args).slice(0, 3);
  const parts = keys.map(k => {
    const v = args[k];
    if (typeof v === 'string') {
      if (k === 'path' || k === 'source' || k === 'destination') {
        return `${k}=${v.split('/').pop() || v}`;
      }
      return `${k}=${v.slice(0, 30)}${v.length > 30 ? '...' : ''}`;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      return `${k}=${v}`;
    }
    return k;
  });
  return `(${parts.join(', ')})`;
}

export function setupAgentEvents(
  agent: SpicaAgent,
  interactive: boolean = false,
  model?: string
): void {
  let lastWasReasoning = false;

  // 创建心跳实例（用于等待 LLM 响应期间）
  createHeartbeat((msg) => screen.appendScroll(LAIN_COLORS.muted(msg)), { interval: 3000, message: '.' });

  agent.on('connection_error', (data: any) => {
    state.setConnectionErrorShown(true);
    screen.appendScroll(LAIN_COLORS.error(`\n[ERR] ${data.type}: ${data.hint}\n`));
  });

  // 每次等待 LLM 响应时启动心跳
  agent.on('waiting_for_llm', () => {
    startHeartbeat();
  });

  agent.on('stream', (data: any) => {
    // 收到流式响应，停止心跳
    stopHeartbeat();

    // 设置流式状态（防止输入刷新干扰输出）
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      screen.setStreaming(true);
    }
    if (lastWasReasoning) {
      screen.appendScroll('\n');
      lastWasReasoning = false;
    }
    screen.appendScroll(LAIN_COLORS.primary(data.chunk));
  });

  agent.on('reasoning', (data: any) => {
    // 收到推理内容，停止心跳
    stopHeartbeat();

    // 设置流式状态
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      screen.setStreaming(true);
    }
    screen.appendScroll(LAIN_COLORS.reasoning(data.content));
    lastWasReasoning = true;
  });

  agent.on('tool_call', (data: any) => {
    // 工具调用开始，停止之前的LLM心跳，启动工具执行心跳
    stopHeartbeat();
    state.setStreamingOutput(false);
    screen.setStreaming(false);
    if (lastWasReasoning) {
      screen.appendScroll('\n');
      lastWasReasoning = false;
    }
    const argsStr = formatArgs(data.arguments);
    screen.appendScroll(LAIN_COLORS.tool(`\n-> ${data.name}${argsStr ? ` ${argsStr}` : ''}\n`));
    
    // 启动工具执行心跳（显示工具正在执行）
    startHeartbeat();
  });

  agent.on('tool_result', (data: any) => {
    // 工具执行完成，停止心跳
    stopHeartbeat();
    state.setStreamingOutput(false);
    screen.setStreaming(false);
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    const output = data.output || data.error || '';

    // 显示语法错误（如果有）
    if (data.syntaxErrors && data.syntaxErrors.length > 0) {
      screen.appendScroll(LAIN_COLORS.error(`\n⚠️ Syntax errors detected:\n`));
      data.syntaxErrors.slice(0, 5).forEach((err: string) => {
        screen.appendScroll(LAIN_COLORS.error(`  ❌ ${err}\n`));
      });
      if (data.syntaxErrors.length > 5) {
        screen.appendScroll(LAIN_COLORS.error(`  ... and ${data.syntaxErrors.length - 5} more errors\n`));
      }
    }

    if (data.diff) {
      screen.appendScroll(`${icon} ${data.name}\n${data.diff}\n`);
    } else if (output) {
      const firstLine = output.split('\n')[0].slice(0, 80);
      screen.appendScroll(`${icon} ${data.name}: ${firstLine}${firstLine.length >= 80 ? '...' : ''}\n`);
    } else {
      screen.appendScroll(`${icon} ${data.name}\n`);
    }
    // 输出完成，恢复光标到输入框并刷新显示（显示累积的用户输入）
    screen.restoreCursor();
    screen.refreshInput();
  });

  // Diff预览（文件编辑时显示详细diff）
  agent.on('diff_preview', (data: any) => {
    screen.appendScroll(LAIN_COLORS.file(`\n[DIFF] ${data.filePath}\n`));
    screen.appendScroll(data.diff + '\n');
    screen.restoreCursor();
  });

  agent.on('permission_request', async (data: any) => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      state.setPermissionDialogActive(true);
    }

    let approved = false;
    try {
      screen.appendScroll(format.permissionBox(data.reason));
      const answer = await prompts({
        type: 'confirm',
        name: 'approve',
        message: LAIN_COLORS.primary.bold('Do you want to allow this action?'),
        initial: false,
      });
      screen.appendScroll(LAIN_COLORS.permissionBorder('═'.repeat(50)) + '\n');
      approved = answer.approve;
    } catch (e) {
      approved = false;
    } finally {
      state.setPermissionDialogActive(false);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
    }

    if (approved) {
      agent.approvePermission();
    } else {
      agent.denyPermission();
    }
  });

  agent.on('error_suggestion', (data: any) => {
    stopHeartbeat();  // LLM错误时停止心跳（防止超时提示）
    screen.appendScroll(LAIN_COLORS.warning(`\n[HINT] ${data.suggestion}\n`));
  });

  agent.on('retry_attempt', (data: any) => {
    screen.appendScroll(LAIN_COLORS.muted(`\n[RETRY] ${data.operation} attempt ${data.attempt}/${data.maxRetries} in ${Math.floor(data.delay/1000)}s...\n`));
    screen.appendScroll(LAIN_COLORS.muted(`  Error: ${data.error.slice(0, 50)}\n`));
    screen.restoreCursor();
  });

  agent.on('workspace_changed', (data: any) => {
    screen.appendScroll(LAIN_COLORS.file(`\n[DIR] Workspace: ${data.path}\n`));
  });

  agent.on('bypass_changed', (data: any) => {
    state.setBypassMode(data.enabled);
    screen.appendScroll(data.enabled
      ? LAIN_COLORS.bypass('\n[WARN] Bypass mode activated\n')
      : LAIN_COLORS.success('\n[OK] Strict mode activated\n'));
    if (model) {
      const mode = data.enabled ? 'bypass' : 'strict';
      screen.setStatus(`${model} | ${mode} | /h help | ESC ESC interrupt`);
    }
  });

  agent.on('permission_bypassed', (data: any) => {
    screen.appendScroll(LAIN_COLORS.bypassAuto(`\n[AUTO] Approved: ${data.reason}\n`));
  });

  agent.on('sub_agent_start', (data: any) => {
    screen.appendScroll(LAIN_COLORS.subAgent(`\n  [${data.type || 'sub'}] ${data.description}\n`));
  });

  agent.on('sub_agent_tool_call', (data: any) => {
    screen.appendScroll(LAIN_COLORS.subAgent(`    -> [sub] ${data.name}\n`));
  });

  agent.on('sub_agent_tool_result', (data: any) => {
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    screen.appendScroll(LAIN_COLORS.subAgent(`    ${icon} [sub] ${data.name}\n`));
  });

  agent.on('sub_agent_done', (data: any) => {
    screen.appendScroll(LAIN_COLORS.success(`\n  [OK] [sub] Done: ${data.summary.slice(0, 50)}\n`));
  });

  agent.on('sub_agent_error', (data: any) => {
    screen.appendScroll(LAIN_COLORS.error(`\n  [ERR] [sub] Error: ${data.error}\n`));
  });

  agent.on('hook_blocked', (data: any) => {
    screen.appendScroll(LAIN_COLORS.error(`\n[BLOCKED] ${data.tool} - ${data.reason}\n`));
  });

  agent.on('hook_warning', (data: any) => {
    screen.appendScroll(LAIN_COLORS.warning(`\n[WARN] ${data.message}\n`));
  });

  agent.on('hook_log', (data: any) => {
    screen.appendScroll(LAIN_COLORS.muted(`\n[LOG] ${data.message}\n`));
  });

  agent.on('tool_stuck_warning', (data: any) => {
    screen.appendScroll(LAIN_COLORS.warning(`\n[STUCK] ${data.tool}: ${data.message}\n`));
    screen.appendScroll(LAIN_COLORS.muted(`  自动中断中... Agent 将尝试其他方案\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  agent.on('tool_aborted', (data: any) => {
    screen.appendScroll(LAIN_COLORS.warning(`\n[ABORT] ${data.tool} 已中断\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  agent.on('agent_interrupted', (data: any) => {
    screen.appendScroll(LAIN_COLORS.warning(`\n[INTERRUPTED] Agent stopped. Press Enter to continue.\n`));
    if (data.toolResults && data.toolResults.length > 0) {
      screen.appendScroll(LAIN_COLORS.muted(`  Interrupted tools: ${data.toolResults.map(t => t.name).join(', ')}\n`));
    }
    screen.restoreCursor();
    screen.refreshInput();
  });

  agent.on('agent_stopped_on_error', (data: any) => {
    screen.appendScroll(LAIN_COLORS.error(`\n[STOPPED] Agent stopped due to critical error.\n`));
    screen.appendScroll(LAIN_COLORS.muted(`  Error: ${data.error?.slice(0, 100) || 'Unknown'}\n`));
    screen.appendScroll(LAIN_COLORS.muted(`  Tool: ${data.tool || 'Unknown'}\n`));
    screen.appendScroll(LAIN_COLORS.warning(`  Suggestion: ${data.suggestion || 'Check the error and retry.'}\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  // Todo progress display
  agent.on('todos_set', (todos: any[]) => {
    if (todos.length > 0) {
      displayTodoProgress(todos);
    }
  });

  agent.on('todo_update', (data: any) => {
    if (data.todos && data.todos.length > 0) {
      displayTodoProgress(data.todos);
    }
  });

  function displayTodoProgress(todos: any[]) {
    const statusIcons: Record<string, string> = {
      'completed': '✔',
      'in_progress': '◼',
      'pending': '◻',
    };

    const lines: string[] = [];
    todos.forEach((todo, i) => {
      const icon = statusIcons[todo.status] || '◻';
      const colorFn = todo.status === 'completed'
        ? LAIN_COLORS.success
        : todo.status === 'in_progress'
          ? LAIN_COLORS.primary
          : LAIN_COLORS.muted;
      lines.push(colorFn(`  ${icon} ${todo.content}`));
    });

    screen.appendScroll(LAIN_COLORS.secondary('\n[TASKS]\n'));
    lines.forEach(line => screen.appendScroll(line + '\n'));
    screen.restoreCursor();
    screen.refreshInput();
  }

  agent.on('context_compressed', (data: any) => {
    const formatTokens = (t: number) => t >= 1000 ? `${Math.floor(t/1000)}k` : `${t}`;
    const tokensInfo = data.tokensBefore && data.tokensAfter
      ? ` (${formatTokens(data.tokensBefore)} -> ${formatTokens(data.tokensAfter)} tokens)`
      : '';
    screen.appendScroll(LAIN_COLORS.secondary(`\n[COMPRESS] ${data.message || `${data.before} -> ${data.after} messages`}${tokensInfo}\n`));
    screen.restoreCursor();
  });
}