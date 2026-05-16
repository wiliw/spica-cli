// Serial Experiments Lain 配色方案
// 赛博朋克风格：冷色调、深色背景、红色警告

import chalk from 'chalk';
import readline from 'readline';
import { padRight, getStringWidth } from './stringWidth';

// Lain经典配色
export const LAIN_COLORS = {
  // 主色调 - 冷色系
  primary: chalk.hex('#00CED1'),
  secondary: chalk.hex('#7B68EE'),
  accent: chalk.hex('#00BFFF'),

  // 状态色
  success: chalk.hex('#00FA9A'),
  error: chalk.hex('#FF4444'),
  warning: chalk.hex('#FF6B6B'),

  // 界面色
  border: chalk.hex('#4169E1'),
  prompt: chalk.hex('#00CED1'),
  muted: chalk.hex('#696969'),
  dim: chalk.hex('#4A4A4A'),

  // 特殊色
  reasoning: chalk.hex('#9370DB'),
  tool: chalk.hex('#20B2AA'),
  file: chalk.hex('#5F9EA0'),
  diffAdd: chalk.hex('#00FA9A'),
  diffRemove: chalk.hex('#FF6B6B'),

  // 权限请求
  permissionBorder: chalk.hex('#DC143C'),
  permissionTitle: chalk.hex('#FF0000').bold,
  permissionText: chalk.hex('#F0F0F0'),

  // Bypass模式
  bypass: chalk.hex('#FF8C00'),
  bypassAuto: chalk.hex('#FFA500'),

  // 子agent
  subAgent: chalk.hex('#708090'),

  // 背景
  bg: chalk.bgHex('#0D1117'),
  bgAlt: chalk.bgHex('#1A1B26'),
  bgBorder: chalk.bgHex('#161B22'),
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
      // 先打印初始空行（一行）和banner（5行）
      process.stdout.write('\n');
      const dimColor = esc + '[38;2;0;60;63m';
      lines.forEach(line => process.stdout.write(dimColor + line + reset + '\n'));

      // 入场渐变
      const fadeIn = async () => {
        for (let t = 1; t <= 5; t++) {
          const g = 60 + t * 35;
          const color = esc + `[38;2;0;${g};${g+3}m`;
          // 上移5行重写
          process.stdout.write(esc + '[5A');
          lines.forEach(line => process.stdout.write(color + line + reset + '\n'));
          await new Promise(r => setTimeout(r, 80));
        }
      };

      // 呼吸渐变（持续直到收到停止信号）
      const breathe = async () => {
        while (!BG._bannerStopSignal) {
          // 渐暗
          for (let dim = 0; dim < 6 && !BG._bannerStopSignal; dim++) {
            const g = 206 - dim * 15;
            const color = esc + `[38;2;0;${g};${g+3}m`;
            process.stdout.write(esc + '[5A');
            lines.forEach(line => process.stdout.write(color + line + reset + '\n'));
            await new Promise(r => setTimeout(r, 100));
          }
          // 渐亮
          for (let dim = 5; dim >= 0 && !BG._bannerStopSignal; dim--) {
            const g = 206 - dim * 15;
            const color = esc + `[38;2;0;${g};${g+3}m`;
            process.stdout.write(esc + '[5A');
            lines.forEach(line => process.stdout.write(color + line + reset + '\n'));
            await new Promise(r => setTimeout(r, 100));
          }
        }

        // 停止后恢复最亮状态并空一行
        const cyan = esc + '[38;2;0;206;209m';
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

  // Compression spinner - shows during context compression
  compressSpinner: (): Promise<void> => {
    const reset = '\x1b[0m';
    const esc = '\x1b';
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const color = esc + '[38;2;0;206;209m'; // Cyan

    BG._compressStopSignal = false;

    return new Promise<void>((resolve) => {
      let frameIndex = 0;

      const spin = async () => {
        while (!BG._compressStopSignal) {
          const frame = frames[frameIndex % frames.length];
          // Write spinner frame
          process.stdout.write(color + frame + ' Compressing...' + reset);
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