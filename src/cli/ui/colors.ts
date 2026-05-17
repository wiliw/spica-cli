// ANSI 标准配色方案
// 使用终端标准颜色，跟随用户的终端配色设置

import chalk from 'chalk';
import readline from 'readline';
import { padRight, getStringWidth } from './stringWidth';

// ANSI 标准配色（跟随终端设置）
export const LAIN_COLORS = {
  // 主色调 - 使用亮色版本 (bright colors)
  primary: chalk.cyanBright,
  secondary: chalk.magentaBright,
  accent: chalk.blueBright,

  // 状态色
  success: chalk.greenBright,
  error: chalk.redBright,
  warning: chalk.yellowBright,

  // 界面色
  border: chalk.blue,
  prompt: chalk.cyanBright,
  muted: chalk.gray,
  dim: chalk.dim,

  // 特殊色
  reasoning: chalk.magenta,
  tool: chalk.cyan,
  file: chalk.blue,
  diffAdd: chalk.greenBright,
  diffRemove: chalk.redBright,

  // 权限请求
  permissionBorder: chalk.red.bold,
  permissionTitle: chalk.red.bold,
  permissionText: chalk.whiteBright,

  // Bypass模式
  bypass: chalk.yellow,
  bypassAuto: chalk.yellowBright,

  // 子agent
  subAgent: chalk.gray,

  // 背景 - ANSI 不支持自定义背景色，使用标准背景
  bg: chalk.bgBlack,
  bgAlt: chalk.bgBlackBright,
  bgBorder: chalk.bgBlack,
};

// ANSI背景色控制
export const BG = {
  _bannerStopSignal: false,
  _compressStopSignal: false,

  banner: (): Promise<void> => {
    const reset = '\x1b[0m';
    const esc = '\x1b';
    const lines = [
      '              _)              ',
      '   __|  __ \\   |   __|   _` | ',
      ' \\__ \\  |   |  |  (     (   | ',
      ' ____/  .__/  _| \\___| \\__,_| ',
      '       _|                     ',
    ];

    BG._bannerStopSignal = false;

    return new Promise<void>((resolve) => {
      // 使用终端标准 cyan 颜色
      const cyanBright = '\x1b[96m'; // bright cyan (cyanBright)

      // 打印 banner（1空行 + 5行 = 6行）
      process.stdout.write('\n');
      lines.forEach(line => process.stdout.write(cyanBright + line + reset + '\n'));

      // 简单的呼吸动画（亮度变化）
      const breathe = async () => {
        const cyanNormal = '\x1b[36m'; // normal cyan
        while (!BG._bannerStopSignal) {
          // 渐暗
          for (let i = 0; i < 3 && !BG._bannerStopSignal; i++) {
            process.stdout.write(esc + '[5A');
            lines.forEach(line => process.stdout.write(cyanNormal + line + reset + '\n'));
            await new Promise(r => setTimeout(r, 200));
            if (BG._bannerStopSignal) break;
          }
          // 渐亮
          for (let i = 0; i < 3 && !BG._bannerStopSignal; i++) {
            process.stdout.write(esc + '[5A');
            lines.forEach(line => process.stdout.write(cyanBright + line + reset + '\n'));
            await new Promise(r => setTimeout(r, 200));
            if (BG._bannerStopSignal) break;
          }
        }

        // 停止后恢复亮色并空一行
        process.stdout.write(esc + '[5A');
        lines.forEach(line => process.stdout.write(cyanBright + line + reset + '\n'));
        process.stdout.write('\n');

        resolve();
      };

      // 延迟后开始呼吸
      setTimeout(breathe, 500);
    });
  },

  stopBanner: () => {
    BG._bannerStopSignal = true;
  },

  // Compression spinner - shows during context compression
  compressSpinner: (): Promise<void> => {
    const reset = '\x1b[0m';
    const esc = '\x1b';
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const cyan = '\x1b[96m'; // bright cyan

    BG._compressStopSignal = false;

    return new Promise<void>((resolve) => {
      let frameIndex = 0;

      const spin = async () => {
        while (!BG._compressStopSignal) {
          const frame = frames[frameIndex % frames.length];
          // Write spinner frame
          process.stdout.write(cyan + frame + ' Compressing...' + reset);
          await new Promise(r => setTimeout(r, 80));
          // Clear line
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
    const icon = success ? LAIN_COLORS.success('✓') : LAIN_COLORS.error('✗');
    return `${icon} ${name}: ${output}`;
  },
  reasoning: (content: string) => LAIN_COLORS.reasoning(content),
  diffFile: (path: string) => LAIN_COLORS.file(`📄 ${path}`),
  diffAdd: (line: string) => LAIN_COLORS.diffAdd(`+ ${line}`),
  diffRemove: (line: string) => LAIN_COLORS.diffRemove(`- ${line}`),
  permissionBox: (reason: string) => {
    const border = LAIN_COLORS.permissionBorder;
    const title = LAIN_COLORS.permissionTitle;
    const text = LAIN_COLORS.permissionText;
    const dimBorder = LAIN_COLORS.muted('─'.repeat(50));
    return `
${border('═'.repeat(50))}
${title('  ⚠  PERMISSION REQUIRED')}
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