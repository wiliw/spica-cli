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
import { TUIInputHandler } from './cli/ui/tuiInput';
import { setupAgentEvents } from './cli/events';
import { displayStatusLine } from './cli/status';
import { getRuntimeState, resetRuntimeState } from './core/RuntimeState';
import * as readline from 'readline';
import prompts from 'prompts';
import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

const program = new Command();
const state = getRuntimeState();
const ESC = '\x1b';

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

    // TUI handler (defined before try to be accessible in catch)
    let tuiHandler: TUIInputHandler | null = null;

    try {
      await agent.init();

      // 停止banner动画
      BG.stopBanner();
      await bannerPromise;

      // 清屏，准备设置滚动区域
      process.stdout.write(`${ESC}[2J${ESC}[1;1H`);

      // 自动加载历史
      if (!options.fresh) {
        const session = loadSession(process.cwd());
        if (session && session.messages && session.messages.length > 0) {
          agent.setMessages(session.messages);
        }
      }

      // TUI 输入处理（设置滚动区域）
      tuiHandler = new TUIInputHandler();
      tuiHandler.start();

      // 显示状态栏
      tuiHandler.getInputBox().showStatus(`${providerConfig.model} | strict`);

      // 启用 rawMode
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      let isProcessing = false;
      let shouldExit = false;

      // stdin 监听 - 使用 TUIInputHandler
      process.stdin.on('data', (chunk: Buffer) => {
        const result = tuiHandler.handleStdin(chunk.toString('utf8'), state.isPermissionDialogActive());

        // ESC ESC 中断
        if (result.isInterrupt) {
          if (state.getAgent()) {
            state.getAgent().interrupt();
            isProcessing = false;
            state.setProcessing(false);
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.warning('\n[INTERRUPTED]\n'));
            tuiHandler.getInputBox().render();
          }
          return;
        }

        // 退出
        if (result.shouldExit) {
          shouldExit = true;
          tuiHandler.end();
          process.stdout.write(LAIN_COLORS.error('\n[FORCE EXIT]'));
          process.exit(0);
          return;
        }

        // 处理输入
        if (result.shouldProcess && result.content.trim()) {
          handleInput(result.content.trim());
        }
      });

      // 设置agent事件监听
      setupAgentEvents(agent, tuiHandler.getInputBox(), true);

      // TUI 输出辅助函数
      const tuiPrint = (text: string) => {
        tuiHandler.getInputBox().moveToScrollArea();
        process.stdout.write(text);
        tuiHandler.getInputBox().render();
      };

      // 输入处理函数
      const handleInput = async (line: string) => {
        const trimmed = line.trim();

        // quit/exit 命令始终有效
        if (trimmed === 'quit' || trimmed === 'exit') {
          shouldExit = true;
          if (isProcessing && state.getAgent()) {
            state.getAgent().interrupt();
          }
          tuiHandler.end();
          const messages = agent.getMessages();
          saveSession(process.cwd(), messages);
          await shutdownMCP();
          state.setAgent(null);
          process.stdout.write(LAIN_COLORS.muted(`\nSession saved (${messages.length} messages)\n`));
          process.stdout.write(LAIN_COLORS.muted('Goodbye!\n'));
          process.exit(0);
          return;
        }

        // 如果正在处理，非 / 命令加入队列
        if (isProcessing && !trimmed.startsWith('/')) {
          const queue = getInputQueue();
          queue.add(trimmed);
          const status = queue.getStatus();
          tuiHandler.getInputBox().moveToScrollArea();
          process.stdout.write(LAIN_COLORS.muted(`[QUEUE] Added (${status.pending} pending)\n`));
          tuiHandler.getInputBox().render();
          return;
        }

        if (!trimmed) {
          tuiHandler.getInputBox().render();
          return;
        }

        if (trimmed === 'help') {
          showHelp();
          tuiHandler.getInputBox().render();
          return;
        }

        // === / 命令 ===
        if (trimmed.startsWith('/')) {
          const cmd = trimmed.slice(1).toLowerCase();

          // 队列管理
          if (cmd === 'queue' || cmd === 'q') {
            const queue = getInputQueue();
            const status = queue.getStatus();
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.primary.bold('\nInput Queue:\n'));
            process.stdout.write(`  Pending: ${status.pending}\n`);
            if (status.pendingPreview.length > 0) {
              process.stdout.write(LAIN_COLORS.muted('  Recent:\n'));
              status.pendingPreview.forEach((p, i) => {
                process.stdout.write(LAIN_COLORS.muted(`    ${i + 1}. ${p}\n`));
              });
            }
            process.stdout.write('\n');
            tuiHandler.getInputBox().render();
            return;
          }

          if (cmd === 'undo') {
            const queue = getInputQueue();
            const removed = queue.undoLast();
            tuiHandler.getInputBox().moveToScrollArea();
            if (removed) {
              process.stdout.write(LAIN_COLORS.muted(`\n[QUEUE] Removed: ${removed.content.slice(0, 30)}...\n`));
            } else {
              process.stdout.write(LAIN_COLORS.muted('\n[QUEUE] No pending inputs\n'));
            }
            tuiHandler.getInputBox().render();
            return;
          }

          if (cmd === 'clear' || cmd === 'reset') {
            agent.setMessages([]);
            clearInputQueue();
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.muted('\n[OK] Session cleared\n'));
            tuiHandler.getInputBox().render();
            return;
          }

          // 权限模式
          if (cmd === 'bypass') {
            agent.setBypassPermissions(true);
            state.setBypassMode(true);
            tuiHandler.getInputBox().render();
            return;
          }
          if (cmd === 'strict') {
            agent.setBypassPermissions(false);
            state.setBypassMode(false);
            tuiHandler.getInputBox().render();
            return;
          }

          // 状态
          if (cmd === 'status') {
            const bypass = agent.isBypassPermissions;
            const msgs = agent.getMessages().length;
            const queue = getInputQueue();
            const queueStatus = queue.getStatus();
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.primary.bold('\nStatus:\n'));
            process.stdout.write(`  Mode: ${bypass ? 'BYPASS' : 'STRICT'}\n`);
            process.stdout.write(`  Messages: ${msgs}\n`);
            process.stdout.write(`  Queue: ${queueStatus.pending} pending\n`);
            process.stdout.write(`  Workspace: ${agent.getWorkspacePath()}\n\n`);
            tuiHandler.getInputBox().render();
            return;
          }

          // Skills
          if (cmd === 'skills') {
            const skills = listSkills(process.cwd());
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.primary.bold('\nSkills:\n'));
            if (skills.length === 0) {
              process.stdout.write(LAIN_COLORS.muted('  (none)\n'));
            } else {
              skills.forEach(s => {
                const desc = s.description || '';
                const shortDesc = desc.length > 50 ? desc.slice(0, 50) + '...' : desc;
                process.stdout.write(LAIN_COLORS.muted(`  /${s.name} - ${shortDesc}\n`));
              });
            }
            process.stdout.write('\n');
            tuiHandler.getInputBox().render();
            return;
          }

          // 帮助
          if (cmd === 'help' || cmd === 'h') {
            showHelp();
            tuiHandler.getInputBox().render();
            return;
          }

          // 历史（显示最近消息）
          if (cmd === 'history') {
            const msgs = agent.getMessages();
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.primary.bold('\nHistory:\n'));
            if (msgs.length === 0) {
              process.stdout.write(LAIN_COLORS.muted('  (empty)\n'));
            } else {
              msgs.forEach((m, i) => {
                const role = m.role === 'user' ? 'YOU' : m.role === 'assistant' ? 'AI' : 'SYS';
                const content = m.content || '';
                process.stdout.write(LAIN_COLORS.muted(`  ${i + 1}. [${role}]\n`));
                content.split('\n').slice(0, 5).forEach(line => {
                  process.stdout.write(LAIN_COLORS.muted(`     ${line.slice(0, 60)}${line.length > 60 ? '...' : ''}\n`));
                });
              });
              process.stdout.write(LAIN_COLORS.muted(`\n  Total: ${msgs.length} messages\n`));
            }
            process.stdout.write('\n');
            tuiHandler.getInputBox().render();
            return;
          }

          // 压缩上下文
          if (cmd === 'compact') {
            const before = agent.getMessages().length;
            await agent.compact();
            const after = agent.getMessages().length;
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.secondary(`\n[COMPRESS] ${before} → ${after} messages\n`));
            tuiHandler.getInputBox().render();
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
              tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.warning('\nUsage: /skill-add <name> [promptTemplate]\n'));
              tuiHandler.getInputBox().render();
              return;
            }
            const promptTemplate = parts.slice(1).join(' ') || '{input}';
            const description = `Custom skill: ${skillName}`;
            await saveSkill(skillName, { name: skillName, description, promptTemplate });
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.success(`\n[OK] Skill added: ${skillName}\n`));
            tuiHandler.getInputBox().render();
            return;
          }

          if (cmd.startsWith('skill-remove ')) {
            const skillName = cmd.slice('skill-remove '.length).trim();
            if (!skillName) {
              tuiHandler.getInputBox().moveToScrollArea();
              process.stdout.write(LAIN_COLORS.warning('\nUsage: /skill-remove <name>\n'));
              tuiHandler.getInputBox().render();
              return;
            }
            const result = await deleteSkill(skillName);
            tuiHandler.getInputBox().moveToScrollArea();
              if (result) {
                process.stdout.write(LAIN_COLORS.success(`\n[OK] Skill removed: ${skillName}\n`));
              } else {
                process.stdout.write(LAIN_COLORS.warning(`\n[WARN] Skill not found: ${skillName}\n`));
              }
            tuiHandler.getInputBox().render();
            return;
          }

          if (cmd.startsWith('skill-edit ')) {
            const rest = cmd.slice('skill-edit '.length);
            const firstSpace = rest.indexOf(' ');
            if (firstSpace === -1) {
              tuiHandler.getInputBox().moveToScrollArea();
              process.stdout.write(LAIN_COLORS.warning('\nUsage: /skill-edit <name> <promptTemplate>\n'));
              tuiHandler.getInputBox().render();
              return;
            }
            const skillName = rest.slice(0, firstSpace);
            const promptTemplate = rest.slice(firstSpace + 1) || '{input}';
            const existing = getSkill(skillName, process.cwd());
            if (!existing) {
              tuiHandler.getInputBox().moveToScrollArea();
              process.stdout.write(LAIN_COLORS.warning(`\n[WARN] Skill not found: ${skillName}\n`));
              tuiHandler.getInputBox().render();
              return;
            }
            await saveSkill(skillName, { ...existing, promptTemplate });
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.success(`\n[OK] Skill updated: ${skillName}\n`));
            tuiHandler.getInputBox().render();
            return;
          }

          // Skill 调用（/skill_name args）
          const skillInput = parseSkillInput(trimmed, process.cwd());
          if (skillInput) {
            const skill = getSkill(skillInput.skillName, process.cwd());
            if (skill) {
              const prompt = buildSkillPrompt(skill, skillInput.args);
              tuiHandler.getInputBox().moveToScrollArea();
              process.stdout.write(LAIN_COLORS.muted(`\n[${skill.name}] ${skill.description}\n`));
              isProcessing = true;
              state.setProcessing(true);
              try {
                await agent.runLoop(prompt);
                tuiHandler.getInputBox().moveToScrollArea();
                process.stdout.write(LAIN_COLORS.success('\n[OK] Done\n'));
              } catch (error: any) {
                tuiHandler.getInputBox().moveToScrollArea();
                process.stdout.write(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
              }
              isProcessing = false;
              state.setProcessing(false);
              saveSession(process.cwd(), agent.getMessages());
              await processQueue(agent);
              displayStatusLine();  // 只在完成时显示一次
              tuiHandler.getInputBox().render();
              return;
            }
          }

          // 未知的 / 命令
          tuiHandler.getInputBox().moveToScrollArea();
          process.stdout.write(LAIN_COLORS.warning(`\nUnknown command: ${trimmed}\n`));
          process.stdout.write(LAIN_COLORS.muted('Type /h for help\n'));
          tuiHandler.getInputBox().render();
          return;
        }

        // === 执行请求 ===
        // 先显示用户输入在输出区
        tuiHandler.getInputBox().moveToScrollArea();
        process.stdout.write(LAIN_COLORS.primary(`\n> ${trimmed}\n`));

        isProcessing = true;
        state.setProcessing(true);

        // 显示处理状态
        process.stdout.write(LAIN_COLORS.muted('Processing... (ESC ESC to interrupt)\n'));

        try {
          await agent.runLoop(trimmed);
          if (state.isStreamingOutput()) {
            state.setStreamingOutput(false);
            process.stdout.write('\n');
          }
          process.stdout.write(LAIN_COLORS.success('\n[OK] Done\n'));
        } catch (error: any) {
          if (state.isStreamingOutput()) {
            state.setStreamingOutput(false);
            process.stdout.write('\n');
          }
          process.stdout.write(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
        }
        isProcessing = false;
        state.setProcessing(false);
        saveSession(process.cwd(), agent.getMessages());
        await processQueue(agent);
        // 重绘输入框
        tuiHandler.getInputBox().render();
      };

      // 帮助信息
      const showHelp = () => {
        tuiHandler.getInputBox().moveToScrollArea();
        process.stdout.write(LAIN_COLORS.primary.bold('\nCommands:\n'));
        process.stdout.write(LAIN_COLORS.muted('  quit/exit   Exit\n'));
        process.stdout.write(LAIN_COLORS.muted('  help        Show help\n'));
        process.stdout.write('\n');
        process.stdout.write(LAIN_COLORS.primary.bold('Session:\n'));
        process.stdout.write(LAIN_COLORS.muted('  /clear      Clear session\n'));
        process.stdout.write(LAIN_COLORS.muted('  /history    Show messages\n'));
        process.stdout.write(LAIN_COLORS.muted('  /compact    Compress context\n'));
        process.stdout.write('\n');
        process.stdout.write(LAIN_COLORS.primary.bold('Queue:\n'));
        process.stdout.write(LAIN_COLORS.muted('  /queue      Show queue\n'));
        process.stdout.write(LAIN_COLORS.muted('  /undo       Remove last input\n'));
        process.stdout.write('\n');
        process.stdout.write(LAIN_COLORS.primary.bold('Mode:\n'));
        process.stdout.write(LAIN_COLORS.muted('  /bypass     Auto-approve\n'));
        process.stdout.write(LAIN_COLORS.muted('  /strict     Ask permission\n'));
        process.stdout.write('\n');
        process.stdout.write(LAIN_COLORS.primary.bold('Skills:\n'));
        process.stdout.write(LAIN_COLORS.muted('  /skills     List skills\n'));
        process.stdout.write('\n');
      };

      // 处理队列中的输入
      const processQueue = async (agent: SpicaAgent) => {
        const queue = getInputQueue();
        if (!queue.hasPending()) return;

        tuiHandler.getInputBox().moveToScrollArea();
        process.stdout.write(LAIN_COLORS.muted(`\n[QUEUE] Processing ${queue.getStatus().pending} inputs...\n`));
        const mergedInput = queue.mergePending();

        if (mergedInput) {
          tuiHandler.getInputBox().moveToScrollArea();
          process.stdout.write(LAIN_COLORS.muted(`\nCombined input:\n${mergedInput.slice(0, 100)}${mergedInput.length > 100 ? '...' : ''}\n`));
          isProcessing = true;
          state.setProcessing(true);
          try {
            await agent.runLoop(mergedInput);
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.success('\n[OK] Done\n'));
          } catch (error: any) {
            tuiHandler.getInputBox().moveToScrollArea();
            process.stdout.write(LAIN_COLORS.error(`\n[ERR] Error: ${error.message}\n`));
          }
          isProcessing = false;
          state.setProcessing(false);
          saveSession(process.cwd(), agent.getMessages());
        }
      };

      // 保持进程运行
      await new Promise<void>((resolve) => {
        process.on('exit', resolve);
      });

    } catch (error: any) {
      if (!state.isConnectionErrorShown()) {
        if (tuiHandler) {
          tuiHandler.getInputBox().moveToScrollArea();
          process.stdout.write(LAIN_COLORS.error(`\nError: ${error.message}\n`));
        } else {
          console.log(LAIN_COLORS.error(`Error: ${error.message}`));
        }
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
          console.log(`  ${LAIN_COLORS.success('●')} ${p.name} (${p.skills.length} skills)`);
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
            console.log(`  ${LAIN_COLORS.success('●')} ${p.name}`);
            console.log(LAIN_COLORS.muted(`    Skills: ${p.skills.join(', ')}`));
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