// Agent事件监听 - 与UI的桥梁

import { SpicaAgent } from '../agent';
import * as readline from 'readline';
import { LAIN_COLORS, format } from './ui/colors';
import prompts from 'prompts';
import { getRuntimeState } from '../core/RuntimeState';
import { ScreenManager } from './ui/screenManager';

// 格式化工具参数（简洁显示）
function formatArgs(args: Record<string, any>): string {
  if (!args || Object.keys(args).length === 0) return '';

  const keys = Object.keys(args).slice(0, 3);  // 只显示前3个参数
  const parts = keys.map(k => {
    const v = args[k];
    if (typeof v === 'string') {
      // 路径只显示文件名
      if (k === 'path' || k === 'source' || k === 'destination') {
        const shortPath = v.split('/').pop() || v;
        return `${k}=${shortPath}`;
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
  rl: readline.Interface | null,
  interactive: boolean = false,
  screenManager?: ScreenManager
): void {
  const state = getRuntimeState();
  let lastWasReasoning = false;

  // 输出辅助函数：使用ScreenManager或console.log
  const output = (text: string) => {
    if (screenManager) {
      screenManager.addContent(text);
    } else {
      console.log(text);
    }
  };

  const outputRaw = (text: string) => {
    if (screenManager) {
      screenManager.addContent(text);
    } else {
      process.stdout.write(text);
    }
  };

  // 连接错误事件（只显示一次简洁信息）
  agent.on('connection_error', (data: any) => {
    state.setConnectionErrorShown(true);
    output(LAIN_COLORS.error(`\n[ERR] ${data.type}: ${data.hint}`));
    output('');
  });

  // 恢复输入行的辅助函数
  const restoreInputLine = () => {
    if (rl) {
      process.stdout.write('\n> ' + (rl.line || ''));
    }
  };

  agent.on('stream', (data: any) => {
    // 开始输出时清除输入行（只做一次）
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      if (screenManager) {
        // ScreenManager handles this internally
      } else {
        const esc = '\x1b';
        process.stdout.write(esc + '[2K' + esc + '[1G');
      }
    }
    if (lastWasReasoning) {
      outputRaw('\n');
      lastWasReasoning = false;
    }
    // 直接输出流式内容
    outputRaw(LAIN_COLORS.primary(data.chunk));
  });

  agent.on('reasoning', (data: any) => {
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      if (screenManager) {
        // ScreenManager handles this internally
      } else {
        const esc = '\x1b';
        process.stdout.write(esc + '[2K' + esc + '[1G');
      }
    }
    process.stderr.write(LAIN_COLORS.reasoning(data.content));
    lastWasReasoning = true;
  });

  agent.on('tool_call', (data: any) => {
    // 强制结束stream状态
    state.setStreamingOutput(false);
    if (lastWasReasoning) {
      outputRaw('\n');
      lastWasReasoning = false;
    }
    // 显示工具调用
    const argsStr = formatArgs(data.arguments);
    output(LAIN_COLORS.tool(`\n-> ${data.name}${argsStr ? ` ${argsStr}` : ''}`));
  });

  agent.on('tool_result', (data: any) => {
    // 强制结束stream状态
    state.setStreamingOutput(false);
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    const outputText = data.output || data.error || '';

    // 显示结果（简洁）
    if (data.diff) {
      output(`${icon} ${data.name}`);
      output(data.diff);
    } else if (outputText) {
      const firstLine = outputText.split('\n')[0].slice(0, 80);
      output(`${icon} ${data.name}: ${firstLine}${outputText.split('\n')[0].length >= 80 ? '...' : ''}`);
    } else {
      output(`${icon} ${data.name}`);
    }
  });

  // diff_preview 不再单独处理，在 tool_result 中统一显示

  agent.on('permission_request', async (data: any) => {
    // 暂停 readline 和 raw mode，让 prompts 正常工作
    if (rl) {
      rl.pause();
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      // 清除当前输入行显示
      process.stdout.write('\x1b[2K\x1b[1G');
    }

    // Lain红色警示框
    output(format.permissionBox(data.reason));
    const answer = await prompts({
      type: 'confirm',
      name: 'approve',
      message: LAIN_COLORS.primary.bold('Do you want to allow this action?'),
      initial: false,
    });
    output(LAIN_COLORS.permissionBorder('═'.repeat(50)) + '\n');

    // 恢复 readline 和 raw mode
    if (rl) {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      rl.resume();
      // 清除 readline 输入缓冲区：使用 Ctrl+U 清除当前行
      rl.write(null, { ctrl: true, name: 'u' });
      // 清除 prompts 留下的残留输出，重绘空输入行
      if (screenManager) {
        screenManager.setInput('');
      } else {
        process.stdout.write('\x1b[2K\x1b[1G');
        process.stdout.write('> ');
      }
    }

    if (answer.approve) {
      agent.approvePermission();
    } else {
      agent.denyPermission();
    }
  });

  agent.on('error_suggestion', (data: any) => {
    output(LAIN_COLORS.warning(`[HINT] ${data.suggestion}`));
  });

  agent.on('workspace_changed', (data: any) => {
    output(LAIN_COLORS.file(`[DIR] Workspace: ${data.path}`));
  });

  // Bypass模式事件
  agent.on('bypass_changed', (data: any) => {
    state.setBypassMode(data.enabled);
    if (data.enabled) {
      output(LAIN_COLORS.bypass('[WARN] Bypass mode activated'));
    } else {
      output(LAIN_COLORS.success('[OK] Strict mode activated'));
    }
  });

  agent.on('permission_bypassed', (data: any) => {
    output(LAIN_COLORS.bypassAuto(`[AUTO] Approved: ${data.reason}`));
  });

  // 子agent事件
  agent.on('sub_agent_start', (data: any) => {
    output(LAIN_COLORS.subAgent(`  [${data.type || 'sub'}] ${data.description}`));
  });

  agent.on('sub_agent_tool_call', (data: any) => {
    output(LAIN_COLORS.subAgent(`    -> [sub] ${data.name}`));
  });

  agent.on('sub_agent_tool_result', (data: any) => {
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    output(LAIN_COLORS.subAgent(`    ${icon} [sub] ${data.name}`));
  });

  agent.on('sub_agent_done', (data: any) => {
    output(LAIN_COLORS.success(`  [OK] [sub] Done: ${data.summary.slice(0, 50)}`));
  });

  agent.on('sub_agent_error', (data: any) => {
    output(LAIN_COLORS.error(`  [ERR] [sub] Error: ${data.error}`));
  });

  // Hooks事件
  agent.on('hook_blocked', (data: any) => {
    output(LAIN_COLORS.error(`[BLOCKED] ${data.tool} - ${data.reason}`));
  });

  agent.on('hook_warning', (data: any) => {
    output(LAIN_COLORS.warning(`[WARN] ${data.message}`));
  });

  agent.on('hook_log', (data: any) => {
    output(LAIN_COLORS.muted(`[LOG] ${data.message}`));
  });

  // Context compression event
  agent.on('context_compressed', (data: any) => {
    output(LAIN_COLORS.secondary(`[COMPRESS] ${data.before} -> ${data.after} messages`));
  });
}