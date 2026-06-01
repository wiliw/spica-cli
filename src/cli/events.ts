import { SpicaAgent } from '../agent';
import { getScreenManager } from './ui/screenManager';
import { COLORS, format } from './ui/colors';
import prompts from 'prompts';
import { getRuntimeState } from '../core/RuntimeState';


const screen = getScreenManager();
const state = getRuntimeState();

function formatArgs(args: Record<string, any>): string {
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

export function setupAgentEvents(
  agent: SpicaAgent,
  interactive: boolean = false,
  model?: string
): void {
  // 追踪 reasoning 状态
  let reasoningStarted = false;
  let justSwitchedFromReasoning = false;  // 只在切换时换行一次

  agent.on('connection_error', (data: any) => {
    state.setConnectionErrorShown(true);
    screen.appendScroll(COLORS.error(`\n[ERR] ${data.type}: ${data.hint}\n`));
  });

  agent.on('stream', (data: any) => {

    // 从 reasoning 切换到 stream 时，只换行一次
    if (reasoningStarted && !justSwitchedFromReasoning) {
      justSwitchedFromReasoning = true;
      screen.appendScroll('\n');
    }

    // 设置流式状态（防止输入刷新干扰输出）
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      screen.setStreaming(true);
    }
    screen.appendScroll(COLORS.primary(data.chunk));
  });

  agent.on('reasoning', (data: any) => {
    // 只在第一次显示 thinking 提示
    if (!reasoningStarted) {
      reasoningStarted = true;
      justSwitchedFromReasoning = false;
      screen.appendScroll('\n');  // 心跳结束后换行
      if (!state.isVerboseMode()) {
        screen.appendScroll(COLORS.muted('[thinking]\n'));
      } else {
        screen.appendScroll(COLORS.reasoning('[REASONING]\n'));
        if (!state.isStreamingOutput()) {
          state.setStreamingOutput(true);
          screen.setStreaming(true);
        }
      }
    }

    // 详细模式下显示完整 reasoning content
    if (state.isVerboseMode()) {
      screen.appendScroll(COLORS.reasoning(data.content));
    }
  });

  agent.on('tool_call', (data: any) => {
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

  agent.on('tool_result', (data: any) => {
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
  agent.on('diff_preview', (data: any) => {
    screen.appendScroll(COLORS.file(`\n[DIFF] ${data.filePath}\n`));
    screen.appendScroll(data.diff + '\n');
    screen.restoreCursor();
  });

  agent.on('permission_request', async (data: any) => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      state.setPermissionDialogActive(true);
    }

    let approved = false;
    try {
      screen.appendScroll(format.permissionBox(data.reason));
      const answer = await prompts(
        {
          type: 'confirm',
          name: 'approve',
          message: COLORS.primary.bold('Do you want to allow this action?'),
          initial: false,
        },
        {
          onCancel: () => {
            approved = false;
            return true;
          }
        }
      );
      screen.appendScroll(COLORS.permissionBorder('═'.repeat(50)) + '\n');
      if (answer && typeof answer.approve === 'boolean') {
        approved = answer.approve;
      }
    } catch (e) {
      approved = false;
    } finally {
      state.setPermissionDialogActive(false);
      if (process.stdin.isTTY) {
        process.stdin.resume();
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
    screen.appendScroll(COLORS.warning(`\n[HINT] ${data.suggestion}\n`));
  });

  agent.on('retry_attempt', (data: any) => {
    screen.appendScroll(COLORS.muted(`\n[RETRY] ${data.operation} attempt ${data.attempt}/${data.maxRetries} in ${Math.floor(data.delay/1000)}s...\n`));
    screen.appendScroll(COLORS.muted(`  Error: ${data.error}\n`));
    screen.restoreCursor();
  });

  agent.on('workspace_changed', (data: any) => {
    screen.appendScroll(COLORS.file(`\n[DIR] Workspace: ${data.path}\n`));
  });

  agent.on('bypass_changed', (data: any) => {
    state.setBypassMode(data.enabled);
    screen.appendScroll(data.enabled
      ? COLORS.bypass('\n[WARN] Bypass mode activated\n')
      : COLORS.success('\n[OK] Strict mode activated\n'));
    if (model) {
      const mode = data.enabled ? 'bypass' : 'strict';
      screen.setStatus(`${model} | ${mode} | /h help | ESC ESC interrupt`);
    }
  });

  agent.on('permission_bypassed', (data: any) => {
    screen.appendScroll(COLORS.bypassAuto(`\n[AUTO] Approved: ${data.reason}\n`));
  });

  agent.on('sub_agent_start', (data: any) => {
    screen.appendScroll(COLORS.subAgent(`\n  [${data.type || 'sub'}] ${data.description}\n`));
  });

  agent.on('sub_agent_tool_call', (data: any) => {
    screen.appendScroll(COLORS.subAgent(`    -> [sub] ${data.name}\n`));
  });

  agent.on('sub_agent_tool_result', (data: any) => {
    const icon = data.success ? COLORS.success('[OK]') : COLORS.error('[ERR]');
    screen.appendScroll(COLORS.subAgent(`    ${icon} [sub] ${data.name}\n`));
  });

  agent.on('sub_agent_done', (data: any) => {
    screen.appendScroll(COLORS.success(`\n  [OK] [sub] Done: ${data.summary}\n`));
  });

  agent.on('sub_agent_error', (data: any) => {
    screen.appendScroll(COLORS.error(`\n  [ERR] [sub] Error: ${data.error}\n`));
  });

  agent.on('hook_blocked', (data: any) => {
    screen.appendScroll(COLORS.error(`\n[BLOCKED] ${data.tool} - ${data.reason}\n`));
  });

  agent.on('hook_warning', (data: any) => {
    screen.appendScroll(COLORS.warning(`\n[WARN] ${data.message}\n`));
  });

  agent.on('hook_log', (data: any) => {
    screen.appendScroll(COLORS.muted(`\n[LOG] ${data.message}\n`));
  });

  agent.on('pending_input_detected', (data: any) => {
    screen.appendScroll(COLORS.warning(`\n[NEW INPUT] Detected during tool execution\n`));
    screen.appendScroll(COLORS.muted(`  ${data.input}\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

agent.on('tool_stuck_warning', (data: any) => {
    screen.appendScroll(COLORS.warning(`\n[STUCK] ${data.tool}: stalled ${data.elapsedMs / 1000}s. Auto-aborting and retrying with alternative strategy...\n`));
  });

  agent.on('tool_aborted', (data: any) => {
    screen.appendScroll(COLORS.warning(`\n[ABORT] ${data.tool} 已中断\n`));
    screen.restoreCursor();
    screen.refreshInput();
  });

  agent.on('agent_interrupted', (data: any) => {
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

  agent.on('agent_stopped_on_error', (data: any) => {
    screen.appendScroll(COLORS.error(`\n[STOPPED] Agent stopped due to critical error.\n`));
    screen.appendScroll(COLORS.muted(`  Error: ${data.error || 'Unknown'}\n`));
    screen.appendScroll(COLORS.muted(`  Tool: ${data.tool || 'Unknown'}\n`));
    screen.appendScroll(COLORS.warning(`  Suggestion: ${data.suggestion || 'Check the error and retry.'}\n`));
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

  agent.on('context_compressed', (data: any) => {
    const formatTokens = (t: number) => t >= 1000 ? `${Math.floor(t/1000)}k` : `${t}`;
    const tokensInfo = data.tokensBefore && data.tokensAfter
      ? ` (${formatTokens(data.tokensBefore)} -> ${formatTokens(data.tokensAfter)} tokens)`
      : '';
    screen.appendScroll(COLORS.secondary(`\n[COMPRESS] ${data.message || `${data.before} -> ${data.after} messages`}${tokensInfo}\n`));
    screen.restoreCursor();
  });
}