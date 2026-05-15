// 清晰配色方案 - 语义明确、对比度高
// 适配深色和浅色终端背景

import chalk from 'chalk';
import readline from 'readline';
import { padRight, getStringWidth } from './stringWidth';

// 核心配色 - ANSI标准色为主，确保兼容性
export const LAIN_COLORS = {
  // 主要输出 - AI回复
  primary: chalk.cyanBright,

  // 次要信息
  secondary: chalk.blueBright,

  // 状态
  success: chalk.greenBright,
  error: chalk.redBright,
  warning: chalk.yellowBright,

  // 提示符
  prompt: chalk.cyan,

  // 次要文本（说明、提示）
  muted: chalk.gray,
  dim: chalk.dim,

  // 工具调用 - 使用箭头标识
  tool: chalk.blue,

  // 文件路径
  file: chalk.white,

  // Diff
  diffAdd: chalk.green,
  diffRemove: chalk.red,

  // Reasoning（思维过程）
  reasoning: chalk.magentaBright,

  // 权限请求 - 高警示
  permissionBorder: chalk.red,
  permissionTitle: chalk.redBright.bold,
  permissionText: chalk.white,

  // Bypass模式 - 警示色
  bypass: chalk.yellow,
  bypassAuto: chalk.yellowBright,

  // 子agent
  subAgent: chalk.gray,

  // 上下文压缩
  compress: chalk.blueBright,
};

// ANSI背景色控制
export const BG = {
  _bannerStopSignal: false,
  _compressStopSignal: false,

  banner: (): Promise<void> => {
    const reset = '\x1b[0m';
    const esc = '\x1b';
    const cyan = '\x1b[36m'; // ANSI cyan
    const dimCyan = '\x1b[36;2m'; // dim cyan
    const lines = [
      '              _)              ',
      '   __|  __ \\   |   __|   _` | ',
      ' \\__ \\  |   |  |  (     (   | ',
      ' ____/  .__/  _| \\___| \\__,_| ',
      '       _|                     ',
    ];

    BG._bannerStopSignal = false;

    return new Promise<void>((resolve) => {
      // 打印空行和banner
      process.stdout.write('\n');
      lines.forEach(line => process.stdout.write(dimCyan + line + reset + '\n'));

      // 简单渐入
      const fadeIn = async () => {
        for (let i = 0; i < 3 && !BG._bannerStopSignal; i++) {
          await new Promise(r => setTimeout(r, 100));
        }
        // 显示亮色
        process.stdout.write(esc + '[5A');
        lines.forEach(line => process.stdout.write(cyan + line + reset + '\n'));
      };

      // 简单呼吸效果
      const breathe = async () => {
        while (!BG._bannerStopSignal) {
          // 变暗
          process.stdout.write(esc + '[5A');
          lines.forEach(line => process.stdout.write(dimCyan + line + reset + '\n'));
          await new Promise(r => setTimeout(r, 300));
          // 变亮
          if (!BG._bannerStopSignal) {
            process.stdout.write(esc + '[5A');
            lines.forEach(line => process.stdout.write(cyan + line + reset + '\n'));
            await new Promise(r => setTimeout(r, 300));
          }
        }

        // 停止后显示亮色
        process.stdout.write(esc + '[5A');
        lines.forEach(line => process.stdout.write(cyan + line + reset + '\n'));
        process.stdout.write('\n');
        resolve();
      };

      fadeIn().then(breathe);
    });
  },

  stopBanner: () => {
    BG._bannerStopSignal = true;
  },

  // Compression spinner
  compressSpinner: (): Promise<void> => {
    const reset = '\x1b[0m';
    const esc = '\x1b';
    const cyan = '\x1b[36m';
    const frames = ['|', '/', '-', '\\'];

    BG._compressStopSignal = false;

    return new Promise<void>((resolve) => {
      let frameIndex = 0;

      const spin = async () => {
        while (!BG._compressStopSignal) {
          const frame = frames[frameIndex % frames.length];
          process.stdout.write(cyan + frame + ' Compressing...' + reset);
          await new Promise(r => setTimeout(r, 100));
          process.stdout.write(esc + '[2K' + esc + '[1G');
          frameIndex++;
        }
        resolve();
      };

      spin();
    });
  },

  stopCompress: () => {
    BG._compressStopSignal = true;
  },
};

// 格式化函数
export const format = {
  prompt: () => LAIN_COLORS.prompt('>'),
  success: (text: string) => LAIN_COLORS.success(text),
  error: (text: string) => LAIN_COLORS.error(text),
  warning: (text: string) => LAIN_COLORS.warning(text),
  toolCall: (name: string) => LAIN_COLORS.tool(`→ ${name}`),
  toolResult: (name: string, success: boolean, output: string) => {
    const icon = success ? LAIN_COLORS.success('[OK]') : LAIN_COLORS.error('[ERR]');
    return `${icon} ${name}: ${output}`;
  },
  reasoning: (content: string) => LAIN_COLORS.reasoning(content),
  diffFile: (path: string) => LAIN_COLORS.file(`[FILE] ${path}`),
  diffAdd: (line: string) => LAIN_COLORS.diffAdd(`+ ${line}`),
  diffRemove: (line: string) => LAIN_COLORS.diffRemove(`- ${line}`),
  permissionBox: (reason: string) => {
    const border = LAIN_COLORS.permissionBorder;
    const title = LAIN_COLORS.permissionTitle;
    const text = LAIN_COLORS.permissionText;
    const dimBorder = LAIN_COLORS.muted('─'.repeat(50));
    return `
${border('═'.repeat(50))}
${title('  [WARN] PERMISSION REQUIRED')}
${border('═'.repeat(50))}
${text(`  Action: ${reason}`)}
${dimBorder}
`;
  },
  status: (bypass: boolean, msgs: number, workspace: string) => {
    const mode = bypass ? LAIN_COLORS.warning('BYPASS') : LAIN_COLORS.success('STRICT');
    return `
${LAIN_COLORS.primary.bold('Current Status:')}
  Permission mode: ${mode}
  Messages in context: ${msgs}
  Workspace: ${workspace}
`;
  },
  muted: (text: string) => LAIN_COLORS.muted(text),
  dim: (text: string) => LAIN_COLORS.dim(text),
  // 表格格式化（支持中英文对齐）
  tableRow: (columns: string[], widths: number[]) => {
    return columns.map((col, i) => {
      const padded = padRight(col, widths[i] || 10);
      return LAIN_COLORS.muted(padded);
    }).join(' | ');
  },
  // 状态表格
  statusTable: (items: Array<{ label: string; value: string }>) => {
    const maxLabelWidth = Math.max(...items.map(i => getStringWidth(i.label))) + 2;
    return items.map(i => {
      const label = padRight(i.label + ':', maxLabelWidth);
      return `  ${LAIN_COLORS.muted(label)} ${LAIN_COLORS.primary(i.value)}`;
    }).join('\n');
  },
};