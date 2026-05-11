#!/usr/bin/env node
import { Command } from 'commander';
import { SpicaAgent } from './agent';
import { loadConfig, setProviderConfig, getProviderConfig, listProviders, setDefaultProvider, BUILTIN_PROVIDERS, } from './utils/config';
import { logger } from './utils/logger';
import chalk from 'chalk';
const program = new Command();
program
    .name('spica')
    .description('AI coding agent with three-step workflow: mvp → cycle → archive')
    .version('1.0.0');
// Default: launch TUI
program.action(async () => {
    const { runTUI } = await import('./tui/index');
    await runTUI();
});
program
    .command('mvp <description>')
    .description('Start new project MVP')
    .option('-p, --provider <name>', 'Use specific provider')
    .action(async (description, options) => {
    const agent = new SpicaAgent(options.provider);
    await agent.executeMVP(description);
});
program
    .command('cycle <request>')
    .description('Quick iteration cycle')
    .option('-p, --provider <name>', 'Use specific provider')
    .action(async (request, options) => {
    const agent = new SpicaAgent(options.provider);
    await agent.executeCycle(request);
});
program
    .command('archive [version]')
    .description('Archive and finalize (default: v1.0)')
    .action(async (version = 'v1.0') => {
    const agent = new SpicaAgent();
    await agent.executeArchive(version);
});
program
    .command('providers')
    .description('Manage LLM providers')
    .argument('[action]', 'list|set|default|show')
    .argument('[name]', 'Provider name')
    .argument('[apiKey]', 'API key')
    .option('-b, --baseUrl <url>', 'Base URL')
    .option('-m, --model <model>', 'Model name')
    .action(async (action, name, apiKey, options) => {
    if (!action || action === 'list') {
        const providers = await listProviders();
        const config = await loadConfig();
        console.log(chalk.bold('\nConfigured Providers:'));
        providers.forEach(p => {
            const isDefault = config.defaultProvider === p;
            const marker = isDefault ? chalk.green(' (default)') : '';
            console.log(`  ${chalk.cyan(p)}${marker}`);
        });
        console.log(chalk.bold('\nAvailable Providers:'));
        Object.keys(BUILTIN_PROVIDERS).forEach(p => {
            const info = BUILTIN_PROVIDERS[p];
            const configured = providers.includes(p);
            const marker = configured ? chalk.green(' ✓') : chalk.gray(' ○');
            console.log(`  ${chalk.cyan(p)}${marker} - ${info.description}`);
        });
        console.log('');
    }
    else if (action === 'set' && name && apiKey) {
        await setProviderConfig(name, apiKey, options?.baseUrl, options?.model);
        logger.success(`Provider '${name}' configured`);
    }
    else if (action === 'default' && name) {
        await setDefaultProvider(name);
        logger.success(`Default provider set to '${name}'`);
    }
    else if (action === 'show' && name) {
        const config = await getProviderConfig(name);
        console.log(chalk.bold(`\nProvider: ${config.name}`));
        console.log(`  API Key: ${config.apiKey.substring(0, 10)}...`);
        console.log(`  Base URL: ${config.baseUrl}`);
        console.log(`  Model: ${config.model}`);
        console.log('');
    }
    else {
        console.log('Usage:');
        console.log('  spica providers              - List providers');
        console.log('  spica providers set <name> <key> - Configure');
        console.log('  spica providers default <name>   - Set default');
        console.log('  spica providers show <name>      - Show details');
    }
});
program.parse();
//# sourceMappingURL=index.js.map