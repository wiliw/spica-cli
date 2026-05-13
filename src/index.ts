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
import { loadSession, saveSession } from './utils/session';
import { parseSkillInput, getSkill, buildSkillPrompt, listSkills, installSkill, uninstallSkill, listInstalledPackages } from './skills';
import { getMCPManager, generateExampleConfig, MCPServerConfig } from './mcp/client';
import { LAIN_COLORS, format, BG } from './utils/colors';
import prompts from 'prompts';
import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

const program = new Command();

// 当前agent引用（用于中断）
let currentAgent: SpicaAgent | null = null;

// Ctrl+C中断处理
process.on('SIGINT', () => {
  if (currentAgent) {
    currentAgent.interrupt();
    console.log(LAIN_COLORS.warning('\n[INTERRUPTED]'));
  } else {
    process.exit(0);
  }
});

// 设置agent事件监听
// 设置agent事件监听
let connectionErrorShown = false;  // 全局标记

function setupAgentEvents(agent: SpicaAgent, interactive: boolean = false) {
  let lastWasReasoning = false;

  // 连接错误事件（只显示一次简洁信息）
  agent.on('connection_error', (data: any) => {
    connectionErrorShown = true;
    console.log(LAIN_COLORS.error(`\n[ERR] ${data.type}: ${data.hint}`));
    console.log('');
  });

  agent.on('stream', (data: any) => {
    if (lastWasReasoning) {
      process.stdout.write('\n');
      lastWasReasoning = false;
    }
    process.stdout.write(LAIN_COLORS.primary(data.chunk));
  });

  agent.on('reasoning', (data: any) => {
    process.stderr.write(LAIN_COLORS.reasoning(data.content));
    lastWasReasoning = true;
  });

  agent.on('tool_call', (data: any) => {
    // 工具调用前换行（如果之前是reasoning也要换行）
    if (lastWasReasoning) {
      process.stdout.write('\n');
      lastWasReasoning = false;
    }
    console.log(LAIN_COLORS.tool(`-> ${data.name}`));
  });

  agent.on('tool_result', (data: any) => {
    const icon = data.success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    const output = data.output || data.error || '';
    // 显示完整输出，不截断
    console.log(`${icon} ${data.name}:`);
    if (output.length > 0) {
      output.split('\n').forEach(line => {
        console.log(LAIN_COLORS.muted(`  ${line}`));
      });
    }
  });

  agent.on('diff_preview', (data: any) => {
    console.log(LAIN_COLORS.file(`\n[FILE] ${data.filePath}`));
    if (data.diff) {
      console.log(data.diff);
    }
  });

  agent.on('permission_request', async (data: any) => {
    // Lain红色警示框
    console.log(format.permissionBox(data.reason));
    const answer = await prompts({
      type: 'confirm',
      name: 'approve',
      message: LAIN_COLORS.primary.bold('Do you want to allow this action?'),
      initial: false,
    });
    console.log(LAIN_COLORS.permissionBorder('═'.repeat(50)) + '\n');
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
}

program
  .name('spica')
  .description('AI coding agent')
  .version('1.0.0');

// 默认：持续对话模式
program
  .option('-c, --continue', 'Continue previous session')
  .option('-p, --provider <name>', 'Use specific provider')
  .action(async (options: { continue?: boolean; provider?: string }) => {
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

    setupAgentEvents(agent, true);

    // 开始banner动画（并行）
    const bannerPromise = BG.banner();

    try {
      await agent.init();

      // 停止banner动画
      BG.stopBanner();
      await bannerPromise;

      // 恢复上次会话
      if (options.continue) {
        const session = loadSession(process.cwd());
        if (session) {
          agent.setMessages(session.messages);
          console.log(LAIN_COLORS.success('restored'));
        }
      }

      console.log(LAIN_COLORS.muted(`${providerConfig.model} | /h for help`));

      // REPL循环
      while (true) {
        const input = await prompts({
          type: 'text',
          name: 'prompt',
          message: LAIN_COLORS.success('>'),
        });

        if (!input.prompt) {
          // Ctrl+C或空输入
          break;
        }

        const trimmed = input.prompt.trim();
        if (trimmed === 'quit' || trimmed === 'exit') {
          break;
        }

        if (trimmed === 'clear' || trimmed === 'reset') {
          agent.setMessages([]);
          console.log(LAIN_COLORS.muted('Session cleared'));
          continue;
        }

        // 指令处理（控制agent行为）
        if (trimmed.startsWith('/')) {
          const cmd = trimmed.slice(1).toLowerCase();

          if (cmd === 'bypass') {
            agent.setBypassPermissions(true);
            console.log(LAIN_COLORS.warning('[WARN] Bypass mode ON - All permissions will be auto-approved'));
            console.log(LAIN_COLORS.muted('Use /strict to restore permission checks'));
            continue;
          }

          if (cmd === 'strict') {
            agent.setBypassPermissions(false);
            console.log(LAIN_COLORS.success('[OK] Strict mode ON - Permissions will be requested'));
            continue;
          }

          if (cmd === 'status') {
            const bypass = agent.isBypassPermissions;
            const msgs = agent.getMessages().length;
            console.log(LAIN_COLORS.primary.bold('\nCurrent Status:'));
            console.log(`  Permission mode: ${bypass ? LAIN_COLORS.warning('BYPASS (auto-approve)') : LAIN_COLORS.success('STRICT (ask user)')}`);
            console.log(`  Messages in context: ${msgs}`);
            console.log(`  Workspace: ${agent.getWorkspacePath()}`);
            continue;
          }

          // /help 指令 (包括 /h 简写)
          if (cmd === 'help' || cmd === 'h') {
            console.log(LAIN_COLORS.muted(`
Commands:
  quit/exit  - Exit spica
  clear      - Clear session history
  save       - Save current session
  help       - Show this help
  skills     - List installed skills
  Ctrl+C     - Interrupt current operation

Mode Control:
  /bypass    - Skip all permission requests (auto-approve)
  /strict    - Restore permission requests
  /status    - Show current status

Skills:
  Add skills in ~/.spica/skills.json or .spica/skills.json
  Use /skill_name to invoke installed skills
`));
            continue;
          }
        }

        if (trimmed === 'help') {
          console.log(LAIN_COLORS.muted(`
Commands:
  quit/exit  - Exit spica
  clear      - Clear session history
  save       - Save current session
  help       - Show this help
  skills     - List installed skills
  Ctrl+C     - Interrupt current operation

Mode Control:
  /bypass    - Skip all permission requests (auto-approve)
  /strict    - Restore permission requests
  /status    - Show current status

Skills:
  Add skills in ~/.spica/skills.json or .spica/skills.json
  Use /skill_name to invoke installed skills
`));
          continue;
        }

        if (trimmed === 'save') {
          saveSession(process.cwd(), agent.getMessages());
          console.log(LAIN_COLORS.success('[OK] Session saved'));
          continue;
        }

        if (trimmed === 'skills') {
          const skills = listSkills();
          console.log(LAIN_COLORS.primary.bold('\nInstalled skills:'));
          if (skills.length === 0) {
            console.log(LAIN_COLORS.muted('  (none)'));
            console.log(LAIN_COLORS.muted('\nAdd skills in:'));
            console.log(LAIN_COLORS.muted('  ~/.spica/skills.json (global)'));
            console.log(LAIN_COLORS.muted('  .spica/skills.json (project)'));
          } else {
            skills.forEach(s => {
              console.log(LAIN_COLORS.muted(`  /${s.name} - ${s.description}`));
            });
          }
          console.log('');
          continue;
        }

        // 检查是否是skill调用
        const skillInput = parseSkillInput(trimmed);
        if (skillInput) {
          const skill = getSkill(skillInput.skillName);
          if (skill) {
            const prompt = buildSkillPrompt(skill, skillInput.args);
            console.log(LAIN_COLORS.muted(`\n[${skill.name}] ${skill.description}`));
            try {
              await agent.runLoop(prompt);
              console.log(LAIN_COLORS.success('\n[OK] Done\n'));
            } catch (error: any) {
              console.log(LAIN_COLORS.error(`\n[ERR] Error: ${error.message}\n`));
            }
            saveSession(process.cwd(), agent.getMessages());
            continue;
          }
        }

        // 执行请求
        console.log('');
        try {
          await agent.runLoop(trimmed);
          console.log(LAIN_COLORS.success('\n[OK] Done\n'));
        } catch (error: any) {
          console.log(LAIN_COLORS.error(`\n[ERR] Error: ${error.message}\n`));
        }

        // 自动保存会话
        saveSession(process.cwd(), agent.getMessages());
      }

      // 退出时保存
      saveSession(process.cwd(), agent.getMessages());
      console.log(LAIN_COLORS.muted('\nGoodbye!\n'));

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

    setupAgentEvents(agent, false);

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
          console.log(`  ${isDefault ? LAIN_COLORS.success('●') : '○'} ${p}${isDefault ? LAIN_COLORS.success(' (default)') : ''}`);
        });
      }

      console.log(LAIN_COLORS.primary.bold('\nBuilt-in providers:'));
      Object.entries(BUILTIN_PROVIDERS).forEach(([key, config]) => {
        const isConfigured = configured && configured.includes(key);
        console.log(`  ${isConfigured ? [OK] : ' '} ${key} - ${config.name}`);
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
    if (!action) {
      // 默认显示状态
      const manager = getMCPManager();
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
        const configPath = join(os.homedir(), '.spica', 'mcp.json');
        if (await fs.pathExists(configPath)) {
          console.log(LAIN_COLORS.warning(`Config already exists at ${configPath}`));
          console.log(LAIN_COLORS.muted('Edit it manually to add servers'));
        } else {
          await fs.ensureDir(join(os.homedir(), '.spica'));
          await fs.writeJson(configPath, generateExampleConfig(), { spaces: 2 });
          console.log(LAIN_COLORS.success(`[OK] Created example config at ${configPath}`));
          console.log(LAIN_COLORS.muted('Edit the file to configure your MCP servers'));
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