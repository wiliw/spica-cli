import chalk from 'chalk';
import ora from 'ora';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('[INFO]'), msg),
  success: (msg: string) => console.log(chalk.green('[OK]'), msg),
  error: (msg: string) => console.log(chalk.red('[ERR]'), msg),
  warning: (msg: string) => console.log(chalk.yellow('[WARN]'), msg),
  step: (msg: string) => console.log(chalk.cyan('[STEP]'), msg),
};

export function spinner(text: string) {
  return ora(text).start();
}