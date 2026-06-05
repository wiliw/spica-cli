#!/usr/bin/env node
import { Command } from "commander";
import { SpicaAgent } from "./agent";
import {
  loadGlobalSettings,
  saveGlobalSettings,
  getProviderConfig,
  setProviderConfig,
  listProviders,
  setDefaultProvider,
  GLOBAL_SETTINGS_FILE,
} from "./utils/settings";
import { loadSession, saveSession } from "./utils/session";
import {
  parseSkillInput,
  getSkill,
  buildSkillPrompt,
  listSkills,
  installSkill,
  uninstallSkill,
  listInstalledPackages,
  saveSkill,
  deleteSkill,
} from "./skills";
import {
  listCheckpoints,
  getCheckpoint,
  restoreCheckpoint,
  cleanCheckpoints,
} from "./storage/checkpointManager";
import os from "os";
import { playBell } from "./utils/bell";

import {
  getMCPManager,
  generateExampleConfig,
  shutdownMCP,
} from "./mcp/client";
import { COLORS, BG } from "./cli/ui/colors";
import { getInputQueue, clearInputQueue } from "./cli/ui/queue";
import { autoDrainQueue } from "./cli/queueDrain";
import { TUIInputHandler } from "./cli/ui/tuiInput";
import { setupAgentEvents, formatRunStats } from "./cli/events";
import { updateStatusBar, setUpdateStatusBarFn } from "./cli/status";
import { getRuntimeState } from "./core/RuntimeState";

import { getScreenManager } from "./cli/ui/screenManager";
import { TokenCounter } from "./llm/TokenCounter";
import * as readline from "readline";
import prompts from "prompts";

import { join } from "path";

const program = new Command();
const state = getRuntimeState();
const screen = getScreenManager();
const ESC = "\x1b";

// Ctrl+C中断处理（SIGINT - 在非 raw mode 或特殊情况下触发）
let interruptCount = 0;
let interruptTimeout: NodeJS.Timeout | null = null;
let tuiStarted = false; // 标记 TUI 是否已启动

process.on("SIGINT", () => {
  // 连续Ctrl+C强制退出
  interruptCount++;
  if (interruptCount >= 3) {
    if (tuiStarted) screen.end();
    console.log(COLORS.error("\n[FORCE EXIT]"));
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
    updateStatusBar();
    if (tuiStarted) {
      screen.appendScroll(
        COLORS.warning("\n[INTERRUPTED] Ctrl+C again to exit\n"),
      );
      screen.setStreaming(false);
      screen.restoreCursor();
      screen.refreshInput();
    } else {
      console.log(COLORS.warning("\n[INTERRUPTED] Ctrl+C again to exit"));
    }
  } else {
    if (tuiStarted) screen.end();
    process.exit(0);
  }
});

program
  .name("spica")
  .description("AI coding assistant")
  .version("1.0.0")
  .addHelpText(
    "after",
    '\nExamples:\n  spica                    Start interactive session\n  spica run "fix bug"      Execute one task\n  spica set openai https://api.openai.com/v1 sk-xxx gpt-4o\n\nInternal commands (in session):\n  /checkpoint, /skill, /mcp, /session, /queue, /status, /help',
  );

// 默认：持续对话模式（自动加载历史）
program
  .option("-f, --fresh", "Start fresh session (no history)")
  .option("-p, --provider <name>", "Use specific provider")
  .option("--no-tui", "Run in non-interactive mode (no TUI, simple output)")
  .action(
    async (options: {
      fresh?: boolean;
      provider?: string;
      noTui?: boolean;
    }) => {
      const config = await loadGlobalSettings();
      const providerName =
        options.provider || config.defaultProvider || "openai";

      // 检测是否支持交互式终端
      const isInteractiveTerminal = process.stdin.isTTY && process.stdout.isTTY;
      const useSimpleMode = options.noTui || !isInteractiveTerminal;

      let providerConfig;
      try {
        providerConfig = await getProviderConfig(providerName);
        state.setProviderConfig(providerConfig);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log("");
        console.log(COLORS.error(errorMsg));
        console.log("");
        return;
      }

      const agent = new SpicaAgent(providerName, process.cwd());
      state.setAgent(agent);

      // 如果是非交互模式，使用简单输出
      if (useSimpleMode) {
        console.log(
          COLORS.muted("[INFO] Running in non-interactive mode (no TUI)"),
        );
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
        tuiStarted = true;

        // 自动加载历史
        if (!options.fresh) {
          const session = loadSession(agent.getWorkspacePath());
          if (session && session.messages && session.messages.length > 0) {
            agent.setMessages(session.messages);
            // 显示加载历史提示（在滚动区域）

            screen.appendScroll(
              COLORS.muted(
                `Loaded ${session.messages.length} messages from history\n`,
              ),
            );
          }
        }

        // Tab 补全命令列表
        const BASE_COMMANDS = [
          "/help",
          "/h",
          "/status",
          "/queue",
          "/q",
          "/undo",
          "/clear",
          "/reset",
          "/checkpoint",
          "/skill",
          "/mcp",
          "/history",
          "/compact",
          "/init",
          "/new",
          "/sessions",
          "/switch",
          "/rename",
          "/delete",
        ];
        const getCommands = () => {
          const skills = listSkills(agent.getWorkspacePath());
          const skillCommands = skills.map((s) => `/${s.name}`);
          return [...BASE_COMMANDS, ...skillCommands];
        };
        tuiHandler.getScreen().setCompleter((line: string) => {
          return getCommands().filter((c) => c.startsWith(line));
        });

        // 显示状态栏（简洁版）
        // 状态栏：状态 | 模型 | 工作区（智能缩写长路径）
        const updateStatusBarLocal = () => {
          const isBusy = state.isProcessing();
          const statusText = isBusy ? COLORS.warning('busy') : COLORS.success('idle');

          // 工作区路径显示（Windows 下缩写长路径）
          const workspace = agent.getWorkspacePath();
          const homeDir = os.homedir();
          let displayPath = workspace;

          // 缩写用户目录为 ~（跨平台）
          if (workspace.startsWith(homeDir)) {
            displayPath = "~" + workspace.slice(homeDir.length);
          }

          // Windows 下如果路径仍太长（超过 30 字符），显示最后两级目录
          if (displayPath.length > 30) {
            const parts = displayPath.split(/[/\\]/);
            if (parts.length > 2) {
              displayPath = "..." + parts.slice(-2).join("/");
            }
          }

          screen.setStatus(
            `${statusText} | ${providerConfig.model} | ${displayPath}`,
          );
        };
        setUpdateStatusBarFn(updateStatusBarLocal);
        updateStatusBarLocal();

        // TokenCounter 用于结束统计显示
        const provider = agent.getLLM()?.getProvider();
        const contextWindow = provider?.getContextWindow() || 128000;
        const tokenCounter = new TokenCounter();
        tokenCounter.setContextWindow(contextWindow);

        // 设置 Ctrl+O 切换回调
        screen.setVerboseToggleCallback(() => {
          const newMode = state.toggleVerboseMode();
          screen.appendScroll(
            COLORS.secondary(
              `\n[MODE] ${newMode ? "Verbose" : "Compact"} display enabled\n`,
            ),
          );
          updateStatusBar();
          screen.restoreCursor();
          screen.refreshInput();
        });

        // 启用 Bracketed Paste Mode（粘贴内容作为整体到达）
        screen.writeRaw(`${ESC}[?2004h`);

        // 启用 rawMode
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }

        let isProcessing = false;
        let shouldExit = false;

        // stdin 监听 - 使用 TUIInputHandler
        process.stdin.on("data", (chunk: Buffer) => {
          const result = tuiHandler!.handleStdin(
            chunk.toString("utf8"),
            false,
          );

          // ESC ESC 中断
          if (result.isInterrupt) {
            if (state.getAgent()) {
              state.getAgent()!.interrupt();
              isProcessing = false;
              state.setProcessing(false);
              updateStatusBar();

              screen.appendScroll(COLORS.warning("\n[INTERRUPTED]\n"));
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
            screen.writeRaw(`${ESC}[?2004l`);
            tuiHandler!.end();
            screen.appendScroll(COLORS.error("\n[FORCE EXIT]"));
            process.exit(0);
            return;
          }

          // 处理输入
          if (result.shouldProcess && result.content.trim()) {
            handleInput(result.content.trim());
          }
        });

        // 设置agent事件监听
        setupAgentEvents(agent, true, providerConfig.model, tokenCounter);

        // TUI 输出辅助函数（已简化）

        // 输入处理函数
        const handleInput = async (line: string) => {
          const trimmed = line.trim();

          // quit/exit 命令始终有效
          if (trimmed === "quit" || trimmed === "exit") {
            shouldExit = true;
            if (isProcessing && state.getAgent()) {
              state.getAgent()!.interrupt();
            }
            // 禁用 Bracketed Paste Mode
            screen.writeRaw(`${ESC}[?2004l`);
            tuiHandler!.end();
            const messages = agent.getMessages();
            saveSession(agent.getWorkspacePath(), messages);
            await shutdownMCP();
            state.setAgent(null);
            screen.appendScroll(
              COLORS.muted(`\nSession saved (${messages.length} messages)\n`),
            );
            screen.appendScroll(COLORS.muted("Goodbye!\n"));
            process.exit(0);
            return;
          }

          // 如果正在处理，使用队列累积输入
          if (isProcessing && !trimmed.startsWith("/")) {
            const queue = getInputQueue();
            const added = queue.add(trimmed);
            const status = queue.getStatus();
            
            // 检查是否接近队列上限
            if (status.droppedWarning) {
              screen.appendScroll(
                COLORS.warning(`[QUEUE] Warning: Queue near limit (${status.total}/${50})\n`),
              );
            }
            
            screen.appendScroll(
              COLORS.muted(`[QUEUE] Added #${added.id} (${status.pending} pending)\n`),
            );
            return;
          }

          // CRITICAL FIX: 在处理前合并 queue（而不是结束后）
          const queue = getInputQueue();
          let finalInput = trimmed;
          if (queue.hasPending() && !trimmed.startsWith("/")) {
            finalInput = queue.mergePending() + "\n\n---\n\n" + trimmed;
            const status = queue.getStatus();
            screen.appendScroll(
              COLORS.muted(
                `[QUEUE] Merged ${status.pending + 1} inputs (use --- separator)\n`,
              ),
            );
            
            // 自动清理已处理的输入
            const cleared = queue.autoCleanup();
            if (cleared > 0) {
              screen.appendScroll(
                COLORS.muted(`[QUEUE] Auto-cleaned ${cleared} processed inputs\n`),
              );
            }
          }

          if (!finalInput.trim()) {
            return;
          }

          if (trimmed === "help") {
            showHelp();

            return;
          }

          // === / 命令 ===
          if (trimmed.startsWith("/")) {
            const cmd = trimmed.slice(1).toLowerCase();

            // 队列管理
            if (cmd === "queue" || cmd === "q") {
              const queue = getInputQueue();
              const status = queue.getStatus();

              screen.appendScroll(COLORS.primary.bold("\nInput Queue:\n"));
              screen.appendScroll(`  Pending: ${status.pending}\n`);
              if (status.pendingPreview.length > 0) {
                screen.appendScroll(COLORS.muted("  Recent:\n"));
                status.pendingPreview.forEach((p, i) => {
                  screen.appendScroll(COLORS.muted(`    ${i + 1}. ${p}\n`));
                });
              }
              screen.appendScroll("\n");

              return;
            }

            if (cmd === "undo") {
              const queue = getInputQueue();
              const removed = queue.undoLast();

              if (removed) {
                screen.appendScroll(
                  COLORS.muted(`\n[QUEUE] Removed: ${removed.content}\n`),
                );
              } else {
                screen.appendScroll(
                  COLORS.muted("\n[QUEUE] No pending inputs\n"),
                );
              }

              return;
            }

            if (cmd === "clear" || cmd === "reset") {
              agent.setMessages([]);
              clearInputQueue();

              screen.appendScroll(COLORS.muted("\n[OK] Session cleared\n"));

              return;
            }

            // 会话管理
            if (cmd === "sessions" || cmd === "s") {
              const { listSessions } = await import("./utils/session");
              const { getTaskStats } =
                await import("./storage/taskPersistence");
              const sessions = listSessions(agent.getWorkspacePath());
              const taskStats = getTaskStats(agent.getWorkspacePath());
              const currentMsgs = agent.getMessages().length;

              screen.appendScroll(COLORS.primary.bold("\nSessions:\n"));
              screen.appendScroll(`  Current: ${currentMsgs} messages\n`);
              screen.appendScroll(`  Archived: ${sessions.length} sessions\n`);
              screen.appendScroll(
                `  Tasks: ${taskStats.total} (${taskStats.completed} done, ${taskStats.in_progress} active)\n`,
              );

              if (sessions.length > 0) {
                screen.appendScroll(COLORS.muted("\n  Recent sessions:\n"));
                sessions.slice(0, 5).forEach((s, i) => {
                  const date = new Date(s.lastActivity).toLocaleDateString();
                  screen.appendScroll(
                    COLORS.muted(
                      `    ${i + 1}. ${s.name} (${s.messageCount} msgs, ${date})\n`,
                    ),
                  );
                });
                if (sessions.length > 5) {
                  screen.appendScroll(
                    COLORS.muted(`    ... and ${sessions.length - 5} more\n`),
                  );
                }
              }

              screen.appendScroll(
                COLORS.muted(
                  "\n  Commands: /switch <id>, /rename <name>, /delete <id>\n",
                ),
              );
              screen.appendScroll("\n");

              return;
            }

            if (cmd.startsWith("switch ")) {
              const sessionId = cmd.slice(7).trim();
              const { switchSession, loadSession } = await import("./utils/session");

              // 先切换 session 文件
              if (switchSession(agent.getWorkspacePath(), sessionId)) {
                // 重新加载 session 到 agent 内存
                const session = loadSession(agent.getWorkspacePath());
                if (session && session.messages) {
                  agent.setMessages(session.messages);
                  screen.appendScroll(
                    COLORS.success(`\n[OK] Switched to session ${sessionId}\n`),
                  );
                  screen.appendScroll(
                    COLORS.muted(`Loaded ${session.messages.length} messages. Continue conversation.\n`),
                  );
                } else {
                  screen.appendScroll(
                    COLORS.warning(`\n[WARN] Session switched but no messages loaded\n`),
                  );
                }
              } else {
                screen.appendScroll(
                  COLORS.error(`\n[ERR] Session ${sessionId} not found\n`),
                );
                screen.appendScroll(
                  COLORS.muted("Use /sessions to list available sessions.\n"),
                );
              }

              return;
            }

            if (cmd.startsWith("rename ")) {
              const args = cmd.slice(7).trim();
              const parts = args.split(" ");
              const sessionId = parts[0];
              const newName = parts.slice(1).join(" ") || "Unnamed";
              const { renameSession } = await import("./utils/session");

              if (renameSession(agent.getWorkspacePath(), sessionId, newName)) {
                screen.appendScroll(
                  COLORS.success(`\n[OK] Session renamed to: ${newName}\n`),
                );
              } else {
                screen.appendScroll(
                  COLORS.error(
                    `\n[ERR] Failed to rename session ${sessionId}\n`,
                  ),
                );
              }

              return;
            }

            // 删除 session
            if (cmd.startsWith("delete ")) {
              const sessionId = cmd.slice(7).trim();
              const { deleteSession } = await import("./utils/session");

              if (deleteSession(agent.getWorkspacePath(), sessionId)) {
                screen.appendScroll(
                  COLORS.success(`\n[OK] Session ${sessionId} deleted\n`),
                );
              } else {
                screen.appendScroll(
                  COLORS.error(`\n[ERR] Session ${sessionId} not found or cannot delete\n`),
                );
              }

              return;
            }

            // 创建新 session（保存当前，重新开始）
            if (cmd === "new") {
              // 保存当前 session
              const currentMessages = agent.getMessages();
              if (currentMessages.length > 0) {
                saveSession(agent.getWorkspacePath(), currentMessages);
                screen.appendScroll(
                  COLORS.muted(`\n[ARCHIVE] Saved current session (${currentMessages.length} messages)\n`),
                );
              }

              // 清空 agent 消息
              agent.setMessages([]);
              screen.appendScroll(
                COLORS.success(`\n[NEW] Started fresh session\n`),
              );
              screen.appendScroll(
                COLORS.muted("Previous session archived. Use /sessions to switch back.\n"),
              );

              return;
            }

            // 状态
            if (cmd === "status") {
              const msgs = agent.getMessages().length;
              const queue = getInputQueue();
              const queueStatus = queue.getStatus();

              // Token 计数
              const tokenCounter = new TokenCounter();
              const provider = agent.getLLM()?.getProvider();
              if (provider) {
                tokenCounter.setContextWindow(provider.getContextWindow());
              }
              const usedTokens = tokenCounter.estimateMessages(
                agent.getMessages(),
              );
              const contextWindow = provider?.getContextWindow() || 128000;
              const usagePercent = (usedTokens / contextWindow) * 100;
              const usedK =
                usedTokens >= 1000
                  ? `${Math.floor(usedTokens / 1000)}k`
                  : String(usedTokens);
              const maxK =
                contextWindow >= 1000
                  ? `${Math.floor(contextWindow / 1000)}k`
                  : String(contextWindow);

              screen.appendScroll(COLORS.primary.bold("\nStatus:\n"));
              screen.appendScroll(`  Messages: ${msgs}\n`);
              screen.appendScroll(
                `  Context: ${usagePercent.toFixed(1)}% (${usedK} / ${maxK} tokens)\n`,
              );
              screen.appendScroll(`  Queue: ${queueStatus.pending} pending\n`);
              screen.appendScroll(
                `  Workspace: ${agent.getWorkspacePath()}\n\n`,
              );

              return;
            }

            // Checkpoint 管理
            if (cmd === "checkpoint" || cmd.startsWith("checkpoint ")) {
              const subCmd = cmd.startsWith("checkpoint ") ? cmd.slice(11).trim() : "";
              const parts = subCmd.split(" ");
              const action = parts[0];
              const id = parts.slice(1).join(" ");

              if (!action || action === "list") {
                const checkpoints = await listCheckpoints(agent.getWorkspacePath(), 20);
                screen.appendScroll(COLORS.primary.bold("\nCheckpoints:\n"));
                if (checkpoints.length === 0) {
                  screen.appendScroll(COLORS.muted("  (none)\n"));
                } else {
                  checkpoints.forEach((c) => {
                    const date = new Date(c.timestamp).toLocaleString();
                    screen.appendScroll(`  ${COLORS.success(c.id)} - ${date}\n`);
                    screen.appendScroll(COLORS.muted(`    ${c.promptPreview}\n`));
                  });
                }
                screen.appendScroll(COLORS.muted("\n  Commands: /checkpoint show <id>, /checkpoint restore <id>, /checkpoint clean\n"));
              } else if (action === "show") {
                if (!id) {
                  screen.appendScroll(COLORS.warning("\nUsage: /checkpoint show <id>\n"));
                } else {
                  const meta = await getCheckpoint(agent.getWorkspacePath(), id);
                  if (!meta) {
                    screen.appendScroll(COLORS.error(`\n[ERR] Checkpoint not found: ${id}\n`));
                  } else {
                    screen.appendScroll(COLORS.primary.bold(`\nCheckpoint: ${meta.id}\n`));
                    screen.appendScroll(`  Timestamp: ${new Date(meta.timestamp).toLocaleString()}\n`);
                    screen.appendScroll(`  Prompt: ${meta.promptPreview}\n`);
                    screen.appendScroll(COLORS.primary.bold("  Files:\n"));
                    meta.filesBackedUp.forEach((f) => {
                      screen.appendScroll(COLORS.muted(`    - ${f}\n`));
                    });
                  }
                }
              } else if (action === "restore") {
                if (!id) {
                  screen.appendScroll(COLORS.warning("\nUsage: /checkpoint restore <id>\n"));
                } else {
                  const result = await restoreCheckpoint(agent.getWorkspacePath(), id);
                  if (result.success) {
                    screen.appendScroll(COLORS.success(`\n[OK] Restored ${result.restoredFiles.length} files from ${id}\n`));
                    result.restoredFiles.forEach((f) => {
                      screen.appendScroll(COLORS.muted(`  - ${f}\n`));
                    });
                  } else {
                    screen.appendScroll(COLORS.error(`\n[ERR] ${result.error}\n`));
                  }
                }
              } else if (action === "clean") {
                const result = await cleanCheckpoints(agent.getWorkspacePath(), 20);
                screen.appendScroll(COLORS.success(`\n[OK] Cleaned checkpoints\n`));
                screen.appendScroll(COLORS.muted(`  Deleted: ${result.deleted.length}, Kept: ${result.kept.length}\n`));
              } else {
                screen.appendScroll(COLORS.warning("\nUsage: /checkpoint [list|show <id>|restore <id>|clean]\n"));
              }
              screen.restoreCursor();
              return;
            }

            // Skill 管理
            if (cmd === "skill" || cmd.startsWith("skill ")) {
              const subCmd = cmd.startsWith("skill ") ? cmd.slice(6).trim() : "";
              const parts = subCmd.split(" ");
              const action = parts[0];

              if (!action || action === "list") {
                const skills = listSkills(agent.getWorkspacePath());
                const packages = await listInstalledPackages();

                screen.appendScroll(COLORS.primary.bold("\nSkill Packages:\n"));
                if (packages.length === 0) {
                  screen.appendScroll(COLORS.muted("  (none)\n"));
                } else {
                  packages.forEach((p) => {
                    screen.appendScroll(`  ${COLORS.success("●")} ${p.name} (${p.skills.length} skills)\n`);
                  });
                }

                screen.appendScroll(COLORS.primary.bold("\nAvailable Skills:\n"));
                if (skills.length === 0) {
                  screen.appendScroll(COLORS.muted("  (none)\n"));
                  screen.appendScroll(COLORS.muted("\n  Install: /skill install <url>\n"));
                } else {
                  skills.forEach((s) => {
                    screen.appendScroll(COLORS.muted(`  /${s.name} - ${s.description || ""}\n`));
                  });
                }
              } else if (action === "install") {
                const source = parts.slice(1).join(" ");
                if (!source) {
                  screen.appendScroll(COLORS.warning("\nUsage: /skill install <url-or-path>\n"));
                } else {
                  const result = await installSkill(source);
                  if (result.success) {
                    screen.appendScroll(COLORS.success(`\n[OK] ${result.message}\n`));
                    if (result.skills) {
                      result.skills.forEach((s) => screen.appendScroll(COLORS.muted(`  /${s}\n`)));
                    }
                  } else {
                    screen.appendScroll(COLORS.error(`\n[ERR] ${result.message}\n`));
                  }
                }
              } else if (action === "uninstall") {
                const pkgName = parts.slice(1).join(" ");
                if (!pkgName) {
                  screen.appendScroll(COLORS.warning("\nUsage: /skill uninstall <package-name>\n"));
                } else {
                  const result = await uninstallSkill(pkgName);
                  if (result.success) {
                    screen.appendScroll(COLORS.success(`\n[OK] ${result.message}\n`));
                  } else {
                    screen.appendScroll(COLORS.error(`\n[ERR] ${result.message}\n`));
                  }
                }
              } else if (action === "add") {
                const skillName = parts[1];
                const promptTemplate = parts.slice(2).join(" ") || "{input}";
                if (!skillName) {
                  screen.appendScroll(COLORS.warning("\nUsage: /skill add <name> [promptTemplate]\n"));
                } else {
                  await saveSkill(skillName, { name: skillName, description: `Custom skill: ${skillName}`, promptTemplate });
                  screen.appendScroll(COLORS.success(`\n[OK] Skill added: ${skillName}\n`));
                }
              } else if (action === "remove") {
                const skillName = parts[1];
                if (!skillName) {
                  screen.appendScroll(COLORS.warning("\nUsage: /skill remove <name>\n"));
                } else {
                  const result = await deleteSkill(skillName);
                  if (result) {
                    screen.appendScroll(COLORS.success(`\n[OK] Skill removed: ${skillName}\n`));
                  } else {
                    screen.appendScroll(COLORS.warning(`\n[WARN] Skill not found: ${skillName}\n`));
                  }
                }
              } else if (action === "edit") {
                const skillName = parts[1];
                const promptTemplate = parts.slice(2).join(" ");
                if (!skillName || !promptTemplate) {
                  screen.appendScroll(COLORS.warning("\nUsage: /skill edit <name> <promptTemplate>\n"));
                } else {
                  const existing = getSkill(skillName, agent.getWorkspacePath());
                  if (!existing) {
                    screen.appendScroll(COLORS.warning(`\n[WARN] Skill not found: ${skillName}\n`));
                  } else {
                    await saveSkill(skillName, { ...existing, promptTemplate });
                    screen.appendScroll(COLORS.success(`\n[OK] Skill updated: ${skillName}\n`));
                  }
                }
              } else {
                screen.appendScroll(COLORS.warning("\nUsage: /skill [list|install|uninstall|add|remove|edit]\n"));
              }
              screen.restoreCursor();
              return;
            }

            // MCP 管理
            if (cmd === "mcp" || cmd.startsWith("mcp ")) {
              const subCmd = cmd.startsWith("mcp ") ? cmd.slice(4).trim() : "";
              const parts = subCmd.split(" ");
              const action = parts[0];
              const manager = getMCPManager();

              if (!action || action === "status") {
                const connected = manager.listConnectedServers();
                const tools = manager.listAvailableTools();

                screen.appendScroll(COLORS.primary.bold("\nMCP Status:\n"));
                if (connected.length === 0) {
                  screen.appendScroll(COLORS.muted("  No servers connected\n"));
                  screen.appendScroll(COLORS.muted("\n  Run /mcp init to create example config\n"));
                } else {
                  screen.appendScroll(COLORS.success(`  Connected: ${connected.join(", ")}\n`));
                  screen.appendScroll(COLORS.muted(`  Tools: ${tools.length}\n`));
                  if (tools.length > 0) {
                    tools.slice(0, 5).forEach((t) => {
                      screen.appendScroll(COLORS.muted(`    - ${t}\n`));
                    });
                    if (tools.length > 5) {
                      screen.appendScroll(COLORS.muted(`    ... and ${tools.length - 5} more\n`));
                    }
                  }
                }
              } else if (action === "init") {
                const currentSettings = await loadGlobalSettings();
                if ((currentSettings.mcp?.servers?.length ?? 0) > 0) {
                  screen.appendScroll(COLORS.warning("\nMCP servers already configured\n"));
                  screen.appendScroll(COLORS.muted("  Edit ~/.spica/settings.json to modify\n"));
                } else {
                  currentSettings.mcp = generateExampleConfig();
                  await saveGlobalSettings(currentSettings);
                  screen.appendScroll(COLORS.success(`\n[OK] MCP config added to ${GLOBAL_SETTINGS_FILE}\n`));
                  screen.appendScroll(COLORS.muted("  Edit ~/.spica/settings.json to customize\n"));
                }
              } else if (action === "tools") {
                const allTools = manager.listAvailableTools();
                screen.appendScroll(COLORS.primary.bold("\nMCP Tools:\n"));
                if (allTools.length === 0) {
                  screen.appendScroll(COLORS.muted("  (none)\n"));
                  screen.appendScroll(COLORS.muted("  Connect a MCP server first\n"));
                } else {
                  allTools.forEach((t) => {
                    screen.appendScroll(COLORS.muted(`  ${t}\n`));
                  });
                }
              } else if (action === "disconnect") {
                await manager.disconnectAll();
                screen.appendScroll(COLORS.success("\n[OK] All MCP servers disconnected\n"));
              } else {
                screen.appendScroll(COLORS.warning("\nUsage: /mcp [status|init|tools|disconnect]\n"));
              }
              screen.restoreCursor();
              return;
            }

            // 帮助
            if (cmd === "help" || cmd === "h") {
              showHelp();

              return;
            }

            // 历史（显示最近消息）
            if (cmd === "history") {
              const msgs = agent.getMessages();

              screen.appendScroll(COLORS.primary.bold("\nHistory:\n"));
              if (msgs.length === 0) {
                screen.appendScroll(COLORS.muted("  (empty)\n"));
              } else {
                msgs.forEach((m, i) => {
                  const role =
                    m.role === "user"
                      ? "YOU"
                      : m.role === "assistant"
                        ? "AI"
                        : "SYS";
                  const content = m.content || "";
                  screen.appendScroll(COLORS.muted(`  ${i + 1}. [${role}]\n`));
                  content.split("\n").forEach((line) => {
                    screen.appendScroll(COLORS.muted(`     ${line}\n`));
                  });
                });
                screen.appendScroll(
                  COLORS.muted(`\n  Total: ${msgs.length} messages\n`),
                );
              }
              screen.appendScroll("\n");

              return;
            }

            // 压缩上下文
            if (cmd === "compact") {
              await agent.compact();
              // compact 内部已 emit context_compressed 事件，无需重复输出
              screen.restoreCursor();
              return;
            }

            // Init - 让AI分析代码库并创建 AGENTS.md
            if (cmd === "init" || cmd.startsWith("init ")) {
              // 提取用户额外指令
              const userArgs = cmd.startsWith("init ")
                ? cmd.slice(5).trim()
                : "";

              const initPrompt = `Analyze this project and create AGENTS.md. Reference https://agents.md/ for the standard.

What to include: how to build, how to test, code conventions, PR workflow.
Verify every command by running it. Don't guess. Be specific to this project.

If AGENTS.md already exists, preserve valuable content and supplement updates.`;

              handleInput(initPrompt);
              return;
            }

            // Skill 调用（/skill_name args）
            const skillInput = parseSkillInput(trimmed, agent.getWorkspacePath());
            if (skillInput) {
              const skill = getSkill(skillInput.skillName, agent.getWorkspacePath());
              if (skill) {
                const prompt = buildSkillPrompt(skill, skillInput.args);

                screen.appendScroll(
                  COLORS.muted(`\n[${skill.name}] ${skill.description}\n`),
                );
                isProcessing = true;
                state.setProcessing(true);
                updateStatusBar();
                try {
                  await agent.runLoop(prompt);
                  screen.setStreaming(false);
                  screen.appendScroll(COLORS.success("\n[OK] Done\n"));
                  playBell("done"); // 工作完成提示音
                } catch (error: unknown) {
                  screen.setStreaming(false);
                  const errorMsg = error instanceof Error ? error.message : String(error);
                  screen.appendScroll(
                    COLORS.error(`\n[ERR] ${errorMsg}\n`),
                  );
                  playBell("error"); // 错误提示音
                }
                screen.restoreCursor();
                screen.refreshInput();
                isProcessing = false;
                state.setProcessing(false);
                updateStatusBar();
                saveSession(agent.getWorkspacePath(), agent.getMessages());

                // Auto-drain queued inputs
                await autoDrainQueue(getInputQueue(), async (merged) => {
                  await handleInput(merged);
                });

                return;
              }
            }

            // 未知的 / 命令
            screen.appendScroll(
              COLORS.warning(`\nUnknown command: ${trimmed}\n`),
            );
            screen.appendScroll(COLORS.muted("Type /h for help\n"));
            return;
          }

          // === 执行请求 ===
          // 先显示用户输入在输出区
          screen.appendScroll(COLORS.primary(`\n> ${finalInput}\n`));

          isProcessing = true;
          state.setProcessing(true);
          updateStatusBar();

          // 设置队列输入回调，让 agent 在迭代间隙获取队列输入
          agent.setQueueInputCallback(() => {
            const queue = getInputQueue();
            if (queue.hasPending()) {
              return queue.mergePending();
            }
            return null;
          });

          // 显示处理状态（心跳由 waiting_for_llm 事件自动启动）
          screen.appendScroll(
            COLORS.muted("Processing... (ESC ESC to interrupt)\n"),
          );

          const startTime = Date.now();
          try {
            const result = await agent.runLoop(finalInput);
            const elapsed = Date.now() - startTime;
            if (state.isStreamingOutput()) {
              state.setStreamingOutput(false);
              screen.setStreaming(false);
              screen.appendScroll("\n");
            }

            // 显示运行统计
            const stats = formatRunStats(elapsed, agent, tokenCounter);
            screen.appendScroll(COLORS.muted(`\n${stats}\n`));
            screen.appendScroll(COLORS.success("[OK] Done\n"));
            playBell("done");
          } catch (error: unknown) {
            const elapsed = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (state.isStreamingOutput()) {
              state.setStreamingOutput(false);
              screen.setStreaming(false);
              screen.appendScroll("\n");
            }
            // 显示运行统计（即使失败也显示）
            const stats = formatRunStats(elapsed, agent, tokenCounter);
            screen.appendScroll(COLORS.muted(`\n${stats}\n`));
            screen.appendScroll(COLORS.error(`[ERR] ${errorMsg}\n`));
            playBell("error");
          }
          // 输出完成，恢复光标到输入框并刷新显示
          screen.setStreaming(false);
          screen.restoreCursor();
          screen.refreshInput();
          isProcessing = false;
          state.setProcessing(false);
          updateStatusBar();
          
          // 清理队列输入回调
          agent.setQueueInputCallback(null);
          
          saveSession(agent.getWorkspacePath(), agent.getMessages());

          // Auto-drain remaining queued inputs（处理未被注入的剩余队列）
          await autoDrainQueue(getInputQueue(), async (merged) => {
            await handleInput(merged);
          });
        };

        // 帮助信息
        const showHelp = () => {
          screen.appendScroll(COLORS.primary.bold("\nCommands:\n"));
          screen.appendScroll(COLORS.muted("  quit/exit   Exit\n"));
          screen.appendScroll(COLORS.muted("  help        Show help\n"));
          screen.appendScroll("\n");
          screen.appendScroll(COLORS.primary.bold("Session:\n"));
          screen.appendScroll(COLORS.muted("  /new        Start fresh session (archives current)\n"));
          screen.appendScroll(COLORS.muted("  /clear      Clear session\n"));
          screen.appendScroll(COLORS.muted("  /history    Show messages\n"));
          screen.appendScroll(COLORS.muted("  /compact    Compress context\n"));
          screen.appendScroll(
            COLORS.muted("  /sessions   List archived sessions\n"),
          );
          screen.appendScroll(
            COLORS.muted("  /switch <id> Switch to session\n"),
          );
          screen.appendScroll(
            COLORS.muted("  /rename <id> <name> Rename session\n"),
          );
          screen.appendScroll(
            COLORS.muted("  /delete <id> Delete session\n"),
          );
          screen.appendScroll("\n");
          screen.appendScroll(COLORS.primary.bold("Queue:\n"));
          screen.appendScroll(COLORS.muted("  /queue      Show queue\n"));
          screen.appendScroll(
            COLORS.muted("  /undo       Remove last input\n"),
          );
          screen.appendScroll("\n");
          screen.appendScroll(COLORS.primary.bold("Checkpoint:\n"));
          screen.appendScroll(COLORS.muted("  /checkpoint list        List checkpoints\n"));
          screen.appendScroll(COLORS.muted("  /checkpoint show <id>   Show checkpoint\n"));
          screen.appendScroll(COLORS.muted("  /checkpoint restore <id> Restore files\n"));
          screen.appendScroll(COLORS.muted("  /checkpoint clean       Clean old checkpoints\n"));
          screen.appendScroll("\n");
          screen.appendScroll(COLORS.primary.bold("Skill:\n"));
          screen.appendScroll(COLORS.muted("  /skill list             List skills\n"));
          screen.appendScroll(COLORS.muted("  /skill install <url>    Install skill package\n"));
          screen.appendScroll(COLORS.muted("  /skill add <name> [tpl] Add custom skill\n"));
          screen.appendScroll(COLORS.muted("  /skill remove <name>   Remove skill\n"));
          screen.appendScroll("\n");
          screen.appendScroll(COLORS.primary.bold("MCP:\n"));
          screen.appendScroll(COLORS.muted("  /mcp status     Show MCP status\n"));
          screen.appendScroll(COLORS.muted("  /mcp init       Create example config\n"));
          screen.appendScroll(COLORS.muted("  /mcp tools      List available tools\n"));
          screen.appendScroll(COLORS.muted("  /mcp disconnect  Disconnect all servers\n"));
          screen.appendScroll("\n");
          screen.appendScroll(COLORS.muted("  /status     Show status\n"));
          screen.appendScroll("\n");
        };

        // 保持进程运行
        await new Promise<void>((resolve) => {
          process.on("exit", resolve);
        });
      } catch (error: unknown) {
        // 停止banner动画
        BG.stopBanner();
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!state.isConnectionErrorShown()) {
          if (tuiHandler) {
            screen.appendScroll(COLORS.error(`\nError: ${errorMsg}\n`));
          } else {
            console.log(COLORS.error(`Error: ${errorMsg}`));
          }
        }
      }

      state.setAgent(null);
      state.setConnectionErrorShown(false); // 重置
    },
  );

// Run command - 单次执行
program
  .command("run <request>")
  .description(
    "Execute single coding task and exit (non-interactive mode)\n\nUse for quick fixes or one-time tasks",
  )
  .option("-p, --provider <name>", "Use specific provider")
  .addHelpText(
    "after",
    '\nExamples:\n  spica run "fix login bug"\n  spica run "add CSV export" -p deepseek\n  spica run "refactor user module"',
  )
  .action(async (request: string, options: { provider?: string }) => {
    const config = await loadGlobalSettings();
    const providerName = options.provider || config.defaultProvider || "openai";

    let providerConfig;
    try {
      providerConfig = await getProviderConfig(providerName);
    } catch (error: unknown) {
      console.log(COLORS.error(`Provider "${providerName}" not configured.`));
      console.log(
        COLORS.warning("Set up with: spica providers set <name> <api-key>"),
      );
      return;
    }

    const agent = new SpicaAgent(providerName, process.cwd());
    state.setAgent(agent);

    setupAgentEvents(agent, false);

    try {
      await agent.init();
      const result = await agent.runLoop(request);
      console.log(COLORS.success("\n[OK] Completed"));
      playBell("done");
    } catch (error: unknown) {
      if (!state.isConnectionErrorShown()) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(COLORS.error(`Error: ${errorMsg}`));
      }
      playBell("error");
    }

    state.setAgent(null);
    state.setConnectionErrorShown(false); // 重置
  });

// Provider commands
program
  .command("set <name> <url> <apiKey> <model>")
  .description("Add or update a provider")
  .action(async (name, url, apiKey, model) => {
    await setProviderConfig(name, apiKey, url, model);
    console.log(COLORS.success(`[OK] ${name}`));
  });

program
  .command("use <name>")
  .description("Switch default provider")
  .action(async (name) => {
    try {
      await setDefaultProvider(name);
      console.log(COLORS.success(`[OK] using ${name}`));
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(COLORS.error(errorMsg));
    }
  });

program
  .command("list")
  .description("List providers")
  .action(async () => {
    const providers = await listProviders();
    const defaultProvider = (await loadGlobalSettings()).defaultProvider;
    providers.forEach((p) => {
      const mark = p === defaultProvider ? "●" : "○";
      console.log(`${mark} ${p}`);
    });
  });

program
  .command("show [name]")
  .description("Show provider config")
  .action(async (name) => {
    name = name || (await loadGlobalSettings()).defaultProvider;
    if (!name) return console.log("No default provider");
    try {
      const c = await getProviderConfig(name);
      console.log(`name:   ${c.name}`);
      console.log(`url:    ${c.baseUrl}`);
      console.log(`key:    ${c.apiKey.slice(0, 8)}...`);
      console.log(`model:  ${c.model}`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(COLORS.error(errorMsg));
    }
  });

program
  .command("remove [names...]")
  .description("Remove providers (use --all to remove all)")
  .option("-a, --all", "Remove all")
  .action(async (names, opts) => {
    const config = await loadGlobalSettings();
    if (opts.all) {
      const all = Object.keys(config.providers || {});
      config.providers = {};
      config.defaultProvider = undefined;
      await saveGlobalSettings(config);
      console.log(COLORS.success(`[OK] removed: ${all.join(", ")}`));
      return;
    }
    if (!names.length) return console.log("Usage: remove <names...> or --all");
    for (const n of names) {
      if (config.providers?.[n]) {
        delete config.providers[n];
        if (config.defaultProvider === n) config.defaultProvider = undefined;
        console.log(COLORS.success(`[OK] ${n}`));
      } else {
        console.log(COLORS.error(`[ERR] ${n} not found`));
      }
    }
    await saveGlobalSettings(config);
  });

// Skills管理已移至内部命令 /skill

// MCP管理已移至内部命令 /mcp

// Checkpoint管理已移至内部命令 /checkpoint

// 非交互模式运行函数
async function runSimpleMode(
  agent: SpicaAgent,
  fresh?: boolean,
): Promise<void> {
  try {
    await agent.init();

    // 设置简单的事件处理（无 TUI）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("stream", (data: any) => {
      process.stdout.write(data.chunk);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("reasoning", (data: any) => {
      process.stdout.write(COLORS.reasoning(data.content));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("tool_call", (data: any) => {
      console.log(COLORS.tool(`\n[TOOL] ${data.name}`));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("tool_progress", (data: any) => {
      const elapsed = data.elapsed || 0;
      const stage = data.stage || data.command || '';
      process.stdout.write(COLORS.muted(`\r  [${elapsed}s] ${stage}...`));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("tool_result", (data: any) => {
      const icon = data.success
        ? COLORS.success("[OK]")
        : COLORS.error("[ERR]");
      console.log(`\n${icon} ${data.name}`);
      if (data.error) {
        console.log(COLORS.error(`  Error: ${data.error}`));
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("message", (data: any) => {
      if (data.role === "assistant") {
        console.log(); // 新行
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("context_compressed", (data: any) => {
      console.log(
        COLORS.secondary(
          `\n[COMPRESS] ${data.before} -> ${data.after} messages`,
        ),
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event data types are dynamic
    agent.on("connection_error", (data: any) => {
      state.setConnectionErrorShown(true);
      console.log(COLORS.error(`\n[ERR] ${data.type}: ${data.hint}`));
      if (data.error) {
        console.log(COLORS.muted(`Details: ${data.error}`));
      }
    });

    const providerConfig = state.getProviderConfig();
    const model = providerConfig?.model || "unknown";
    console.log(COLORS.success(`[OK] Connected to ${model}`));
    console.log(
      COLORS.muted("\nNon-interactive mode: type your request and press Enter"),
    );
    console.log(COLORS.muted("Press Ctrl+C to exit, Ctrl+D to interrupt"));

    // 清空历史（如果指定）
    if (fresh) {
      agent.setMessages([]);
      console.log(COLORS.muted("[INFO] Session cleared"));
    }

    // 简单的 readline 模式
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    rl.prompt();

    rl.on("line", async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      // 处理特殊命令
      if (trimmed === "quit" || trimmed === "exit") {
        rl.close();
        return;
      }

      if (trimmed === "help") {
        console.log(
          "Commands: quit, exit, help, /clear, /compact, /history, /status",
        );
        rl.prompt();
        return;
      }

      if (trimmed.startsWith("/")) {
        const cmd = trimmed.slice(1).toLowerCase();
        if (cmd === "clear") {
          agent.setMessages([]);
          console.log(COLORS.muted("[OK] Session cleared"));
        } else if (cmd === "compact") {
          await agent.compact();
        } else if (cmd === "history") {
          const messages = agent.getMessages();
          console.log(COLORS.muted(`\n[History] ${messages.length} messages`));
        } else if (cmd === "status") {
          const messages = agent.getMessages();
          console.log(COLORS.primary(`\n[Status]`));
          console.log(`  Messages: ${messages.length}`);
        } else {
          console.log(COLORS.warning(`Unknown command: ${trimmed}`));
        }
        rl.prompt();
        return;
      }

      // 执行请求
      try {
        console.log(COLORS.muted("\n[PROCESSING]..."));
        const response = await agent.runLoop(trimmed);
        console.log(COLORS.success("\n[OK] Done"));
        playBell("done");
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(COLORS.error(`\n[ERR] ${errorMsg}`));
        playBell("error");
      }

      rl.prompt();
    });

    rl.on("close", () => {
      console.log(COLORS.muted("\n[EXIT] Goodbye!"));
      saveSession(agent.getWorkspacePath(), agent.getMessages());
      process.exit(0);
    });
  } catch (error: unknown) {
    // 停止banner动画（如果正在运行）
    BG.stopBanner();
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(COLORS.error(`Error: ${errorMsg}`));
    process.exit(1);
  }
}

program.parse();
