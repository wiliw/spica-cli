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
import { parseSkillInput, getSkill, buildSkillPrompt, listSkills, installSkill, uninstallSkill, listInstalledPackages, saveSkill, deleteSkill } from './skills';
import { runInit } from './cli/init';
import { getMCPManager, generateExampleConfig, shutdownMCP } from './mcp/client';
import { LAIN_COLORS, format, BG } from './cli/ui/colors';
import { getInputQueue, clearInputQueue } from './cli/ui/queue';
import { setupAgentEvents } from './cli/events';
import { displayStatusLine } from './cli/status';
import { getRuntimeState, resetRuntimeState } from './core/RuntimeState';
import { ScreenManager } from './cli/ui/screenManager';
import * as readline from 'readline';
import prompts from 'prompts';
import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

const program = new Command();
const state = getRuntimeState();

// Ctrl+C中断处理
let interruptCount = 0;
let interruptTimeout: NodeJS.Timeout | null = null;

process.on('SIGINT', () => {
  // 连续Ctrl+C强制退出
  interruptCount++;
  if (interruptCount >= 3) {
    console.log(LAIN_COLORS.error('\n[FORCE EXIT]'));
    process.exit(0);
  }

  // 重置计数器（1秒内没有第二次Ctrl+C）
  if (interruptTimeout) clearTimeout(interruptTimeout);
  interruptTimeout = setTimeout(() => {
    interruptCount = 0;
  }, 1000);

  if (state.getAgent()) {
    state.getAgent().interrupt();
    console.log(LAIN_COLORS.warning('\n[INTERRUPTED] Ctrl+C again to exit'));
  } else {
    process.exit(0);
  }
});

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
      state.setProviderConfig(providerConfig);
    } catch (error: any) {
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
    state.setAgent(agent);

    // 开始banner动画（并行）
    const bannerPromise = BG.banner();

    try {
      await agent.init();

      // 停止banner动画
      BG.stopBanner();
      await bannerPromise;

      // 创建 ScreenManager（固定输入框 + 滚动输出区）
      const screenManager = new ScreenManager();
      screenManager.init();
      screenManager.setStatus(`${providerConfig.model} | /h help | TAB complete | ESC ESC interrupt`);

      // 输出辅助函数
      const output = (text: string) => screenManager.addContent(text);

      // 自动加载历史（除非 --fresh）
      if (!options.fresh) {
        const session = loadSession(process.cwd());
        if (session && session.messages && session.messages.length > 0) {
          agent.setMessages(session.messages);
          output(LAIN_COLORS.muted(`Loaded ${session.messages.length} messages from history`));
        }
      }

      // 启用 Bracketed Paste Mode（粘贴内容作为整体到达）
      const ESC = '\x1b';
      process.stdout.write(`${ESC}[?2004h`);

      // 先启用 rawMode（在 readline 创建之前）
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      // 粘贴处理变量
      let pasteBuffer = '';
      let isInPaste = false;
      let inputBuffer = '';  // 累积的输入（粘贴+用户输入）

      // stdin data 监听 - 检测粘贴序列和ESC（在 readline 之前注册）
      process.stdin.on('data', (chunk: Buffer) => {
        const str = chunk.toString('utf8');

        // 检测ESC键（用于中断）
        if (str === '\x1b') {
          const now = Date.now();
          if (now - lastEscTime < 500) {
            if (isProcessing && state.getAgent()) {
              state.getAgent().interrupt();
              isProcessing = false;
              state.setProcessing(false);
              output(LAIN_COLORS.warning('\n[INTERRUPTED] ESC'));
              inputBuffer = '';  // 清空缓冲区
              screenManager.setInput('');
              screenManager.moveToInput();
            }
            lastEscTime = 0;
          } else {
            lastEscTime = now;
          }
          return;
        }

        // 检测粘贴开始 \x1b[200~
        if (str.includes('\x1b[200~')) {
          isInPaste = true;
          pasteBuffer = '';
          const idx = str.indexOf('\x1b[200~');
          const after = str.slice(idx + 6);
          if (after.includes('\x1b[201~')) {
            // 粘贴在同一chunk中完成
            const endIdx = after.indexOf('\x1b[201~');
            pasteBuffer = after.slice(0, endIdx);
            isInPaste = false;
            const content = pasteBuffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            if (content) {
              // 累积到输入缓冲区
              inputBuffer = inputBuffer ? inputBuffer + '\n' + content : content;
              const lines = inputBuffer.split('\n').length;
              const chars = inputBuffer.length;
              // 显示缓冲区摘要（使用状态行）
              screenManager.setStatus(LAIN_COLORS.muted(`<buffer: ${lines} lines, ${chars} chars> [Enter to process, Ctrl+U to clear]`));
            }
            pasteBuffer = '';
          } else {
            pasteBuffer = after;
          }
          return;  // 阻止readline看到粘贴序列
        }

        // 检测粘贴结束 \x1b[201~
        if (str.includes('\x1b[201~') && isInPaste) {
          const idx = str.indexOf('\x1b[201~');
          pasteBuffer += str.slice(0, idx);
          isInPaste = false;
          const content = pasteBuffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          if (content) {
            inputBuffer = inputBuffer ? inputBuffer + '\n' + content : content;
            const lines = inputBuffer.split('\n').length;
            const chars = inputBuffer.length;
            screenManager.setStatus(LAIN_COLORS.muted(`<buffer: ${lines} lines, ${chars} chars> [Enter to process, Ctrl+U to clear]`));
          }
          pasteBuffer = '';
          return;  // 阻止readline看到粘贴序列
        }

        // 累积粘贴内容（跨多个chunk）
        if (isInPaste) {
          pasteBuffer += str;
          return;  // 阻止readline看到粘贴内容
        }

        // Ctrl+U: 清空输入缓冲区
        if (str === '\x15') {
          inputBuffer = '';
          screenManager.setInput('');
          screenManager.setStatus(`${providerConfig.model} | /h help | TAB complete | ESC ESC interrupt`);
          return;
        }
      });

      // Tab补全状态
      let lastLine = '';
      let shownList = false;

      // 可用指令列表（用于 Tab 补全） - 基础命令
      const BASE_COMMANDS = [
        '/help', '/h', '/status', '/bypass', '/strict',
        '/queue', '/q', '/undo', '/clear', '/reset',
        '/skills', '/skill-add', '/skill-remove', '/skill-edit',
        '/history', '/compact', '/init',
      ];

      // 动态获取完整命令列表（包含skills）
      const getCommands = () => {
        const skills = listSkills(process.cwd());
        const skillCommands = skills.map(s => `/${s.name}`);
        return [...BASE_COMMANDS, ...skillCommands];
      };

      // Tab 补全 - Shell风格
      const completer = (line: string): [string[], string] => {
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

      // 先定义isProcessing，供keypress事件使用
      let isProcessing = false;
      let shouldExit = false;

      // ESC双击中断
      let lastEscTime = 0;

      process.stdin.on('keypress', (char: string, key: readline.Key) => {
        // 粘贴时不处理 keypress
        if (isInPaste) return;

        // Tab补全
        if (key.name === 'tab') {
          const currentLine = rl.line;
          if (currentLine.startsWith('/')) {
            const hits = getCommands().filter(c => c.startsWith(currentLine));

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

      // 设置agent事件监听（传入 ScreenManager）
      setupAgentEvents(agent, rl, true, screenManager);

      // 提示符辅助函数
      const showPrompt = () => {
        screenManager.setInput('');
        screenManager.moveToInput();
      };

      // 输入处理函数
      const handleInput = async (line: string) => {
        const trimmed = line.trim();

        // quit/exit 命令始终有效（即使正在处理）
        if (trimmed === 'quit' || trimmed === 'exit') {
          shouldExit = true;
          if (isProcessing && state.getAgent()) {
            state.getAgent().interrupt();
          }
          screenManager.cleanup();
          rl.close();
          return;
        }

        // 如果正在处理，非 / 命令加入队列
        if (isProcessing && !trimmed.startsWith('/')) {
          const queue = getInputQueue();
          queue.add(trimmed);
          const status = queue.getStatus();
          output(LAIN_COLORS.muted(`[QUEUE] Added (${status.pending} pending)`));
          showPrompt();
          return;
        }

        if (!trimmed) {
          showPrompt();
          return;
        }

        if (trimmed === 'help') {
          showHelp();
          showPrompt();
          return;
        }

        // === / 命令 ===
        if (trimmed.startsWith('/')) {
          const cmd = trimmed.slice(1).toLowerCase();

          // 队列管理
          if (cmd === 'queue' || cmd === 'q') {
            const queue = getInputQueue();
            const status = queue.getStatus();
            output(LAIN_COLORS.primary.bold('\nInput Queue:'));
            output(`  Pending: ${status.pending}`);
            if (status.pendingPreview.length > 0) {
              output(LAIN_COLORS.muted('  Recent:'));
              status.pendingPreview.forEach((p, i) => {
                output(LAIN_COLORS.muted(`    ${i + 1}. ${p}`));
              });
            }
            output('');
            showPrompt();
            return;
          }

          if (cmd === 'undo') {
            const queue = getInputQueue();
            const removed = queue.undoLast();
            if (removed) {
              output(LAIN_COLORS.muted(`[QUEUE] Removed: ${removed.content.slice(0, 30)}...`));
            } else {
              output(LAIN_COLORS.muted('[QUEUE] No pending inputs'));
            }
            showPrompt();
            return;
          }

          if (cmd === 'clear' || cmd === 'reset') {
            agent.setMessages([]);
            clearInputQueue();
            screenManager.clearContent();
            output(LAIN_COLORS.muted('[OK] Session cleared'));
            showPrompt();
            return;
          }

          // 权限模式
          if (cmd === 'bypass') {
            agent.setBypassPermissions(true);
            state.setBypassMode(true);
            showPrompt();
            return;
          }
          if (cmd === 'strict') {
            agent.setBypassPermissions(false);
            state.setBypassMode(false);
            showPrompt();
            return;
          }

          // 状态
          if (cmd === 'status') {
            const bypass = agent.isBypassPermissions;
            const msgs = agent.getMessages().length;
            const queue = getInputQueue();
            const queueStatus = queue.getStatus();
            output(LAIN_COLORS.primary.bold('\nStatus:'));
            output(`  Mode: ${bypass ? 'BYPASS' : 'STRICT'}`);
            output(`  Messages: ${msgs}`);
            output(`  Queue: ${queueStatus.pending} pending`);
            output(`  Workspace: ${agent.getWorkspacePath()}`);
            output('');
            showPrompt();
            return;
          }

          // Skills
          if (cmd === 'skills') {
            const skills = listSkills(process.cwd());
            output(LAIN_COLORS.primary.bold('\nSkills:'));
            if (skills.length === 0) {
              output(LAIN_COLORS.muted('  (none)'));
            } else {
              skills.forEach(s => {
                // 截断description到50字符
                const desc = s.description || '';
                const shortDesc = desc.length > 50 ? desc.slice(0, 50) + '...' : desc;
                output(LAIN_COLORS.muted(`  /${s.name} - ${shortDesc}`));
              });
            }
            output('');
            showPrompt();
            return;
          }

          // 帮助
          if (cmd === 'help' || cmd === 'h') {
            showHelp();
            showPrompt();
            return;
          }

          // 历史（显示最近消息）
          if (cmd === 'history') {
            const msgs = agent.getMessages();
            output(LAIN_COLORS.primary.bold('\nHistory:'));
            if (msgs.length === 0) {
              output(LAIN_COLORS.muted('  (empty)'));
            } else {
              // 显示全部消息，完整内容
              msgs.forEach((m, i) => {
                const role = m.role === 'user' ? 'YOU' : m.role === 'assistant' ? 'AI' : 'SYS';
                const content = m.content || '';
                output(LAIN_COLORS.muted(`  ${i + 1}. [${role}]`));
                // 分行显示完整内容
                content.split('\n').forEach(line => {
                  output(LAIN_COLORS.muted(`     ${line}`));
                });
              });
              output(LAIN_COLORS.muted(`\n  Total: ${msgs.length} messages`));
            }
            output('');
            showPrompt();
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
            output(LAIN_COLORS.secondary(`[COMPRESS] ${before} → ${after} messages`));
            showPrompt();
            return;
          }

          // Init - 让AI分析代码库并创建 AGENTS.md
          if (cmd === 'init' || cmd.startsWith('init ')) {
            const args = cmd.split(' ').slice(1);
            const force = args.includes('--force') || args.includes('-f');

            const initPrompt = force
              ? `分析这个代码库，理解项目结构、主要功能、开发命令、测试方式、代码风格等。然后完全重写 AGENTS.md 文件，包含：
1. 项目类型和技术栈
2. 主要入口和核心模块
3. 开发、构建、测试命令
4. 代码架构和设计模式
5. 重要的开发注意事项

请阅读关键文件（如 package.json、README、配置文件、入口文件）来深入理解项目。`
              : `分析这个代码库，理解项目结构、主要功能、开发命令、测试方式等。然后创建或更新 AGENTS.md 文件。

如果 AGENTS.md 已存在，保持现有内容并补充新发现的信息。如果不存在，创建新文件。

请阅读关键文件来深入理解项目，写出能帮助未来 AI agent 更好工作的文档。`;

            handleInput(initPrompt);
            return;
          }

          // 动态 skill 管理
          if (cmd.startsWith('skill-add ')) {
            const parts = cmd.slice('skill-add '.length).split(' ');
            const skillName = parts[0];
            if (!skillName) {
              output(LAIN_COLORS.warning('Usage: /skill-add <name> [promptTemplate]'));
              showPrompt();
              return;
            }
            const promptTemplate = parts.slice(1).join(' ') || '{input}';
            const description = `Custom skill: ${skillName}`;
            await saveSkill(skillName, { name: skillName, description, promptTemplate });
            output(LAIN_COLORS.success(`[OK] Skill added: ${skillName}`));
            showPrompt();
            return;
          }

          if (cmd.startsWith('skill-remove ')) {
            const skillName = cmd.slice('skill-remove '.length).trim();
            if (!skillName) {
              output(LAIN_COLORS.warning('Usage: /skill-remove <name>'));
              showPrompt();
              return;
            }
            const result = await deleteSkill(skillName);
            if (result) {
              output(LAIN_COLORS.success(`[OK] Skill removed: ${skillName}`));
            } else {
              output(LAIN_COLORS.warning(`[WARN] Skill not found: ${skillName}`));
            }
            showPrompt();
            return;
          }

          if (cmd.startsWith('skill-edit ')) {
            const rest = cmd.slice('skill-edit '.length);
            const firstSpace = rest.indexOf(' ');
            if (firstSpace === -1) {
              output(LAIN_COLORS.warning('Usage: /skill-edit <name> <promptTemplate>'));
              showPrompt();
              return;
            }
            const skillName = rest.slice(0, firstSpace);
            const promptTemplate = rest.slice(firstSpace + 1) || '{input}';
            const existing = getSkill(skillName, process.cwd());
            if (!existing) {
              output(LAIN_COLORS.warning(`[WARN] Skill not found: ${skillName}`));
              showPrompt();
              return;
            }
            await saveSkill(skillName, { ...existing, promptTemplate });
            output(LAIN_COLORS.success(`[OK] Skill updated: ${skillName}`));
            showPrompt();
            return;
          }

          // Skill 调用（/skill_name args）
          const skillInput = parseSkillInput(trimmed, process.cwd());
          if (skillInput) {
            const skill = getSkill(skillInput.skillName, process.cwd());
            if (skill) {
              const prompt = buildSkillPrompt(skill, skillInput.args);
              output(LAIN_COLORS.muted(`\n[${skill.name}] ${skill.description}`));
              isProcessing = true;
              state.setProcessing(true);
              try {
                await agent.runLoop(prompt);
                output(LAIN_COLORS.success('\n[OK] Done\n'));
              } catch (error: any) {
                output(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
              }
              isProcessing = false;
              state.setProcessing(false);
              saveSession(process.cwd(), agent.getMessages());
              await processQueue(agent);
              screenManager.setStatus('Ready');
              showPrompt();
              return;
            }
          }

          // 未知的 / 命令
          output(LAIN_COLORS.warning(`Unknown command: ${trimmed}`));
          output(LAIN_COLORS.muted('Type /h for help'));
          showPrompt();
          return;
        }

        // === 执行请求 ===
        output('');
        isProcessing = true;
        state.setProcessing(true);
        screenManager.setStatus('Processing... (ESC ESC to interrupt)');

        try {
          await agent.runLoop(trimmed);
          // 如果还在 stream 状态，结束它
          if (state.isStreamingOutput()) {
            state.setStreamingOutput(false);
          }
          output(LAIN_COLORS.success('\n[OK] Done\n'));
        } catch (error: any) {
          if (state.isStreamingOutput()) {
            state.setStreamingOutput(false);
          }
          output(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
        }
        isProcessing = false;
        state.setProcessing(false);
        saveSession(process.cwd(), agent.getMessages());
        await processQueue(agent);
        screenManager.setStatus('Ready');
        showPrompt();
      };

      // 帮助信息
      const showHelp = () => {
        output(LAIN_COLORS.primary.bold('\nCommands:'));
        output(LAIN_COLORS.muted('  quit/exit   Exit'));
        output(LAIN_COLORS.muted('  help        Show help'));
        output('');
        output(LAIN_COLORS.primary.bold('Session:'));
        output(LAIN_COLORS.muted('  /clear      Clear session'));
        output(LAIN_COLORS.muted('  /history    Show recent messages'));
        output(LAIN_COLORS.muted('  /compact    Compress context'));
        output(LAIN_COLORS.muted('  /init       Create AGENTS.md (--force to overwrite)'));
        output('');
        output(LAIN_COLORS.primary.bold('Queue:'));
        output(LAIN_COLORS.muted('  /queue      Show queue'));
        output(LAIN_COLORS.muted('  /undo       Remove last input'));
        output('');
        output(LAIN_COLORS.primary.bold('Mode:'));
        output(LAIN_COLORS.muted('  /bypass     Auto-approve'));
        output(LAIN_COLORS.muted('  /strict     Ask permission'));
        output(LAIN_COLORS.muted('  /status     Show status'));
        output('');
        output(LAIN_COLORS.primary.bold('Skills:'));
        output(LAIN_COLORS.muted('  /skills           List skills'));
        output(LAIN_COLORS.muted('  /skill-add <name> <template>  Add skill'));
        output(LAIN_COLORS.muted('  /skill-remove <name>          Remove skill'));
        output(LAIN_COLORS.muted('  /skill-edit <name> <template> Edit skill'));
        output('');
        output(LAIN_COLORS.muted('TAB for autocomplete'));
        output('');
      };

      // 处理队列中的输入
      const processQueue = async (agent: SpicaAgent) => {
        const queue = getInputQueue();
        if (!queue.hasPending()) return;

        output(LAIN_COLORS.muted(`\n[QUEUE] Processing ${queue.getStatus().pending} inputs...`));
        const mergedInput = queue.mergePending();

        if (mergedInput) {
          output(LAIN_COLORS.muted(`Combined input:\n${mergedInput.slice(0, 100)}${mergedInput.length > 100 ? '...' : ''}\n`));
          isProcessing = true;
          state.setProcessing(true);
          try {
            await agent.runLoop(mergedInput);
            output(LAIN_COLORS.success('\n[OK] Done\n'));
          } catch (error: any) {
            output(LAIN_COLORS.error(`\n[ERR] Error: ${error.message}\n`));
          }
          isProcessing = false;
          state.setProcessing(false);
          saveSession(process.cwd(), agent.getMessages());
        }
      };

      // 设置 readline 事件
      rl.on('line', (line: string) => {
        // 如果有累积的输入缓冲区，合并处理
        if (inputBuffer) {
          const combined = inputBuffer + '\n' + line;
          inputBuffer = '';  // 清空缓冲区
          handleInput(combined.trim());
        } else {
          handleInput(line);
        }
      });
      rl.on('close', async () => {
        if (!shouldExit) {
          // 用户按 Ctrl+C 但不是退出
          if (isProcessing && state.getAgent()) {
            state.getAgent().interrupt();
            output(LAIN_COLORS.warning('\n[INTERRUPTED]'));
          }
          return;
        }

        // 正常退出 - 禁用 Bracketed Paste Mode
        process.stdout.write(`${ESC}[?2004l`);
        screenManager.cleanup();
        const messages = agent.getMessages();
        saveSession(process.cwd(), messages);
        await shutdownMCP();
        state.setAgent(null);
        console.log(LAIN_COLORS.muted(`\nSession saved (${messages.length} messages)`));
        console.log(LAIN_COLORS.muted('Goodbye!\n'));
        process.exit(0);
      });

      // 初始提示符
      showPrompt();

      // 保持进程运行
      await new Promise<void>((resolve) => {
        rl.on('close', resolve);
      });

    } catch (error: any) {
      if (!state.isConnectionErrorShown()) {
        console.log(LAIN_COLORS.error(`Error: ${error.message}`));
      }
    }

    state.setAgent(null);
    state.setConnectionErrorShown(false);  // 重置
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
    state.setAgent(agent);

    setupAgentEvents(agent, null as any, false);

    try {
      await agent.init();
      const result = await agent.runLoop(request);
      console.log(LAIN_COLORS.success('\n[OK] Completed'));
    } catch (error: any) {
      if (!state.isConnectionErrorShown()) {
        console.log(LAIN_COLORS.error(`Error: ${error.message}`));
      }
    }

    state.setAgent(null);
    state.setConnectionErrorShown(false);  // 重置
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
          console.log(`  ${isDefault ? LAIN_COLORS.success('●') : '○'} ${p}${isDefault ? LAIN_COLORS.success(' (default)') : ''}`);
        });
      }

      console.log(LAIN_COLORS.primary.bold('\nBuilt-in providers:'));
      Object.entries(BUILTIN_PROVIDERS).forEach(([key, config]) => {
        const isConfigured = configured && configured.includes(key);
        console.log(`  ${isConfigured ? '●' : ' '} ${key} - ${config.name}`);
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
      const skills = listSkills(process.cwd());
      const packages = await listInstalledPackages();

      console.log(LAIN_COLORS.primary.bold('\nInstalled skill packages:'));
      if (packages.length === 0) {
        console.log(LAIN_COLORS.muted('  (none)'));
      } else {
        packages.forEach(p => {
          console.log(`  ${LAIN_COLORS.success('●')} ${p.name} v${p.version || '1.0.0'} - ${p.description}`);
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
        const skills = listSkills(process.cwd());
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
            console.log(`  ${LAIN_COLORS.success('●')} ${p.name} v${p.version || '1.0.0'}`);
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
            console.log(`  ${LAIN_COLORS.success('●')} ${s} (${toolsCount} tools)`);
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