import chalk from 'chalk';
import ora from 'ora';
export const logger = {
    info: (msg) => console.log(chalk.blue('✓'), msg),
    success: (msg) => console.log(chalk.green('✓'), msg),
    error: (msg) => console.log(chalk.red('✗'), msg),
    warning: (msg) => console.log(chalk.yellow('⚠'), msg),
    step: (msg) => console.log(chalk.cyan('→'), msg),
};
export function spinner(text) {
    return ora(text).start();
}
//# sourceMappingURL=logger.js.map