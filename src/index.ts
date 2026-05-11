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
import chalk from 'chalk';

const program = new Command();

program
  .name('spica')
  .description('AI coding agent')
  .version('1.0.0');

// Default: TUI
program.action(async () => {
  if (!process.stdin.isTTY) {
    console.log('TUI mode requires a TTY terminal.');
    console.log('Use CLI commands instead:');
    console.log('  spica run "your request"');
    process.exit(1);
  }
  
  const { runTUI } = await import('./tui/index.js');
  await runTUI();
});

// Run command - main execution
program
  .command('run <request>')
  .description('Execute coding task')
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
    
    agent.on('stream', (data: any) => {
      process.stdout.write(data.chunk);
    });
    
    agent.on('tool_call', (data: any) => {
      console.log(chalk.cyan(`→ ${data.name}`));
    });
    
    agent.on('tool_result', (data: any) => {
      console.log(data.success ? chalk.green('✓') : chalk.red('✗'), data.output || data.error);
    });
    
    try {
      await agent.init();
      const result = await agent.runLoop(request);
      console.log(chalk.green('\n✓ Completed'));
    } catch (error: any) {
      console.log(chalk.red(`Error: ${error.message}`));
    }
  });

// Providers management
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