#!/usr/bin/env node
import { Command } from 'commander';
import { SpicaAgent } from './agent';
import {
  loadConfig,
  saveConfig,
  setProviderConfig,
  getProviderConfig,
  listProviders,
  setDefaultProvider,
  BUILTIN_PROVIDERS,
} from './utils/config';
import { MCPServerConfig } from './utils/settings';
import { loadSession, saveSession } from './utils/session';
import { parseSkillInput, getSkill, buildSkillPrompt, listSkills, installSkill, uninstallSkill, listInstalledPackages } from './skills';
import { getMCPManager, generateExampleConfig, shutdownMCP } from './mcp/client';
import { LAIN_COLORS, format, BG } from './utils/colors';
import { getInputQueue, clearInputQueue } from './utils/inputQueue';
import * as readline from 'readline';
import prompts from 'prompts';
import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

const program = new Command();

// 当前agent引用（用于中断）
let currentAgent: SpicaAgent | null = null;

// 全局状态（用于status显示）
let globalProviderConfig: any = null;
let globalIsProcessing = false;
let globalBypassMode = false;

// 显示状态行（简化版本：每次prompt前显示）
function displayStatusLine(): void {
  const queue = getInputQueue();
  const queueStatus = queue.getStatus();
  const width = process.stdout.columns || 80;

  const parts: string[] = [];

  if (globalProviderConfig?.model) {
    parts.push(LAIN_COLORS.muted(globalProviderConfig.model));
  }

  if (globalIsProcessing) {
    parts.push(LAIN_COLORS.warning('processing'));
  }

  if (queueStatus.pending > 0) {
    parts.push(LAIN_COLORS.primary(`queue: ${queueStatus.pending}`));
  }

  parts.push(globalBypassMode
    ? LAIN_COLORS.bypass('bypass')
    : LAIN_COLORS.success('strict'));

  const statusLine = parts.join(' │ ');
  // 清除当前行并显示状态
  process.stdout.write('\x1b[2K\x1b[1G');
  process.stdout.write(statusLine.slice(0, width - 2));
  process.stdout.write('\n');
}

// Ctrl+C中断处理（防止重复触发）
let interruptPending = false;
process.on('SIGINT', () => {
  if (interruptPending) return;  // 防止重复

  if (currentAgent) {
    interruptPending = true;
    currentAgent.interrupt();
    console.log(LAIN_COLORS.warning('\n[INTERRUPTED]'));
    // 200ms 后重置状态
    setTimeout(() => {
      interruptPending = false;
    }, 200);
  } else {
    process.exit(0);
  }
});

// 设置agent事件监听
// 设置agent事件监听
let connectionErrorShown = false;  // 全局标记
let isStreamingOutput = false;     // 全局标记：是否正在输出

function setupAgentEvents(agent: SpicaAgent, rl: readline.Interface | null, interactive: boolean = false) {
  let lastWasReasoning = false;

  // 连接错误事件（只显示一次简洁信息）
  agent.on('connection_error', (data: any) => {
    connectionErrorShown = true;
    console.log(LAIN_COLORS.error(`\n[ERR] ${data.type}: ${data.hint}`));
    console.log('');
  });

  // 恢复输入行的辅助函数
  const restoreInputLine = () => {
    if (rl) {
      process.stdout.write('\n> ' + (rl.line || ''));
    }
  };

  agent.on('stream', (data: any) => {
    // 开始输出时清除输入行（只做一次）
    if (!isStreamingOutput) {
      isStreamingOutput = true;
      const esc = '\x1b';
      process.stdout.write(esc + '[2K' + esc + '[1G');
    }
    if (lastWasReasoning) {
      process.stdout.write('\n');
      lastWasReasoning = false;
    }
    // 直接输出，不要每次都恢复
    process.stdout.write(LAIN_COLORS.primary(data.chunk));
  });

  agent.on('reasoning', (data: any) => {
    if (!isStreamingOutput) {
      isStreamingOutput = true;
      const esc = '\x1b';
      process.stdout.write(esc + '[2K' + esc + '[1G');
    }
    process.stderr.write(LAIN_COLORS.reasoning(data.content));
    lastWasReasoning = true;
  });

  agent.on('tool_call', (data: any) => {
    // 工具调用意味着 stream 结束，恢复输入行
    if (isStreamingOutput) {
      isStreamingOutput = false;
      process.stdout.write('\n');
    }
    if (lastWasReasoning) {
      process.stdout.write('\n');
      lastWasReasoning = false;
    }
    console.log(LAIN_COLORS.tool(`-> ${data.name}`));
    if (rl) {
      process.stdout.write('> ' + (rl.line || ''));
    }
  });

  agent.on('tool_result', (data: any) => {
    // 工具结果意味着 stream 结束
    if (isStreamingOutput) {
      isStreamingOutput = false;
      process.stdout.write('\n');
    }
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    const output = data.output || data.error || '';
    console.log(`${icon} ${data.name}:`);
    if (output.length > 0) {
      output.split('\n').forEach(line => {
        console.log(LAIN_COLORS.muted(`  ${line}`));
      });
    }
    if (rl) {
      process.stdout.write('> ' + (rl.line || ''));
    }
  });

  agent.on('diff_preview', (data: any) => {
    console.log(LAIN_COLORS.file(`\n[FILE] ${data.filePath}`));
    if (data.diff) {
      console.log(data.diff);
    }
  });

  agent.on('permission_request', async (data: any) => {
    // 暂停 readline 并禁用 raw mode，让 prompts 正常工作
    if (rl) {
      rl.pause();
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      // 清除当前输入行显示
      const esc = '\x1b';
      process.stdout.write(esc + '[2K' + esc + '[1G');
    }

    // Lain红色警示框
    console.log(format.permissionBox(data.reason));
    const answer = await prompts({
      type: 'confirm',
      name: 'approve',
      message: LAIN_COLORS.primary.bold('Do you want to allow this action?'),
      initial: false,
    });
    console.log(LAIN_COLORS.permissionBorder('═'.repeat(50)) + '\n');

    // 恢复 readline 和 raw mode（不调用 prompt，让 handleInput 流程处理）
    if (rl) {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      rl.resume();
      // 清除 prompts 留下的残留输出
      const esc = '\x1b';
      process.stdout.write(esc + '[2K' + esc + '[1G');
    }

    if (answer.approve) {
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

program
  .name('spica')
  .description('AI coding agent')
  .version('1.0.0');

// 默认：持续对话模式（自动加载历史）
program
  .option('-f, --fresh', 'Start fresh session (no history)')
  .option('-p, --provider <name>', 'Use specific provider')
  .action(async (options: { fresh?: boolean; provider?: string }) => {
    const config = await loadConfig();
    const providerName = options.provider || config.defaultProvider || 'openai';

    let providerConfig;
    try {
      providerConfig = await getProviderConfig(providerName);
    } catch (error: any) {
      // 显示友好的配置指引
      console.log('');
      console.log(LAIN_COLORS.error(`Provider "${providerName}" not configured.`));
      console.log('');
      console.log(LAIN_COLORS.primary.bold('Quick Setup:'));
      console.log(LAIN_COLORS.muted('  1. Set API key:'));
      console.log(LAIN_COLORS.muted(`     spica providers set ${providerName} YOUR_API_KEY`));
      console.log('');
      console.log(LAIN_COLORS.muted('  2. Or use environment variable:'));
      console.log(LAIN_COLORS.muted(`     export OPENAI_API_KEY=sk-xxx`));
      console.log('');
      console.log(LAIN_COLORS.muted('Available providers: openai, anthropic, together, groq, local'));
      console.log(LAIN_COLORS.muted('Run `spica providers` for more info'));
      console.log('');
      return;
    }

    const agent = new SpicaAgent(providerName, process.cwd());
    currentAgent = agent;
    globalProviderConfig = providerConfig;

    // 开始banner动画（并行，但管道模式跳过）
    const bannerPromise = process.stdin.isTTY ? BG.banner() : Promise.resolve();

    try {
      await agent.init();

      // 停止banner动画
      BG.stopBanner();
      await bannerPromise;

      // 自动加载历史（除非 --fresh）
      if (!options.fresh) {
        const session = loadSession(process.cwd());
        if (session && session.messages && session.messages.length > 0) {
          agent.setMessages(session.messages);
          console.log(LAIN_COLORS.muted(`Loaded ${session.messages.length} messages from history`));
        }
      }

      // 显示初始状态（简化版本）
      console.log(LAIN_COLORS.muted(`${providerConfig.model} | /h help | TAB complete`));

      // 启用 Bracketed Paste Mode（粘贴内容作为整体到达，仅TTY模式）
      const ESC = '\x1b';
      if (process.stdin.isTTY) {
        process.stdout.write(`${ESC}[?2004h`);
      }

      // 可用指令列表（用于 Tab 补全）
      const COMMANDS = [
        '/help', '/h', '/status', '/bypass', '/strict',
        '/queue', '/q', '/undo', '/clear', '/reset',
        '/skills', '/history', '/compact',
      ];

      // Tab 补全 - Shell风格
      const completer = (line: string): [string[], string] => {
        // 返回空，让keypress事件处理显示
        return [[], line];
      };

      // 非阻塞 REPL 循环
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer,
      });

      // 监听 Tab 键 - Shell风格补全
      readline.emitKeypressEvents(process.stdin, rl);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      let lastLine = '';
      let shownList = false;

      // 粘贴检测：Bracketed Paste Mode（仅TTY模式）
      let pasteBuffer: string[] = [];
      let isInPaste = false;

      // 直接监听 stdin data 来检测粘贴序列（仅TTY模式）
      if (process.stdin.isTTY) {
        process.stdin.on('data', (chunk: Buffer) => {
          const str = chunk.toString('utf8');

          // 检测粘贴开始
          if (str.includes(`${ESC}[200~`)) {
            isInPaste = true;
            pasteBuffer = [];
            // 提取粘贴开始后的内容
            const parts = str.split(`${ESC}[200~`);
            if (parts.length > 1) {
              const afterStart = parts[1] || '';
              // 检测粘贴结束（可能在同一数据块）
              if (afterStart.includes(`${ESC}[201~`)) {
                const pasteParts = afterStart.split(`${ESC}[201~`);
                const pasteContent = pasteParts[0];
                pasteBuffer.push(pasteContent);
                isInPaste = false;
                // 提交合并的粘贴内容
                const mergedPaste = pasteBuffer.join('');
                if (mergedPaste.trim()) {
                  // 触发 line 事件（模拟 readline）
                  rl.emit('line', mergedPaste.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
                }
                pasteBuffer = [];
                // 处理粘贴结束后的剩余内容
                const afterPaste = pasteParts[1] || '';
                if (afterPaste) {
                  // 不处理，让 readline 处理
                }
              } else {
                pasteBuffer.push(afterStart);
              }
            }
            return;  // 不继续传递给 readline
          }

          // 检测粘贴结束
          if (str.includes(`${ESC}[201~`) && isInPaste) {
            const parts = str.split(`${ESC}[201~`);
            pasteBuffer.push(parts[0] || '');
            isInPaste = false;
            // 提交合并的粘贴内容
            const mergedPaste = pasteBuffer.join('');
            if (mergedPaste.trim()) {
              rl.emit('line', mergedPaste.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
            }
            pasteBuffer = [];
            // 处理粘贴结束后的剩余内容
            const afterPaste = parts[1] || '';
            if (afterPaste) {
              // 不处理，让 readline 处理
            }
            return;
          }

          // 正在粘贴中，累积内容
          if (isInPaste) {
            pasteBuffer.push(str);
            return;
          }
        });
      }

      if (process.stdin.isTTY) {
        process.stdin.on('keypress', (char: string, key: readline.Key) => {
          // 粘贴时不处理 keypress
          if (isInPaste) return;

          if (key.name === 'tab') {
            const currentLine = rl.line;
            if (currentLine.startsWith('/')) {
              const hits = COMMANDS.filter(c => c.startsWith(currentLine));

              if (hits.length === 1) {
                // 只有一个匹配，直接补全
                rl.write(hits[0].slice(currentLine.length));
                shownList = false;
                lastLine = hits[0];
              } else if (hits.length > 1) {
                // 多个匹配
                if (!shownList || currentLine !== lastLine) {
                  // 第一次Tab：显示列表
                  process.stdout.write('\n');
                  hits.forEach(h => process.stdout.write(`${h}  `));
                  process.stdout.write('\n> ' + currentLine);
                  shownList = true;
                  lastLine = currentLine;
                } else {
                  // 第二次Tab：补全第一个
                  rl.write(hits[0].slice(currentLine.length));
                  shownList = false;
                  lastLine = hits[0];
                }
              }
            }
          } else if (key.name !== 'return' && key.name !== 'enter') {
            // 其他按键重置状态
            shownList = false;
            lastLine = '';
          }
        });
      }

      // 设置agent事件监听（需要rl来恢复输入行）
      setupAgentEvents(agent, rl, true);

      let isProcessing = false;
      let shouldExit = false;

      // 输入处理函数
      const handleInput = async (line: string) => {
        const trimmed = line.trim();

        // quit/exit 命令始终有效（即使正在处理）
        if (trimmed === 'quit' || trimmed === 'exit') {
          shouldExit = true;
          if (isProcessing && currentAgent) {
            currentAgent.interrupt();
          }
          rl.close();
          return;
        }

        // 如果正在处理，非 / 命令加入队列
        if (isProcessing && !trimmed.startsWith('/')) {
          const queue = getInputQueue();
          queue.add(trimmed);
          const status = queue.getStatus();
          console.log(LAIN_COLORS.muted(`[QUEUE] Added (${status.pending} pending)`));
          rl.prompt();
          return;
        }

        if (!trimmed) {
          rl.prompt();
          return;
        }

        if (trimmed === 'help') {
          showHelp();
          rl.prompt();
          return;
        }

        // === / 命令 ===
        if (trimmed.startsWith('/')) {
          const cmd = trimmed.slice(1).toLowerCase();

          // 队列管理
          if (cmd === 'queue' || cmd === 'q') {
            const queue = getInputQueue();
            const status = queue.getStatus();
            console.log(LAIN_COLORS.primary.bold('\nInput Queue:'));
            console.log(`  Pending: ${status.pending}`);
            if (status.pendingPreview.length > 0) {
              console.log(LAIN_COLORS.muted('  Recent:'));
              status.pendingPreview.forEach((p, i) => {
                console.log(LAIN_COLORS.muted(`    ${i + 1}. ${p}`));
              });
            }
            console.log('');
            rl.prompt();
            return;
          }

          if (cmd === 'undo') {
            const queue = getInputQueue();
            const removed = queue.undoLast();
            if (removed) {
              console.log(LAIN_COLORS.muted(`[QUEUE] Removed: ${removed.content.slice(0, 30)}...`));
            } else {
              console.log(LAIN_COLORS.muted('[QUEUE] No pending inputs'));
            }
            rl.prompt();
            return;
          }

          if (cmd === 'clear' || cmd === 'reset') {
            agent.setMessages([]);
            clearInputQueue();
            console.log(LAIN_COLORS.muted('[OK] Session cleared'));
            rl.prompt();
            return;
          }

          // 权限模式
          if (cmd === 'bypass') {
            agent.setBypassPermissions(true);
            globalBypassMode = true;
            console.log(LAIN_COLORS.warning('[WARN] Bypass mode ON'));
            rl.prompt();
            return;
          }
          if (cmd === 'strict') {
            agent.setBypassPermissions(false);
            globalBypassMode = false;
            console.log(LAIN_COLORS.success('[OK] Strict mode ON'));
            rl.prompt();
            return;
          }

          // 状态
          if (cmd === 'status') {
            const bypass = agent.isBypassPermissions;
            const msgs = agent.getMessages().length;
            const queue = getInputQueue();
            const queueStatus = queue.getStatus();
            console.log(LAIN_COLORS.primary.bold('\nStatus:'));
            console.log(`  Mode: ${bypass ? 'BYPASS' : 'STRICT'}`);
            console.log(`  Messages: ${msgs}`);
            console.log(`  Queue: ${queueStatus.pending} pending`);
            console.log(`  Workspace: ${agent.getWorkspacePath()}`);
            console.log('');
            rl.prompt();
            return;
          }

          // Skills
          if (cmd === 'skills') {
            const skills = listSkills();
            console.log(LAIN_COLORS.primary.bold('\nSkills:'));
            if (skills.length === 0) {
              console.log(LAIN_COLORS.muted('  (none)'));
            } else {
              skills.forEach(s => {
                const hint = s.argumentHint ? ` ${s.argumentHint}` : '';
                console.log(LAIN_COLORS.muted(`  /${s.name}${hint} - ${s.description}`));
              });
            }
            console.log('');
            rl.prompt();
            return;
          }

          // 帮助
          if (cmd === 'help' || cmd === 'h') {
            showHelp();
            rl.prompt();
            return;
          }

          // 历史（显示最近消息）
          if (cmd === 'history') {
            const msgs = agent.getMessages();
            console.log(LAIN_COLORS.primary.bold('\nHistory:'));
            if (msgs.length === 0) {
              console.log(LAIN_COLORS.muted('  (empty)'));
            } else {
              // 显示全部消息，完整内容
              msgs.forEach((m, i) => {
                const role = m.role === 'user' ? 'YOU' : m.role === 'assistant' ? 'AI' : 'SYS';
                const content = m.content || '';
                console.log(LAIN_COLORS.muted(`  ${i + 1}. [${role}]`));
                // 分行显示完整内容
                content.split('\n').forEach(line => {
                  console.log(LAIN_COLORS.muted(`     ${line}`));
                });
              });
              console.log(LAIN_COLORS.muted(`\n  Total: ${msgs.length} messages`));
            }
            console.log('');
            rl.prompt();
            return;
          }

          // 压缩上下文
          if (cmd === 'compact') {
            const before = agent.getMessages().length;
            // Show spinner briefly
            const spinnerPromise = BG.compressSpinner();
            // Run compression (synchronous but we animate briefly)
            agent.compact();
            const after = agent.getMessages().length;
            // Stop spinner after 200ms to show animation effect
            setTimeout(() => BG.stopCompress(), 200);
            await spinnerPromise;
            console.log(LAIN_COLORS.secondary(`[COMPRESS] ${before} → ${after} messages`));
            rl.prompt();
            return;
          }

          // Skill 调用（/skill_name args）
          const skillInput = parseSkillInput(trimmed);
          if (skillInput) {
            const skill = getSkill(skillInput.skillName);
            if (skill) {
              const prompt = buildSkillPrompt(skill, skillInput.args);
              console.log(LAIN_COLORS.muted(`\n[${skill.name}] ${skill.description}`));
              isProcessing = true;
              globalIsProcessing = true;
              displayStatusLine();
              try {
                await agent.runLoop(prompt);
                console.log(LAIN_COLORS.success('\n[OK] Done\n'));
              } catch (error: any) {
                console.log(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
              }
              isProcessing = false;
              globalIsProcessing = false;
              saveSession(process.cwd(), agent.getMessages());
              await processQueue(agent);
              displayStatusLine();
              rl.prompt();
              return;
            }
          }

          // 未知的 / 命令
          console.log(LAIN_COLORS.warning(`Unknown command: ${trimmed}`));
          console.log(LAIN_COLORS.muted('Type /h for help'));
          rl.prompt();
          return;
        }

        // === 执行请求 ===
        console.log('');
        isProcessing = true;
        globalIsProcessing = true;
        // 显示状态行 + 提示符
        displayStatusLine();
        rl.prompt();
        try {
          await agent.runLoop(trimmed);
          // 如果还在 stream 状态，结束它
          if (isStreamingOutput) {
            isStreamingOutput = false;
            process.stdout.write('\n');
          }
          console.log(LAIN_COLORS.success('\n[OK] Done\n'));
        } catch (error: any) {
          if (isStreamingOutput) {
            isStreamingOutput = false;
            process.stdout.write('\n');
          }
          console.log(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
        }
        isProcessing = false;
        globalIsProcessing = false;
        saveSession(process.cwd(), agent.getMessages());
        await processQueue(agent);
        // 显示状态行 + 提示符
        displayStatusLine();
        rl.prompt();
      };

      // 帮助信息
      const showHelp = () => {
        console.log(LAIN_COLORS.primary.bold('\nCommands:'));
        console.log(LAIN_COLORS.muted('  quit/exit   Exit'));
        console.log(LAIN_COLORS.muted('  help        Show help'));
        console.log('');
        console.log(LAIN_COLORS.primary.bold('Session:'));
        console.log(LAIN_COLORS.muted('  /clear      Clear session'));
        console.log(LAIN_COLORS.muted('  /history    Show recent messages'));
        console.log(LAIN_COLORS.muted('  /compact    Compress context'));
        console.log('');
        console.log(LAIN_COLORS.primary.bold('Queue:'));
        console.log(LAIN_COLORS.muted('  /queue      Show queue'));
        console.log(LAIN_COLORS.muted('  /undo       Remove last input'));
        console.log('');
        console.log(LAIN_COLORS.primary.bold('Mode:'));
        console.log(LAIN_COLORS.muted('  /bypass     Auto-approve'));
        console.log(LAIN_COLORS.muted('  /strict     Ask permission'));
        console.log(LAIN_COLORS.muted('  /status     Show status'));
        console.log(LAIN_COLORS.muted('  /skills     List skills'));
        console.log('');
        console.log(LAIN_COLORS.muted('TAB for autocomplete'));
        console.log('');
      };

      // 处理队列中的输入
      const processQueue = async (agent: SpicaAgent) => {
        const queue = getInputQueue();
        if (!queue.hasPending()) return;

        console.log(LAIN_COLORS.muted(`\n[QUEUE] Processing ${queue.getStatus().pending} inputs...`));
        const mergedInput = queue.mergePending();

        if (mergedInput) {
          console.log(LAIN_COLORS.muted(`Combined input:\n${mergedInput.slice(0, 100)}${mergedInput.length > 100 ? '...' : ''}\n`));
          isProcessing = true;
          globalIsProcessing = true;
          displayStatusLine();
          try {
            await agent.runLoop(mergedInput);
            console.log(LAIN_COLORS.success('\n[OK] Done\n'));
          } catch (error: any) {
            console.log(LAIN_COLORS.error(`\n[ERR] Error: ${error.message}\n`));
          }
          isProcessing = false;
          globalIsProcessing = false;
          saveSession(process.cwd(), agent.getMessages());
          displayStatusLine();
        }
      };

      // 设置 readline 事件
      rl.on('line', handleInput);
      rl.on('close', async () => {
        if (!shouldExit) {
          // 用户按 Ctrl+C 但不是退出
          if (isProcessing && currentAgent) {
            currentAgent.interrupt();
            console.log(LAIN_COLORS.warning('\n[INTERRUPTED]'));
          }
          return;
        }

        // 正常退出 - 禁用 Bracketed Paste Mode（仅TTY模式）
        if (process.stdin.isTTY) {
          process.stdout.write(`${ESC}[?2004l`);
        }
        const messages = agent.getMessages();
        saveSession(process.cwd(), messages);
        await shutdownMCP();
        currentAgent = null;
        console.log(LAIN_COLORS.muted(`\nSession saved (${messages.length} messages)`));
        console.log(LAIN_COLORS.muted('Goodbye!\n'));
        process.exit(0);
      });

      // 提示符
      const showPrompt = () => {
        if (!isProcessing && !shouldExit) {
          process.stdout.write(LAIN_COLORS.success('> '));
        }
      };
      showPrompt();

      // 保持进程运行
      await new Promise<void>((resolve) => {
        rl.on('close', resolve);
      });

    } catch (error: any) {
      if (!connectionErrorShown) {
        console.log(LAIN_COLORS.error(`Error: ${error.message}`));
      }
    }

    currentAgent = null;
    connectionErrorShown = false;  // 重置
  });

// Run command - 单次执行
program
  .command('run <request>')
  .description('Execute single coding task')
  .option('-p, --provider <name>', 'Use specific provider')
  .action(async (request: string, options: { provider?: string }) => {
    const config = await loadConfig();
    const providerName = options.provider || config.defaultProvider || 'openai';

    let providerConfig;
    try {
      providerConfig = await getProviderConfig(providerName);
    } catch (error: any) {
      console.log(LAIN_COLORS.error(`Provider "${providerName}" not configured.`));
      console.log(LAIN_COLORS.warning('Set up with: spica providers set <name> <api-key>'));
      return;
    }

    const agent = new SpicaAgent(providerName, process.cwd());
    currentAgent = agent;

    setupAgentEvents(agent, null as any, false);

    try {
      await agent.init();
      const result = await agent.runLoop(request);
      console.log(LAIN_COLORS.success('\n[OK] Completed'));
    } catch (error: any) {
      if (!connectionErrorShown) {
        console.log(LAIN_COLORS.error(`Error: ${error.message}`));
      }
    }

    currentAgent = null;
    connectionErrorShown = false;  // 重置
  });

// Providers管理
program
  .command('providers')
  .description('Manage LLM providers')
  .argument('[action]', 'list|set|add|show|default|remove')
  .argument('[name]', 'Provider name')
  .argument('[value]', 'API key or URL')
  .option('-u, --url <url>', 'Base URL for custom provider')
  .option('-m, --model <model>', 'Model name')
  .action(async (action?: string, name?: string, value?: string, options?: { url?: string; model?: string }) => {
    if (!action) {
      const configured = await listProviders();
      const defaultProvider = (await loadConfig()).defaultProvider;

      console.log(LAIN_COLORS.primary.bold('Configured providers:'));
      if (configured.length === 0) {
        console.log(LAIN_COLORS.muted('  (none)'));
      } else {
        configured.forEach(p => {
          const isDefault = p === defaultProvider;
          console.log(`  ${isDefault ? LAIN_COLORS.success('*') : ' '} ${p}${isDefault ? LAIN_COLORS.success(' (default)') : ''}`);
        });
      }

      console.log(LAIN_COLORS.primary.bold('\nBuilt-in providers:'));
      Object.entries(BUILTIN_PROVIDERS).forEach(([key, config]) => {
        const isConfigured = configured && configured.includes(key);
        console.log(`  ${isConfigured ? '*' : ' '} ${key} - ${config.name}`);
        if (config.description) {
          console.log(LAIN_COLORS.muted(`      ${config.description}`));
        }
      });

      console.log(LAIN_COLORS.muted('\nUsage:'));
      console.log(LAIN_COLORS.muted('  spica providers set <name> <api-key>   # 配置已有provider'));
      console.log(LAIN_COLORS.muted('  spica providers add <name> <api-key> --url <url>  # 添加自定义provider'));
      console.log(LAIN_COLORS.muted('  spica providers default <name>        # 设置默认provider'));
      return;
    }

    switch (action) {
      case 'set':
        if (!name || !value) {
          console.log(LAIN_COLORS.warning('Usage: spica providers set <name> <api-key> [--url <url>] [--model <model>]'));
          return;
        }
        await setProviderConfig(name, value, options?.url, options?.model);
        console.log(LAIN_COLORS.success(`[OK] Provider '${name}' configured`));
        if (options?.url) console.log(LAIN_COLORS.muted(`  URL: ${options.url}`));
        if (options?.model) console.log(LAIN_COLORS.muted(`  Model: ${options.model}`));
        break;

      case 'add':
        if (!name || !value) {
          console.log(LAIN_COLORS.warning('Usage: spica providers add <name> <api-key> --url <url> [--model <model>]'));
          console.log(LAIN_COLORS.muted('Example: spica providers add myapi sk-xxx --url https://api.example.com/v1 --model gpt-4'));
          return;
        }
        if (!options?.url) {
          console.log(LAIN_COLORS.error('Error: --url is required for custom provider'));
          console.log(LAIN_COLORS.warning('Usage: spica providers add <name> <api-key> --url <url> [--model <model>]'));
          return;
        }
        await setProviderConfig(name, value, options.url, options.model);
        console.log(LAIN_COLORS.success(`[OK] Custom provider '${name}' added`));
        console.log(LAIN_COLORS.muted(`  URL: ${options.url}`));
        console.log(LAIN_COLORS.muted(`  Model: ${options.model || 'gpt-4'}`));
        break;

      case 'show':
        if (!name) name = (await loadConfig()).defaultProvider || 'openai';
        try {
          const config = await getProviderConfig(name);
          console.log(LAIN_COLORS.primary.bold(`\nProvider: ${config.name}`));
          console.log(LAIN_COLORS.muted('─'.repeat(40)));
          console.log(`  API Key: ${config.apiKey.substring(0, 10)}...${config.apiKey.length > 20 ? config.apiKey.slice(-4) : ''}`);
          console.log(`  Base URL: ${config.baseUrl}`);
          console.log(`  Model: ${config.model}`);
          if (config.description) {
            console.log(LAIN_COLORS.muted(`  Description: ${config.description}`));
          }
        } catch (error: any) {
          console.log(LAIN_COLORS.error(error.message));
          console.log(LAIN_COLORS.warning(`Configure it first: spica providers set ${name} YOUR_API_KEY`));
        }
        break;

      case 'default':
        if (!name) {
          const config = await loadConfig();
          console.log(`Current default: ${config.defaultProvider || 'openai'}`);
          return;
        }
        try {
          await setDefaultProvider(name);
          console.log(LAIN_COLORS.success(`[OK] Default provider set to '${name}'`));
        } catch (error: any) {
          console.log(LAIN_COLORS.error(error.message));
          console.log(LAIN_COLORS.warning(`Configure it first: spica providers set ${name} YOUR_API_KEY`));
        }
        break;

      case 'remove':
        if (!name) {
          console.log(LAIN_COLORS.warning('Usage: spica providers remove <name>'));
          return;
        }
        const config = await loadConfig();
        if (config.providers?.[name]) {
          delete config.providers[name];
          if (config.defaultProvider === name) {
            config.defaultProvider = Object.keys(config.providers || {})[0] || 'openai';
          }
          await saveConfig(config);
          console.log(LAIN_COLORS.success(`[OK] Provider '${name}' removed`));
        } else {
          console.log(LAIN_COLORS.error(`Provider '${name}' not found in configured providers`));
        }
        break;

      default:
        console.log(LAIN_COLORS.warning('Available actions: list, set, add, show, default, remove'));
    }
  });

// Skills管理
program
  .command('skills')
  .description('Manage custom skills')
  .argument('[action]', 'list|install|uninstall|packages')
  .argument('[source]', 'URL or package name')
  .action(async (action?: string, source?: string) => {
    if (!action) {
      // 默认列出所有skills
      const skills = listSkills();
      const packages = await listInstalledPackages();

      console.log(LAIN_COLORS.primary.bold('\nInstalled skill packages:'));
      if (packages.length === 0) {
        console.log(LAIN_COLORS.muted('  (none)'));
      } else {
        packages.forEach(p => {
          console.log(`  ${LAIN_COLORS.success('*')} ${p.name} v${p.version || '1.0.0'} - ${p.description}`);
        });
      }

      console.log(LAIN_COLORS.primary.bold('\nAvailable skills:'));
      if (skills.length === 0) {
        console.log(LAIN_COLORS.muted('  (none)'));
        console.log(LAIN_COLORS.muted('\nInstall skills with:'));
        console.log(LAIN_COLORS.muted('  spica skills install <url-or-file>'));
      } else {
        skills.forEach(s => {
          console.log(`  ${LAIN_COLORS.muted(`/${s.name}`)} - ${s.description}`);
        });
      }
      console.log('');
      return;
    }

    switch (action) {
      case 'list':
        const skills = listSkills();
        console.log(LAIN_COLORS.primary.bold('\nAvailable skills:'));
        skills.forEach(s => {
          console.log(`  ${LAIN_COLORS.muted(`/${s.name}`)} - ${s.description}`);
        });
        break;

      case 'install':
        if (!source) {
          console.log(LAIN_COLORS.warning('Usage: spica skills install <url-or-file>'));
          console.log(LAIN_COLORS.muted('Example: spica skills install https://example.com/skills.json'));
          return;
        }
        const result = await installSkill(source);
        if (result.success) {
          console.log(LAIN_COLORS.success(`[OK] ${result.message}`));
          if (result.skills) {
            console.log(LAIN_COLORS.muted('Installed skills:'));
            result.skills.forEach(s => console.log(LAIN_COLORS.muted(`  /${s}`)));
          }
        } else {
          console.log(LAIN_COLORS.error(`[ERR] ${result.message}`));
        }
        break;

      case 'uninstall':
        if (!source) {
          console.log(LAIN_COLORS.warning('Usage: spica skills uninstall <package-name>'));
          return;
        }
        const uninstallResult = await uninstallSkill(source);
        if (uninstallResult.success) {
          console.log(LAIN_COLORS.success(`[OK] ${uninstallResult.message}`));
        } else {
          console.log(LAIN_COLORS.error(`[ERR] ${uninstallResult.message}`));
        }
        break;

      case 'packages':
        const packages = await listInstalledPackages();
        console.log(LAIN_COLORS.primary.bold('\nInstalled skill packages:'));
        if (packages.length === 0) {
          console.log(LAIN_COLORS.muted('  (none)'));
        } else {
          packages.forEach(p => {
            console.log(`  ${LAIN_COLORS.success('*')} ${p.name} v${p.version || '1.0.0'}`);
            console.log(LAIN_COLORS.muted(`    ${p.description}`));
            if (p.author) {
              console.log(LAIN_COLORS.muted(`    Author: ${p.author}`));
            }
          });
        }
        break;

      default:
        console.log(LAIN_COLORS.warning('Available actions: list, install, uninstall, packages'));
    }
  });

// MCP管理
program
  .command('mcp')
  .description('Manage MCP (Model Context Protocol) servers')
  .argument('[action]', 'list|init|connect|disconnect|tools')
  .argument('[server]', 'Server name (optional)')
  .action(async (action?: string, server?: string) => {
    const manager = getMCPManager();  // 定义在开头，所有case都能用

    if (!action) {
      // 默认显示状态
      const connected = manager.listConnectedServers();
      const tools = manager.listAvailableTools();

      console.log(LAIN_COLORS.primary.bold('\nMCP Status:'));
      if (connected.length === 0) {
        console.log(LAIN_COLORS.muted('  No servers connected'));
        console.log(LAIN_COLORS.muted('\n  Run `spica mcp init` to create example config'));
      } else {
        console.log(LAIN_COLORS.success(`  Connected servers: ${connected.join(', ')}`));
        console.log(LAIN_COLORS.muted(`  Available tools: ${tools.length}`));
        if (tools.length > 0) {
          tools.slice(0, 10).forEach(t => {
            console.log(LAIN_COLORS.muted(`    - ${t}`));
          });
          if (tools.length > 10) {
            console.log(LAIN_COLORS.muted(`    ... and ${tools.length - 10} more`));
          }
        }
      }
      console.log('');
      return;
    }

    switch (action) {
      case 'list':
        const servers = manager.listConnectedServers();
        console.log(LAIN_COLORS.primary.bold('\nConnected MCP servers:'));
        if (servers.length === 0) {
          console.log(LAIN_COLORS.muted('  (none)'));
        } else {
          servers.forEach(s => {
            const toolsCount = manager.listAvailableTools().filter(t => t.startsWith(`${s}/`)).length;
            console.log(`  ${LAIN_COLORS.success('*')} ${s} (${toolsCount} tools)`);
          });
        }
        break;

      case 'init':
        // 写入 settings.json
        const { loadGlobalSettings, saveGlobalSettings, GLOBAL_SETTINGS_FILE } = await import('./utils/settings');
        const currentSettings = await loadGlobalSettings();

        if (currentSettings.mcp?.servers?.length > 0) {
          console.log(LAIN_COLORS.warning(`MCP servers already configured in settings.json`));
          console.log(LAIN_COLORS.muted('Edit ~/.spica/settings.json to modify'));
        } else {
          currentSettings.mcp = generateExampleConfig();
          await saveGlobalSettings(currentSettings);
          console.log(LAIN_COLORS.success(`[OK] MCP config added to ${GLOBAL_SETTINGS_FILE}`));
          console.log(LAIN_COLORS.muted('Edit ~/.spica/settings.json to customize servers'));
        }
        break;

      case 'tools':
        const allTools = manager.listAvailableTools();
        console.log(LAIN_COLORS.primary.bold('\nAvailable MCP tools:'));
        if (allTools.length === 0) {
          console.log(LAIN_COLORS.muted('  (none)'));
          console.log(LAIN_COLORS.muted('Connect a MCP server first'));
        } else {
          allTools.forEach(t => {
            console.log(LAIN_COLORS.muted(`  ${t}`));
          });
        }
        break;

      case 'disconnect':
        if (server) {
          // 断开特定服务器（未实现）
          console.log(LAIN_COLORS.warning('Disconnecting specific server not implemented'));
        } else {
          await manager.disconnectAll();
          console.log(LAIN_COLORS.success('[OK] All MCP servers disconnected'));
        }
        break;

      default:
        console.log(LAIN_COLORS.warning('Available actions: list, init, tools, disconnect'));
        console.log(LAIN_COLORS.muted('\nMCP allows connecting external tool servers'));
        console.log(LAIN_COLORS.muted('Examples: filesystem, postgres, slack, custom APIs'));
    }
  });

program.parse();