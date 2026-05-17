// Agent事件监听 - 与UI的桥梁

import { SpicaAgent } from '../agent';
import { InputBox } from './ui/inputBox';
import { LAIN_COLORS, format } from './ui/colors';
import prompts from 'prompts';
import { getRuntimeState } from '../core/RuntimeState';

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
  inputBox: InputBox | null,
  interactive: boolean = false
): void {
  const state = getRuntimeState();
  let lastWasReasoning = false;

  // 连接错误事件（只显示一次简洁信息）
  agent.on('connection_error', (data: any) => {
    state.setConnectionErrorShown(true);
    inputBox?.print(LAIN_COLORS.error(`\n[ERR] ${data.type}: ${data.hint}\n`));
  });

  agent.on('stream', (data: any) => {
    // 流式输出开始时清除输入区
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      inputBox?.clearForOutput();
    }
    if (lastWasReasoning) {
      process.stdout.write('\n');
      lastWasReasoning = false;
    }
    process.stdout.write(LAIN_COLORS.primary(data.chunk));
  });

  agent.on('reasoning', (data: any) => {
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      inputBox?.clearForOutput();
    }
    process.stderr.write(LAIN_COLORS.reasoning(data.content));
    lastWasReasoning = true;
  });

  agent.on('tool_call', (data: any) => {
    state.setStreamingOutput(false);
    inputBox?.clearForOutput();
    if (lastWasReasoning) {
      process.stdout.write('\n');
      lastWasReasoning = false;
    }
    const argsStr = formatArgs(data.arguments);
    process.stdout.write(LAIN_COLORS.tool(`\n-> ${data.name}${argsStr ? ` ${argsStr}` : ''}\n`));
  });

  agent.on('tool_result', (data: any) => {
    state.setStreamingOutput(false);
    inputBox?.clearForOutput();
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    const output = data.output || data.error || '';

    if (data.diff) {
      process.stdout.write(`${icon} ${data.name}\n`);
      process.stdout.write(data.diff + '\n');
    } else if (output) {
      const firstLine = output.split('\n')[0].slice(0, 80);
      process.stdout.write(`${icon} ${data.name}: ${firstLine}${output.split('\n')[0].length >= 80 ? '...' : ''}\n`);
    } else {
      process.stdout.write(`${icon} ${data.name}\n`);
    }
    // 重绘输入框
    inputBox?.render();
  });

  agent.on('permission_request', async (data: any) => {
    // 暂停 raw mode，让 prompts 正常工作
    if (inputBox && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      state.setPermissionDialogActive(true);
      // 清除输入区
      inputBox.clearForOutput();
    }

    let approved = false;
    try {
      process.stdout.write(format.permissionBox(data.reason));
      const answer = await prompts({
        type: 'confirm',
        name: 'approve',
        message: LAIN_COLORS.primary.bold('Do you want to allow this action?'),
        initial: false,
      });
      console.log(LAIN_COLORS.permissionBorder('═'.repeat(50)) + '\n');
      approved = answer.approve;
    } catch (e) {
      // prompts 可能因为中断抛出异常，默认拒绝
      approved = false;
    } finally {
      // 确保总是恢复状态
      state.setPermissionDialogActive(false);
      if (inputBox && process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        inputBox.render();
      }
    }

    if (approved) {
      agent.approvePermission();
    } else {
      agent.denyPermission();
    }
  });

  agent.on('error_suggestion', (data: any) => {
    console.log(LAIN_COLORS.warning(`[HINT] ${data.suggestion}`));
  });

  agent.on('workspace_changed', (data: any) => {
    console.log(LAIN_COLORS.file(`[DIR] Workspace: ${data.path}`));
  });

  // Bypass模式事件
  agent.on('bypass_changed', (data: any) => {
    state.setBypassMode(data.enabled);
    if (data.enabled) {
      console.log(LAIN_COLORS.bypass('[WARN] Bypass mode activated'));
    } else {
      console.log(LAIN_COLORS.success('[OK] Strict mode activated'));
    }
  });

  agent.on('permission_bypassed', (data: any) => {
    console.log(LAIN_COLORS.bypassAuto(`[AUTO] Approved: ${data.reason}`));
  });

  // 子agent事件
  agent.on('sub_agent_start', (data: any) => {
    console.log(LAIN_COLORS.subAgent(`  [${data.type || 'sub'}] ${data.description}`));
  });

  agent.on('sub_agent_tool_call', (data: any) => {
    console.log(LAIN_COLORS.subAgent(`    -> [sub] ${data.name}`));
  });

  agent.on('sub_agent_tool_result', (data: any) => {
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    console.log(LAIN_COLORS.subAgent(`    ${icon} [sub] ${data.name}`));
  });

  agent.on('sub_agent_done', (data: any) => {
    console.log(LAIN_COLORS.success(`  [OK] [sub] Done: ${data.summary.slice(0, 50)}`));
  });

  agent.on('sub_agent_error', (data: any) => {
    console.log(LAIN_COLORS.error(`  [ERR] [sub] Error: ${data.error}`));
  });

  // Hooks事件
  agent.on('hook_blocked', (data: any) => {
    console.log(LAIN_COLORS.error(`[BLOCKED] ${data.tool} - ${data.reason}`));
  });

  agent.on('hook_warning', (data: any) => {
    console.log(LAIN_COLORS.warning(`[WARN] ${data.message}`));
  });

  agent.on('hook_log', (data: any) => {
    console.log(LAIN_COLORS.muted(`[LOG] ${data.message}`));
  });

  // Context compression event
  agent.on('context_compressed', (data: any) => {
    console.log(LAIN_COLORS.secondary(`[COMPRESS] ${data.before} -> ${data.after} messages`));
  });
}