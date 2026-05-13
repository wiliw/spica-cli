#!/usr/bin/env node
import { Command } from 'commander';
import { SpicaAgent } from './agent';
import {
  loadConfig,
  setProviderConfig,
  getProviderConfig,
  listProviders,
  BUILTIN_PROVIDERS,
} from './utils/config';
import { loadSession, saveSession } from './utils/session';
import { parseSkillInput, getSkill, buildSkillPrompt, listSkills } from './skills';
import chalk from 'chalk';
import prompts from 'prompts';

const program = new Command();

// 当前agent引用（用于中断）
let currentAgent: SpicaAgent | null = null;

// reasoning累积（只在完成时打印一次）
let reasoningBuffer = '';

// 设置agent事件监听
function setupAgentEvents(agent: SpicaAgent, interactive: boolean = false) {
  agent.on('stream', (data: any) => {
    // assistant回复，不打印reasoning（让用户看到回复）
    process.stdout.write(data.chunk);
  });

  agent.on('reasoning', (data: any) => {
    // 只累积，不打印
    reasoningBuffer += data.content;
  });

  agent.on('tool_call', (data: any) => {
    // 工具调用时如果有reasoning，打印完整内容
    if (reasoningBuffer.trim()) {
      console.log(chalk.magenta(`\n💭 ${reasoningBuffer.trim()}\n`));
      reasoningBuffer = '';
    }
    console.log(chalk.cyan(`→ ${data.name}`));
  });

  agent.on('tool_result', (data: any) => {
    const icon = data.success ? chalk.green('✓') : chalk.red('✗');
    const output = (data.output || data.error || '').replace(/\n/g, ' ').slice(0, 80);
    console.log(`${icon} ${data.name}: ${output}`);
  });

  agent.on('diff_preview', (data: any) => {
    console.log(chalk.blue(`\n📄 ${data.filePath}`));
    // diff already has colors from formatDiff, so don't wrap it
    if (data.diff) {
      console.log(data.diff);
    }
  });

  agent.on('permission_request', async (data: any) => {
    // 权限请求前，如果有reasoning打印
    if (reasoningBuffer.trim()) {
      console.log(chalk.magenta(`\n💭 ${reasoningBuffer.trim()}\n`));
      reasoningBuffer = '';
    }
    // 清晰的权限提示
    console.log('\n' + chalk.yellow('═'.repeat(50)));
    console.log(chalk.yellow.bold('⚠  PERMISSION REQUIRED'));
    console.log(chalk.yellow('═'.repeat(50)));
    console.log(chalk.white(`  Action: ${data.reason}`));
    console.log(chalk.gray('─'.repeat(50)));
    const answer = await prompts({
      type: 'confirm',
      name: 'approve',
      message: chalk.bold('Do you want to allow this action?'),
      initial: false,
    });
    console.log(chalk.yellow('═'.repeat(50)) + '\n');
    if (answer.approve) {
      agent.approvePermission();
    } else {
      agent.denyPermission();
    }
  });

  agent.on('error_suggestion', (data: any) => {
    console.log(chalk.yellow(`💡 Suggestion: ${data.suggestion}`));
  });

  agent.on('workspace_changed', (data: any) => {
    console.log(chalk.blue(`📁 Workspace: ${data.path}`));
  });

  // message事件 - 结束时若有剩余reasoning则打印
  agent.on('message', (data: any) => {
    if (data.role === 'assistant' && reasoningBuffer.trim()) {
      console.log(chalk.magenta(`\n💭 ${reasoningBuffer.trim()}\n`));
      reasoningBuffer = '';
    }
  });

  // 子agent事件
  agent.on('sub_agent_start', (data: any) => {
    console.log(chalk.gray(`  [${data.type || 'sub'}] ${data.description}`));
  });

  agent.on('sub_agent_tool_call', (data: any) => {
    console.log(chalk.gray(`    → [sub] ${data.name}`));
  });

  agent.on('sub_agent_tool_result', (data: any) => {
    const icon = data.success ? chalk.green('✓') : chalk.red('✗');
    console.log(chalk.gray(`    ${icon} [sub] ${data.name}`));
  });

  agent.on('sub_agent_done', (data: any) => {
    console.log(chalk.green(`  ✓ [sub] Done: ${data.summary.slice(0, 50)}`));
  });

  agent.on('sub_agent_error', (data: any) => {
    console.log(chalk.red(`  ✗ [sub] Error: ${data.error}`));
  });

  // Hooks事件
  agent.on('hook_blocked', (data: any) => {
    console.log(chalk.red(`🚫 Blocked: ${data.tool} - ${data.reason}`));
  });

  agent.on('hook_warning', (data: any) => {
    console.log(chalk.yellow(`⚠ Warning: ${data.message}`));
  });

  agent.on('hook_log', (data: any) => {
    console.log(chalk.gray(`📋 ${data.message}`));
  });
}

// Ctrl+C中断处理
process.on('SIGINT', () => {
  if (currentAgent) {
    currentAgent.interrupt();
    console.log(chalk.yellow('\n⚠ Interrupted'));
  } else {
    process.exit(0);
  }
});

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
      console.log(chalk.red(`Provider "${providerName}" not configured.`));
      console.log(chalk.yellow('Set up with: spica providers set <name> <api-key>'));
      return;
    }

    const agent = new SpicaAgent(providerName, process.cwd());
    currentAgent = agent;

    setupAgentEvents(agent, true);

    try {
      await agent.init();

      // 恢复上次会话
      if (options.continue) {
        const session = loadSession(process.cwd());
        if (session) {
          agent.setMessages(session.messages);
          console.log(chalk.green('✓ Restored previous session'));
        } else {
          console.log(chalk.yellow('No previous session found'));
        }
      }

      console.log(chalk.gray(`\nModel: ${providerConfig.model}`));
      console.log(chalk.gray('Type your request, Ctrl+C to interrupt, "quit" to exit\n'));

      // REPL循环
      while (true) {
        const input = await prompts({
          type: 'text',
          name: 'prompt',
          message: chalk.green('>'),
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
          console.log(chalk.gray('Session cleared'));
          continue;
        }

        if (trimmed === 'save') {
          saveSession(process.cwd(), agent.getMessages());
          console.log(chalk.green('✓ Session saved'));
          continue;
        }

        if (trimmed === 'help') {
          console.log(chalk.gray(`
Commands:
  quit/exit  - Exit spica
  clear      - Clear session history
  save       - Save current session
  help       - Show this help
  skills     - List available skills
  Ctrl+C     - Interrupt current operation

Skills (use /skill_name args):
  /search <query>   - Quick code search
  /review <files>   - Code review
  /fix <issue>      - Fix specific issue
  /explain <target> - Explain code logic
  /test <filter>    - Run tests
`));
          continue;
        }

        if (trimmed === 'skills') {
          const skills = listSkills();
          console.log(chalk.bold('\nAvailable skills:'));
          skills.forEach(s => {
            console.log(chalk.gray(`  /${s.name} - ${s.description}`));
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
            console.log(chalk.gray(`\n[${skill.name}] ${skill.description}`));
            reasoningBuffer = '';
            try {
              await agent.runLoop(prompt);
              // 结束时若有剩余reasoning则打印
              if (reasoningBuffer.trim()) {
                console.log(chalk.magenta(`\n💭 ${reasoningBuffer.trim()}\n`));
                reasoningBuffer = '';
              }
              console.log(chalk.green('\n✓ Done\n'));
            } catch (error: any) {
              console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
            }
            saveSession(process.cwd(), agent.getMessages());
            continue;
          }
        }

        // 执行请求
        console.log('');
        reasoningBuffer = '';
        try {
          await agent.runLoop(trimmed);
          // 结束时若有剩余reasoning则打印
          if (reasoningBuffer.trim()) {
            console.log(chalk.magenta(`\n💭 ${reasoningBuffer.trim()}\n`));
            reasoningBuffer = '';
          }
          console.log(chalk.green('\n✓ Done\n'));
        } catch (error: any) {
          console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
        }

        // 自动保存会话
        saveSession(process.cwd(), agent.getMessages());
      }

      // 退出时保存
      saveSession(process.cwd(), agent.getMessages());
      console.log(chalk.gray('\nGoodbye!\n'));

    } catch (error: any) {
      console.log(chalk.red(`Error: ${error.message}`));
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
      console.log(chalk.red(`Provider "${providerName}" not configured.`));
      console.log(chalk.yellow('Set up with: spica providers set <name> <api-key>'));
      return;
    }

    const agent = new SpicaAgent(providerName, process.cwd());
    currentAgent = agent;

    setupAgentEvents(agent, false);

    try {
      await agent.init();
      const result = await agent.runLoop(request);
      console.log(chalk.green('\n✓ Completed'));
    } catch (error: any) {
      console.log(chalk.red(`Error: ${error.message}`));
    }

    currentAgent = null;
  });

// Providers管理
program
  .command('providers')
  .description('Manage LLM providers')
  .argument('[action]', 'list|set|show')
  .argument('[name]', 'Provider name')
  .argument('[value]', 'API key')
  .action(async (action?: string, name?: string, value?: string) => {
    if (!action) {
      const configured = await listProviders();
      const defaultProvider = (await loadConfig()).defaultProvider;

      console.log(chalk.bold('Configured:'));
      configured.forEach(p => console.log(`  ${p}${p === defaultProvider ? ' (default)' : ''}`));

      console.log(chalk.bold('\nAvailable:'));
      Object.entries(BUILTIN_PROVIDERS).forEach(([key, config]) => {
        console.log(`  ${key} - ${config.name}`);
      });
      return;
    }

    switch (action) {
      case 'set':
        if (!name || !value) {
          console.log('Usage: spica providers set <name> <api-key>');
          return;
        }
        await setProviderConfig(name, value);
        console.log(chalk.green(`✓ ${name} configured`));
        break;

      case 'show':
        if (!name) name = (await loadConfig()).defaultProvider || 'openai';
        try {
          const config = await getProviderConfig(name);
          console.log(chalk.bold(config.name));
          console.log(`  Key: ${config.apiKey.substring(0, 10)}...`);
          console.log(`  URL: ${config.baseUrl}`);
          console.log(`  Model: ${config.model}`);
        } catch (error: any) {
          console.log(chalk.red(error.message));
        }
        break;

      default:
        console.log('Actions: list, set, show');
    }
  });

program.parse();