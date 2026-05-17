// Agent事件监听 - 与UI的桥梁

import { SpicaAgent } from '../agent';
import { InputBox } from './ui/inputBox';
import { LAIN_COLORS, format } from './ui/colors';
import prompts from 'prompts';
import { getRuntimeState } from '../core/RuntimeState';

// 格式化工具参数（简洁显示）
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

// 输出到滚动区域（不干扰输入框）
function outputToScroll(inputBox: InputBox | null, text: string): void {
  inputBox?.moveToScrollArea();
  process.stdout.write(text);
  inputBox?.render();
}

export function setupAgentEvents(
  agent: SpicaAgent,
  inputBox: InputBox | null,
  interactive: boolean = false
): void {
  const state = getRuntimeState();
  let lastWasReasoning = false;

  agent.on('connection_error', (data: any) => {
    state.setConnectionErrorShown(true);
    outputToScroll(inputBox, LAIN_COLORS.error(`\n[ERR] ${data.type}: ${data.hint}\n`));
  });

  agent.on('stream', (data: any) => {
    if (!state.isStreamingOutput()) {
      state.setStreamingOutput(true);
      inputBox?.moveToScrollArea();
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
      inputBox?.moveToScrollArea();
    }
    process.stderr.write(LAIN_COLORS.reasoning(data.content));
    lastWasReasoning = true;
  });

  agent.on('tool_call', (data: any) => {
    state.setStreamingOutput(false);
    inputBox?.moveToScrollArea();
    if (lastWasReasoning) {
      process.stdout.write('\n');
      lastWasReasoning = false;
    }
    const argsStr = formatArgs(data.arguments);
    process.stdout.write(LAIN_COLORS.tool(`\n-> ${data.name}${argsStr ? ` ${argsStr}` : ''}\n`));
  });

  agent.on('tool_result', (data: any) => {
    state.setStreamingOutput(false);
    inputBox?.moveToScrollArea();
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    const output = data.output || data.error || '';

    if (data.diff) {
      process.stdout.write(`${icon} ${data.name}\n${data.diff}\n`);
    } else if (output) {
      const firstLine = output.split('\n')[0].slice(0, 80);
      process.stdout.write(`${icon} ${data.name}: ${firstLine}${firstLine.length >= 80 ? '...' : ''}\n`);
    } else {
      process.stdout.write(`${icon} ${data.name}\n`);
    }
    inputBox?.render();
  });

  agent.on('permission_request', async (data: any) => {
    if (inputBox && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      state.setPermissionDialogActive(true);
      inputBox.moveToScrollArea();
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
      process.stdout.write(LAIN_COLORS.permissionBorder('═'.repeat(50)) + '\n');
      approved = answer.approve;
    } catch (e) {
      approved = false;
    } finally {
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
    outputToScroll(inputBox, LAIN_COLORS.warning(`\n[HINT] ${data.suggestion}\n`));
  });

  agent.on('workspace_changed', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.file(`\n[DIR] Workspace: ${data.path}\n`));
  });

  agent.on('bypass_changed', (data: any) => {
    state.setBypassMode(data.enabled);
    outputToScroll(inputBox, data.enabled
      ? LAIN_COLORS.bypass('\n[WARN] Bypass mode activated\n')
      : LAIN_COLORS.success('\n[OK] Strict mode activated\n'));
  });

  agent.on('permission_bypassed', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.bypassAuto(`\n[AUTO] Approved: ${data.reason}\n`));
  });

  agent.on('sub_agent_start', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.subAgent(`\n  [${data.type || 'sub'}] ${data.description}\n`));
  });

  agent.on('sub_agent_tool_call', (data: any) => {
    inputBox?.moveToScrollArea();
    process.stdout.write(LAIN_COLORS.subAgent(`    -> [sub] ${data.name}\n`));
  });

  agent.on('sub_agent_tool_result', (data: any) => {
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    inputBox?.moveToScrollArea();
    process.stdout.write(LAIN_COLORS.subAgent(`    ${icon} [sub] ${data.name}\n`));
  });

  agent.on('sub_agent_done', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.success(`\n  [OK] [sub] Done: ${data.summary.slice(0, 50)}\n`));
  });

  agent.on('sub_agent_error', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.error(`\n  [ERR] [sub] Error: ${data.error}\n`));
  });

  agent.on('hook_blocked', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.error(`\n[BLOCKED] ${data.tool} - ${data.reason}\n`));
  });

  agent.on('hook_warning', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.warning(`\n[WARN] ${data.message}\n`));
  });

  agent.on('hook_log', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.muted(`\n[LOG] ${data.message}\n`));
  });

  agent.on('context_compressed', (data: any) => {
    outputToScroll(inputBox, LAIN_COLORS.secondary(`\n[COMPRESS] ${data.before} -> ${data.after} messages\n`));
  });
}