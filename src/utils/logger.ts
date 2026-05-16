import chalk from 'chalk';
import ora from 'ora';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('✓'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  step: (msg: string) => console.log(chalk.cyan('→'), msg),
};

export function spinner(text: string) {
  return ora(text).start();
}