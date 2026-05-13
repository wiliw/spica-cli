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
import { parseSkillInput, getSkill, buildSkillPrompt, listSkills } from './skills';
import { LAIN_COLORS, format, BG } from './utils/colors';
import prompts from 'prompts';

const program = new Command();

// 当前agent引用（用于中断）
let currentAgent: SpicaAgent | null = null;

// 设置背景色
function enableBackground(): void {
  // 检查是否是交互式终端
  if (process.stdout.isTTY) {
    BG.set();
  }
}

// 恢复默认背景
function disableBackground(): void {
  if (process.stdout.isTTY) {
    BG.reset();
  }
}

// Ctrl+C中断处理
process.on('SIGINT', () => {
  if (currentAgent) {
    currentAgent.interrupt();
    console.log(LAIN_COLORS.warning('\n⚠ Interrupted'));
  } else {
    disableBackground();
    process.exit(0);
  }
});

// 退出时恢复背景
process.on('exit', () => {
  disableBackground();
});

// 设置agent事件监听
function setupAgentEvents(agent: SpicaAgent, interactive: boolean = false) {
  let lastWasReasoning = false;

  // 连接错误事件
  agent.on('connection_error', (data: any) => {
    console.log(LAIN_COLORS.error('\n✗ API连接失败'));
    console.log(LAIN_COLORS.error(`  类型: ${data.type}`));
    console.log(LAIN_COLORS.warning(`  提示: ${data.hint}`));
    console.log(LAIN_COLORS.muted(`  详情: ${data.error}`));
    console.log(LAIN_COLORS.muted(`  Provider: ${data.provider}, Model: ${data.model}`));
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
    console.log(LAIN_COLORS.tool(`→ ${data.name}`));
  });

  agent.on('tool_result', (data: any) => {
    const icon = data.success ? LAIN_COLORS.success('✓') : LAIN_COLORS.error('✗');
    const output = (data.output || data.error || '').replace(/\n/g, ' ').slice(0, 80);
    console.log(`${icon} ${data.name}: ${output}`);
  });

  agent.on('diff_preview', (data: any) => {
    console.log(LAIN_COLORS.file(`\n📄 ${data.filePath}`));
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
    console.log(LAIN_COLORS.warning(`💡 ${data.suggestion}`));
  });

  agent.on('workspace_changed', (data: any) => {
    console.log(LAIN_COLORS.file(`📁 Workspace: ${data.path}`));
  });

  // Bypass模式事件
  agent.on('bypass_changed', (data: any) => {
    if (data.enabled) {
      console.log(LAIN_COLORS.bypass('⚠ Bypass mode activated'));
    } else {
      console.log(LAIN_COLORS.success('✓ Strict mode activated'));
    }
  });

  agent.on('permission_bypassed', (data: any) => {
    console.log(LAIN_COLORS.bypassAuto(`⚡ Auto-approved: ${data.reason}`));
  });

  // 子agent事件
  agent.on('sub_agent_start', (data: any) => {
    console.log(LAIN_COLORS.subAgent(`  [${data.type || 'sub'}] ${data.description}`));
  });

  agent.on('sub_agent_tool_call', (data: any) => {
    console.log(LAIN_COLORS.subAgent(`    → [sub] ${data.name}`));
  });

  agent.on('sub_agent_tool_result', (data: any) => {
    const icon = data.success ? LAIN_COLORS.success('✓') : LAIN_COLORS.error('✗');
    console.log(LAIN_COLORS.subAgent(`    ${icon} [sub] ${data.name}`));
  });

  agent.on('sub_agent_done', (data: any) => {
    console.log(LAIN_COLORS.success(`  ✓ [sub] Done: ${data.summary.slice(0, 50)}`));
  });

  agent.on('sub_agent_error', (data: any) => {
    console.log(LAIN_COLORS.error(`  ✗ [sub] Error: ${data.error}`));
  });

  // Hooks事件
  agent.on('hook_blocked', (data: any) => {
    console.log(LAIN_COLORS.error(`🚫 Blocked: ${data.tool} - ${data.reason}`));
  });

  agent.on('hook_warning', (data: any) => {
    console.log(LAIN_COLORS.warning(`⚠ ${data.message}`));
  });

  agent.on('hook_log', (data: any) => {
    console.log(LAIN_COLORS.muted(`📋 ${data.message}`));
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

    // 设置Lain背景色
    enableBackground();

    // 极简banner
    BG.banner();

    try {
      await agent.init();

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
            console.log(LAIN_COLORS.warning('⚠ Bypass mode ON - All permissions will be auto-approved'));
            console.log(LAIN_COLORS.muted('Use /strict to restore permission checks'));
            continue;
          }

          if (cmd === 'strict') {
            agent.setBypassPermissions(false);
            console.log(LAIN_COLORS.success('✓ Strict mode ON - Permissions will be requested'));
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
  skills     - List available skills
  Ctrl+C     - Interrupt current operation

Mode Control:
  /bypass    - Skip all permission requests (auto-approve)
  /strict    - Restore permission requests
  /status    - Show current status

Skills (use /skill_name args):
  /search <query>   - Quick code search
  /review <files>   - Code review
  /fix <issue>      - Fix specific issue
  /explain <target> - Explain code logic
  /test <filter>    - Run tests
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
  skills     - List available skills
  Ctrl+C     - Interrupt current operation

Mode Control:
  /bypass    - Skip all permission requests (auto-approve)
  /strict    - Restore permission requests
  /status    - Show current status

Skills (use /skill_name args):
  /search <query>   - Quick code search
  /review <files>   - Code review
  /fix <issue>      - Fix specific issue
  /explain <target> - Explain code logic
  /test <filter>    - Run tests
`));
          continue;
        }

        if (trimmed === 'save') {
          saveSession(process.cwd(), agent.getMessages());
          console.log(LAIN_COLORS.success('✓ Session saved'));
          continue;
        }

        if (trimmed === 'skills') {
          const skills = listSkills();
          console.log(LAIN_COLORS.primary.bold('\nAvailable skills:'));
          skills.forEach(s => {
            console.log(LAIN_COLORS.muted(`  /${s.name} - ${s.description}`));
          });
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
              console.log(LAIN_COLORS.success('\n✓ Done\n'));
            } catch (error: any) {
              console.log(LAIN_COLORS.error(`\n✗ Error: ${error.message}\n`));
            }
            saveSession(process.cwd(), agent.getMessages());
            continue;
          }
        }

        // 执行请求
        console.log('');
        try {
          await agent.runLoop(trimmed);
          console.log(LAIN_COLORS.success('\n✓ Done\n'));
        } catch (error: any) {
          console.log(LAIN_COLORS.error(`\n✗ Error: ${error.message}\n`));
        }

        // 自动保存会话
        saveSession(process.cwd(), agent.getMessages());
      }

      // 退出时保存
      saveSession(process.cwd(), agent.getMessages());
      console.log(LAIN_COLORS.muted('\nGoodbye!\n'));
      disableBackground();

    } catch (error: any) {
      console.log(LAIN_COLORS.error(`Error: ${error.message}`));
      disableBackground();
    }

    currentAgent = null;
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
      console.log(LAIN_COLORS.success('\n✓ Completed'));
    } catch (error: any) {
      console.log(LAIN_COLORS.error(`Error: ${error.message}`));
    }

    currentAgent = null;
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
        const isConfigured = configured.includes(key);
        console.log(`  ${isConfigured ? '✓' : ' '} ${key} - ${config.name}`);
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
        console.log(LAIN_COLORS.success(`✓ Provider '${name}' configured`));
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
        console.log(LAIN_COLORS.success(`✓ Custom provider '${name}' added`));
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
          console.log(LAIN_COLORS.success(`✓ Default provider set to '${name}'`));
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
          console.log(LAIN_COLORS.success(`✓ Provider '${name}' removed`));
        } else {
          console.log(LAIN_COLORS.error(`Provider '${name}' not found in configured providers`));
        }
        break;

      default:
        console.log(LAIN_COLORS.warning('Available actions: list, set, add, show, default, remove'));
    }
  });

program.parse();