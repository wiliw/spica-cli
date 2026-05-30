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

import { getScreenManager } from './cli/ui/screenManager';
import { TokenCounter } from './llm/TokenCounter';
import * as readline from 'readline';
import prompts from 'prompts';
import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

const program = new Command();
const state = getRuntimeState();
const screen = getScreenManager();
const ESC = '\x1b';

// Ctrl+C中断处理（SIGINT - 在非 raw mode 或特殊情况下触发）
let interruptCount = 0;
let interruptTimeout: NodeJS.Timeout | null = null;
let tuiStarted = false;  // 标记 TUI 是否已启动

process.on('SIGINT', () => {
  // 连续Ctrl+C强制退出
  interruptCount++;
  if (interruptCount >= 3) {
    if (tuiStarted) screen.end();
    console.log(LAIN_COLORS.error('\n[FORCE EXIT]'));
    process.exit(0);
  }

  // 重置计数器（1秒内没有第二次Ctrl+C）
  if (interruptTimeout) clearTimeout(interruptTimeout);
  interruptTimeout = setTimeout(() => {
    interruptCount = 0;
  }, 1000);

  if (state.getAgent()) {
    state.getAgent()!.interrupt();
    state.setProcessing(false);
    if (tuiStarted) {
      screen.appendScroll(LAIN_COLORS.warning('\n[INTERRUPTED] Ctrl+C again to exit\n'));
      screen.setStreaming(false);
      screen.restoreCursor();
      screen.refreshInput();
    } else {
      console.log(LAIN_COLORS.warning('\n[INTERRUPTED] Ctrl+C again to exit'));
    }
  } else {
    if (tuiStarted) screen.end();
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
  .option('--no-tui', 'Run in non-interactive mode (no TUI, simple output)')
  .action(async (options: { fresh?: boolean; provider?: string; noTui?: boolean }) => {
    const config = await loadConfig();
    const providerName = options.provider || config.defaultProvider || 'openai';

    // 检测是否支持交互式终端
    const isInteractiveTerminal = process.stdin.isTTY && process.stdout.isTTY;
    const useSimpleMode = options.noTui || !isInteractiveTerminal;

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

    // 如果是非交互模式，使用简单输出
    if (useSimpleMode) {
      console.log(LAIN_COLORS.muted('[INFO] Running in non-interactive mode (no TUI)'));
      await runSimpleMode(agent, options.fresh);
      return;
    }

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
      screen.appendScroll(`${ESC}[2J${ESC}[1;1H`);

      // TUI 输入处理（设置滚动区域）
      tuiHandler = new TUIInputHandler();
      tuiHandler.start();
      tuiStarted = true;  // 标记 TUI 已启动

      // 自动加载历史
      if (!options.fresh) {
        const session = loadSession(process.cwd());
        if (session && session.messages && session.messages.length > 0) {
          agent.setMessages(session.messages);
          // 显示加载历史提示（在滚动区域）
          
          screen.appendScroll(LAIN_COLORS.muted(`Loaded ${session.messages.length} messages from history\n`));
        }
      }

      // Tab 补全命令列表
      const BASE_COMMANDS = [
        '/help', '/h', '/status', '/bypass', '/strict',
        '/queue', '/q', '/undo', '/clear', '/reset',
        '/skills', '/skill-add', '/skill-remove', '/skill-edit',
        '/history', '/compact', '/init',
      ];
      const getCommands = () => {
        const skills = listSkills(process.cwd());
        const skillCommands = skills.map(s => `/${s.name}`);
        return [...BASE_COMMANDS, ...skillCommands];
      };
      tuiHandler.getScreen().setCompleter((line: string) => {
        return getCommands().filter(c => c.startsWith(line));
      });

      // 显示状态栏（简洁版）
      const updateStatusBar = () => {
        const mode = state.isBypassMode() ? 'bypass' : 'strict';
        screen.setStatus(`${providerConfig.model} | ${mode}`);
      };
      updateStatusBar();

      // 设置 Ctrl+O 切换回调
      screen.setVerboseToggleCallback(() => {
        const newMode = state.toggleVerboseMode();
        screen.appendScroll(LAIN_COLORS.secondary(`\n[MODE] ${newMode ? 'Verbose' : 'Compact'} display enabled\n`));
        updateStatusBar();
        screen.restoreCursor();
        screen.refreshInput();
      });

      // 启用 Bracketed Paste Mode（粘贴内容作为整体到达）
      screen.appendScroll(`${ESC}[?2004h`);

      // 启用 rawMode
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      let isProcessing = false;
      let shouldExit = false;

      // stdin 监听 - 使用 TUIInputHandler
      process.stdin.on('data', (chunk: Buffer) => {
        const result = tuiHandler!.handleStdin(chunk.toString('utf8'), state.isPermissionDialogActive());

        // ESC ESC 中断
        if (result.isInterrupt) {
          if (state.getAgent()) {
            state.getAgent()!.interrupt();
            isProcessing = false;
            state.setProcessing(false);

            screen.appendScroll(LAIN_COLORS.warning('\n[INTERRUPTED]\n'));
            screen.setStreaming(false);
            screen.restoreCursor();
            screen.refreshInput();
          }
          return;
        }

        // 退出
        if (result.shouldExit) {
          shouldExit = true;
          // 禁用 Bracketed Paste Mode
          screen.appendScroll(`${ESC}[?2004l`);
          tuiHandler!.end();
          screen.appendScroll(LAIN_COLORS.error('\n[FORCE EXIT]'));
          process.exit(0);
          return;
        }

        // 处理输入
        if (result.shouldProcess && result.content.trim()) {
          handleInput(result.content.trim());
        }
      });

      // 设置agent事件监听
      setupAgentEvents(agent, true, providerConfig.model);

      // TUI 输出辅助函数（已简化）

      // 输入处理函数
      const handleInput = async (line: string) => {
        const trimmed = line.trim();

        // quit/exit 命令始终有效
        if (trimmed === 'quit' || trimmed === 'exit') {
          shouldExit = true;
          if (isProcessing && state.getAgent()) {
            state.getAgent()!.interrupt();
          }
          // 禁用 Bracketed Paste Mode
          screen.appendScroll(`${ESC}[?2004l`);
          tuiHandler!.end();
          const messages = agent.getMessages();
          saveSession(process.cwd(), messages);
          await shutdownMCP();
          state.setAgent(null);
          screen.appendScroll(LAIN_COLORS.muted(`\nSession saved (${messages.length} messages)\n`));
          screen.appendScroll(LAIN_COLORS.muted('Goodbye!\n'));
          process.exit(0);
          return;
        }

        // 如果正在处理，使用队列累积输入
        if (isProcessing && !trimmed.startsWith('/')) {
          const queue = getInputQueue();
          queue.add(trimmed);
          const status = queue.getStatus();
          screen.appendScroll(LAIN_COLORS.muted(`[QUEUE] Added (${status.pending} pending)\n`));
          return;
        }

        // CRITICAL FIX: 在处理前合并 queue（而不是结束后）
        const queue = getInputQueue();
        let finalInput = trimmed;
        if (queue.hasPending() && !trimmed.startsWith('/')) {
          finalInput = queue.mergePending() + '\n' + trimmed;
          screen.appendScroll(LAIN_COLORS.muted(`[QUEUE] Merged ${queue.getStatus().total} inputs\n`));
        }

        if (!finalInput.trim()) {
          return;
        }

        if (trimmed === 'help') {
          showHelp();
          
          return;
        }

        // === / 命令 ===
        if (trimmed.startsWith('/')) {
          const cmd = trimmed.slice(1).toLowerCase();

          // 队列管理
          if (cmd === 'queue' || cmd === 'q') {
            const queue = getInputQueue();
            const status = queue.getStatus();
            
            screen.appendScroll(LAIN_COLORS.primary.bold('\nInput Queue:\n'));
            screen.appendScroll(`  Pending: ${status.pending}\n`);
            if (status.pendingPreview.length > 0) {
              screen.appendScroll(LAIN_COLORS.muted('  Recent:\n'));
              status.pendingPreview.forEach((p, i) => {
                screen.appendScroll(LAIN_COLORS.muted(`    ${i + 1}. ${p}\n`));
              });
            }
            screen.appendScroll('\n');
            
            return;
          }

          if (cmd === 'undo') {
            const queue = getInputQueue();
            const removed = queue.undoLast();
            
            if (removed) {
              screen.appendScroll(LAIN_COLORS.muted(`\n[QUEUE] Removed: ${removed.content.slice(0, 30)}...\n`));
            } else {
              screen.appendScroll(LAIN_COLORS.muted('\n[QUEUE] No pending inputs\n'));
            }
            
            return;
          }

          if (cmd === 'clear' || cmd === 'reset') {
            agent.setMessages([]);
            clearInputQueue();

            screen.appendScroll(LAIN_COLORS.muted('\n[OK] Session cleared\n'));

            return;
          }

          // 会话管理
          if (cmd === 'sessions' || cmd === 's') {
            const { listSessions } = await import('./utils/session');
            const { getTaskStats } = await import('./storage/taskPersistence');
            const sessions = listSessions(process.cwd());
            const taskStats = getTaskStats(process.cwd());
            const currentMsgs = agent.getMessages().length;

            screen.appendScroll(LAIN_COLORS.primary.bold('\nSessions:\n'));
            screen.appendScroll(`  Current: ${currentMsgs} messages\n`);
            screen.appendScroll(`  Archived: ${sessions.length} sessions\n`);
            screen.appendScroll(`  Tasks: ${taskStats.total} (${taskStats.completed} done, ${taskStats.in_progress} active)\n`);

            if (sessions.length > 0) {
              screen.appendScroll(LAIN_COLORS.muted('\n  Recent sessions:\n'));
              sessions.slice(0, 5).forEach((s, i) => {
                const date = new Date(s.lastActivity).toLocaleDateString();
                screen.appendScroll(LAIN_COLORS.muted(`    ${i + 1}. ${s.name} (${s.messageCount} msgs, ${date})\n`));
              });
              if (sessions.length > 5) {
                screen.appendScroll(LAIN_COLORS.muted(`    ... and ${sessions.length - 5} more\n`));
              }
            }

            screen.appendScroll(LAIN_COLORS.muted('\n  Commands: /switch <id>, /rename <name>, /delete <id>\n'));
            screen.appendScroll('\n');

            return;
          }

          if (cmd.startsWith('switch ')) {
            const sessionId = cmd.slice(7).trim();
            const { switchSession } = await import('./utils/session');

            if (switchSession(process.cwd(), sessionId)) {
              screen.appendScroll(LAIN_COLORS.success(`\n[OK] Switched to session ${sessionId}\n`));
              screen.appendScroll(LAIN_COLORS.muted('Session loaded. Continue conversation.\n'));
            } else {
              screen.appendScroll(LAIN_COLORS.error(`\n[ERR] Session ${sessionId} not found\n`));
              screen.appendScroll(LAIN_COLORS.muted('Use /sessions to list available sessions.\n'));
            }

            return;
          }

          if (cmd.startsWith('rename ')) {
            const args = cmd.slice(7).trim();
            const parts = args.split(' ');
            const sessionId = parts[0];
            const newName = parts.slice(1).join(' ') || 'Unnamed';
            const { renameSession } = await import('./utils/session');

            if (renameSession(process.cwd(), sessionId, newName)) {
              screen.appendScroll(LAIN_COLORS.success(`\n[OK] Session renamed to: ${newName}\n`));
            } else {
              screen.appendScroll(LAIN_COLORS.error(`\n[ERR] Failed to rename session ${sessionId}\n`));
            }

            return;
          }

          // 权限模式
          if (cmd === 'bypass') {
            agent.setBypassPermissions(true);
            state.setBypassMode(true);
            
            return;
          }
          if (cmd === 'strict') {
            agent.setBypassPermissions(false);
            state.setBypassMode(false);
            
            return;
          }

          // 状态
          if (cmd === 'status') {
            const bypass = agent.isBypassPermissions;
            const msgs = agent.getMessages().length;
            const queue = getInputQueue();
            const queueStatus = queue.getStatus();

            // Token 计数
            const tokenCounter = new TokenCounter();
            const provider = agent.getLLM()?.getProvider();
            if (provider) {
              tokenCounter.setContextWindow(provider.getContextWindow());
            }
            const usedTokens = tokenCounter.estimateMessages(agent.getMessages());
            const contextWindow = provider?.getContextWindow() || 128000;
            const usagePercent = usedTokens / contextWindow * 100;

            screen.appendScroll(LAIN_COLORS.primary.bold('\nStatus:\n'));
            screen.appendScroll(`  Mode: ${bypass ? 'BYPASS' : 'STRICT'}\n`);
            screen.appendScroll(`  Messages: ${msgs}\n`);
            screen.appendScroll(`  Tokens: ${usedTokens} (${usagePercent.toFixed(1)}% of ${Math.floor(contextWindow/1000)}k)\n`);
            screen.appendScroll(`  Queue: ${queueStatus.pending} pending\n`);
            screen.appendScroll(`  Workspace: ${agent.getWorkspacePath()}\n\n`);

            return;
          }

          // Skills
          if (cmd === 'skills') {
            const skills = listSkills(process.cwd());
            
            screen.appendScroll(LAIN_COLORS.primary.bold('\nSkills:\n'));
            if (skills.length === 0) {
              screen.appendScroll(LAIN_COLORS.muted('  (none)\n'));
            } else {
              skills.forEach(s => {
                const desc = s.description || '';
                const shortDesc = desc.length > 50 ? desc.slice(0, 50) + '...' : desc;
                screen.appendScroll(LAIN_COLORS.muted(`  /${s.name} - ${shortDesc}\n`));
              });
            }
            screen.appendScroll('\n');
            
            return;
          }

          // 帮助
          if (cmd === 'help' || cmd === 'h') {
            showHelp();
            
            return;
          }

          // 历史（显示最近消息）
          if (cmd === 'history') {
            const msgs = agent.getMessages();
            
            screen.appendScroll(LAIN_COLORS.primary.bold('\nHistory:\n'));
            if (msgs.length === 0) {
              screen.appendScroll(LAIN_COLORS.muted('  (empty)\n'));
            } else {
              msgs.forEach((m, i) => {
                const role = m.role === 'user' ? 'YOU' : m.role === 'assistant' ? 'AI' : 'SYS';
                const content = m.content || '';
                screen.appendScroll(LAIN_COLORS.muted(`  ${i + 1}. [${role}]\n`));
                content.split('\n').slice(0, 5).forEach(line => {
                  screen.appendScroll(LAIN_COLORS.muted(`     ${line.slice(0, 60)}${line.length > 60 ? '...' : ''}\n`));
                });
              });
              screen.appendScroll(LAIN_COLORS.muted(`\n  Total: ${msgs.length} messages\n`));
            }
            screen.appendScroll('\n');
            
            return;
          }

          // 压缩上下文
          if (cmd === 'compact') {
            await agent.compact();
            // compact 内部已 emit context_compressed 事件，无需重复输出
            screen.restoreCursor();
            return;
          }

          // Init - 让AI分析代码库并创建 AGENTS.md
          if (cmd === 'init' || cmd.startsWith('init ')) {
            // 提取用户额外指令
            const userArgs = cmd.startsWith('init ') ? cmd.slice(5).trim() : '';

            const initPrompt = `I am using the init skill to analyze the codebase and create AGENTS.md.

<HARD-GATE>
Before outputting any document, you must:
1. Complete all analysis steps
2. Understand the project's core architecture
3. Verify all commands are actually available
</HARD-GATE>

## Analysis Steps (must complete in order)

- [ ] **Step 1: Read project config**
  - package.json / Cargo.toml / setup.py / pyproject.toml etc.
  - Identify: language, framework, dependencies, script commands

- [ ] **Step 2: Read existing documentation**
  - README.md / CHANGELOG.md / docs/ directory
  - Understand: project purpose, features, usage

- [ ] **Step 3: View directory structure**
  - List src/ lib/ app/ tests/ and other main directories
  - Identify entry points: index.ts / main.py / app.js etc.

- [ ] **Step 4: Check test and build configuration**
  - Test framework, test commands, CI configuration
  - Build/package configuration

- [ ] **Step 5: Review core code**
  - Implementation of main modules
  - Data flow and architecture patterns

## Document Structure

If AGENTS.md exists, preserve valuable content and supplement updates. If not, create a new file.

Must include the following sections:

### Project Overview
- Type: CLI tool / Web application / Library / Service
- Purpose: One-sentence description of core functionality
- Use case: Target users and usage scenarios

### Tech Stack
- Language and version requirements
- Core frameworks/libraries (only key ones, max 5)
- Runtime environment requirements

### Project Structure
Use a table to list key directories and files:
| Directory/File | Purpose |
|----------------|---------|
| src/           | ...     |

### Development Commands
List verified available commands:
- Dev: npm run dev
- Build: npm run build
- Test: npm test
- Other key commands

### Core Architecture
- Main modules and responsibilities (max 3-4)
- Data flow/processing flow (one sentence)
- Key design patterns

### Development Notes
- Code style highlights
- Common pitfalls (if found)
- Modules requiring special attention

## Anti-Pattern Warnings

| Thought | Correct Approach |
|---------|------------------|
| "Just write a random overview" | Must be based on actual analysis, cite specific files |
| "List all dependencies" | Only list core dependencies, don't copy entire package.json |
| "Guess commands" | Must verify commands exist and are usable |
| "Write lengthy architecture docs" | Keep it concise, AI agents need quick understanding |

${userArgs ? `\n## Additional Instructions\n${userArgs}\n` : ''}
Start the analysis, execute step by step, then output the document.`;

            handleInput(initPrompt);
            return;
          }

          // 动态 skill 管理
          if (cmd.startsWith('skill-add ')) {
            const parts = cmd.slice('skill-add '.length).split(' ');
            const skillName = parts[0];
            if (!skillName) {
              
            screen.appendScroll(LAIN_COLORS.warning('\nUsage: /skill-add <name> [promptTemplate]\n'));
              
              return;
            }
            const promptTemplate = parts.slice(1).join(' ') || '{input}';
            const description = `Custom skill: ${skillName}`;
            await saveSkill(skillName, { name: skillName, description, promptTemplate });
            
            screen.appendScroll(LAIN_COLORS.success(`\n[OK] Skill added: ${skillName}\n`));
            
            return;
          }

          if (cmd.startsWith('skill-remove ')) {
            const skillName = cmd.slice('skill-remove '.length).trim();
            if (!skillName) {
              
              screen.appendScroll(LAIN_COLORS.warning('\nUsage: /skill-remove <name>\n'));
              
              return;
            }
            const result = await deleteSkill(skillName);
            
              if (result) {
                screen.appendScroll(LAIN_COLORS.success(`\n[OK] Skill removed: ${skillName}\n`));
              } else {
                screen.appendScroll(LAIN_COLORS.warning(`\n[WARN] Skill not found: ${skillName}\n`));
              }
            
            return;
          }

          if (cmd.startsWith('skill-edit ')) {
            const rest = cmd.slice('skill-edit '.length);
            const firstSpace = rest.indexOf(' ');
            if (firstSpace === -1) {
              
              screen.appendScroll(LAIN_COLORS.warning('\nUsage: /skill-edit <name> <promptTemplate>\n'));
              
              return;
            }
            const skillName = rest.slice(0, firstSpace);
            const promptTemplate = rest.slice(firstSpace + 1) || '{input}';
            const existing = getSkill(skillName, process.cwd());
            if (!existing) {
              
              screen.appendScroll(LAIN_COLORS.warning(`\n[WARN] Skill not found: ${skillName}\n`));
              
              return;
            }
            await saveSkill(skillName, { ...existing, promptTemplate });
            
            screen.appendScroll(LAIN_COLORS.success(`\n[OK] Skill updated: ${skillName}\n`));
            
            return;
          }

          // Skill 调用（/skill_name args）
          const skillInput = parseSkillInput(trimmed, process.cwd());
          if (skillInput) {
            const skill = getSkill(skillInput.skillName, process.cwd());
            if (skill) {
              const prompt = buildSkillPrompt(skill, skillInput.args);

              screen.appendScroll(LAIN_COLORS.muted(`\n[${skill.name}] ${skill.description}\n`));
              isProcessing = true;
              state.setProcessing(true);
              try {
                await agent.runLoop(prompt);
                screen.setStreaming(false);
                screen.appendScroll(LAIN_COLORS.success('\n[OK] Done\n'));
              } catch (error: any) {
                screen.setStreaming(false);
                screen.appendScroll(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
              }
              screen.restoreCursor();
              screen.refreshInput();
              isProcessing = false;
              state.setProcessing(false);
              saveSession(process.cwd(), agent.getMessages());
              
              return;
            }
          }

          // 未知的 / 命令
          screen.appendScroll(LAIN_COLORS.warning(`\nUnknown command: ${trimmed}\n`));
          screen.appendScroll(LAIN_COLORS.muted('Type /h for help\n'));
          return;
        }

        // === 执行请求 ===
        // 先显示用户输入在输出区
        screen.appendScroll(LAIN_COLORS.primary(`\n> ${finalInput.slice(0, 100)}${finalInput.length > 100 ? '...' : ''}\n`));

        isProcessing = true;
        state.setProcessing(true);

        // 显示处理状态（心跳由 waiting_for_llm 事件自动启动）
        screen.appendScroll(LAIN_COLORS.muted('Processing... (ESC ESC to interrupt)\n'));

        try {
          const result = await agent.runLoop(finalInput);
          if (state.isStreamingOutput()) {
            state.setStreamingOutput(false);
            screen.setStreaming(false);
            screen.appendScroll('\n');
          }

          screen.appendScroll(LAIN_COLORS.success('\n[OK] Done\n'));
        } catch (error: any) {
          if (state.isStreamingOutput()) {
            state.setStreamingOutput(false);
            screen.setStreaming(false);
            screen.appendScroll('\n');
          }
          screen.appendScroll(LAIN_COLORS.error(`\n[ERR] ${error.message}\n`));
        }
        // 输出完成，恢复光标到输入框并刷新显示
        screen.setStreaming(false);
        screen.restoreCursor();
        screen.refreshInput();
        isProcessing = false;
        state.setProcessing(false);
        saveSession(process.cwd(), agent.getMessages());
      };

      // 帮助信息
      const showHelp = () => {

        screen.appendScroll(LAIN_COLORS.primary.bold('\nCommands:\n'));
        screen.appendScroll(LAIN_COLORS.muted('  quit/exit   Exit\n'));
        screen.appendScroll(LAIN_COLORS.muted('  help        Show help\n'));
        screen.appendScroll('\n');
        screen.appendScroll(LAIN_COLORS.primary.bold('Session:\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /clear      Clear session\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /history    Show messages\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /compact    Compress context\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /sessions   List archived sessions\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /switch <id> Switch to session\n'));
        screen.appendScroll('\n');
        screen.appendScroll(LAIN_COLORS.primary.bold('Queue:\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /queue      Show queue\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /undo       Remove last input\n'));
        screen.appendScroll('\n');
        screen.appendScroll(LAIN_COLORS.primary.bold('Mode:\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /bypass     Auto-approve\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /strict     Ask permission\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /status     Show status\n'));
        screen.appendScroll('\n');
        screen.appendScroll(LAIN_COLORS.primary.bold('Skills:\n'));
        screen.appendScroll(LAIN_COLORS.muted('  /skills     List skills\n'));
        screen.appendScroll('\n');
      };

      // 保持进程运行
      await new Promise<void>((resolve) => {
        process.on('exit', resolve);
      });

    } catch (error: any) {
      if (!state.isConnectionErrorShown()) {
        if (tuiHandler) {
          
          screen.appendScroll(LAIN_COLORS.error(`\nError: ${error.message}\n`));
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

    setupAgentEvents(agent, false);

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

        if ((currentSettings.mcp?.servers?.length ?? 0) > 0) {
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

// 非交互模式运行函数
async function runSimpleMode(agent: SpicaAgent, fresh?: boolean): Promise<void> {
  try {
    await agent.init();

    // 设置简单的事件处理（无 TUI）
    agent.on('stream', (data: any) => {
      process.stdout.write(data.chunk);
    });

    agent.on('reasoning', (data: any) => {
      process.stdout.write(LAIN_COLORS.reasoning(data.content));
    });

    agent.on('tool_call', (data: any) => {
      console.log(LAIN_COLORS.tool(`\n[TOOL] ${data.name}`));
    });

    agent.on('tool_result', (data: any) => {
      const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
      console.log(`${icon} ${data.name}`);
      if (data.error) {
        console.log(LAIN_COLORS.error(`  Error: ${data.error.slice(0, 100)}`));
      }
    });

    agent.on('message', (data: any) => {
      if (data.role === 'assistant') {
        console.log(); // 新行
      }
    });

    agent.on('context_compressed', (data: any) => {
      console.log(LAIN_COLORS.secondary(`\n[COMPRESS] ${data.before} -> ${data.after} messages`));
    });

    agent.on('connection_error', (data: any) => {
      console.log(LAIN_COLORS.error(`\nConnection Error: ${data.type}`));
      console.log(LAIN_COLORS.muted(data.hint));
    });

    const providerConfig = state.getProviderConfig();
    const model = providerConfig?.model || 'unknown';
    console.log(LAIN_COLORS.success(`[OK] Connected to ${model}`));
    console.log(LAIN_COLORS.muted('\nNon-interactive mode: type your request and press Enter'));
    console.log(LAIN_COLORS.muted('Press Ctrl+C to exit, Ctrl+D to interrupt'));

    // 清空历史（如果指定）
    if (fresh) {
      agent.setMessages([]);
      console.log(LAIN_COLORS.muted('[INFO] Session cleared'));
    }

    // 简单的 readline 模式
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    rl.prompt();

    rl.on('line', async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      // 处理特殊命令
      if (trimmed === 'quit' || trimmed === 'exit') {
        rl.close();
        return;
      }

      if (trimmed === 'help') {
        console.log('Commands: quit, exit, help, /clear, /compact, /history, /status');
        rl.prompt();
        return;
      }

      if (trimmed.startsWith('/')) {
        const cmd = trimmed.slice(1).toLowerCase();
        if (cmd === 'clear') {
          agent.setMessages([]);
          console.log(LAIN_COLORS.muted('[OK] Session cleared'));
        } else if (cmd === 'compact') {
          await agent.compact();
        } else if (cmd === 'history') {
          const messages = agent.getMessages();
          console.log(LAIN_COLORS.muted(`\n[History] ${messages.length} messages`));
        } else if (cmd === 'status') {
          const messages = agent.getMessages();
          console.log(LAIN_COLORS.primary(`\n[Status]`));
          console.log(`  Messages: ${messages.length}`);
          console.log(`  Mode: ${state.isBypassMode() ? 'bypass' : 'strict'}`);
        } else {
          console.log(LAIN_COLORS.warning(`Unknown command: ${trimmed}`));
        }
        rl.prompt();
        return;
      }

      // 执行请求
      try {
        console.log(LAIN_COLORS.muted('\n[PROCESSING]...'));
        const response = await agent.runLoop(trimmed);
        console.log(LAIN_COLORS.success('\n[OK] Done'));
      } catch (error: any) {
        console.log(LAIN_COLORS.error(`\n[ERR] ${error.message}`));
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log(LAIN_COLORS.muted('\n[EXIT] Goodbye!'));
      saveSession(process.cwd(), agent.getMessages());
      process.exit(0);
    });

  } catch (error: any) {
    console.log(LAIN_COLORS.error(`Error: ${error.message}`));
    process.exit(1);
  }
}

program.parse();