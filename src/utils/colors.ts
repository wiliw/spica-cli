// Serial Experiments Lain 配色方案
// 赛博朋克风格：冷色调、深色背景、红色警告

import chalk from 'chalk';

// Lain经典配色
export const LAIN_COLORS = {
  // 主色调 - 冷色系
  primary: chalk.hex('#00CED1'),      // 深青色 (Dark Turquoise) - 主文字
  secondary: chalk.hex('#7B68EE'),    // 中紫色 - 思考/神秘感
  accent: chalk.hex('#00BFFF'),       // 深天蓝 - 强调

  // 状态色
  success: chalk.hex('#00FA9A'),      // 春绿 - 成功（CRT终端风格）
  error: chalk.hex('#FF4444'),        // 纯红 - 错误（Lain红色警告）
  warning: chalk.hex('#FF6B6B'),      // 淡红 - 警告

  // 界面色
  border: chalk.hex('#4169E1'),       // 皇家蓝 - 边框
  prompt: chalk.hex('#00CED1'),       // 深青色 - 输入提示
  muted: chalk.hex('#696969'),        // 暗灰 - 次要信息
  dim: chalk.hex('#4A4A4A'),          // 深灰 - 最次要

  // 特殊色
  reasoning: chalk.hex('#9370DB'),    // 中紫色 - 思考过程
  tool: chalk.hex('#20B2AA'),         // 浅海绿 - 工具调用
  file: chalk.hex('#5F9EA0'),         // 军校蓝 - 文件路径
  diffAdd: chalk.hex('#00FA9A'),      // 春绿 - 新增行
  diffRemove: chalk.hex('#FF6B6B'),   // 淡红 - 删除行

  // 权限请求 - Lain红色警示框
  permissionBorder: chalk.hex('#DC143C'),    // 深红 - 权限边框
  permissionTitle: chalk.hex('#FF0000').bold, // 纯红加粗 - 权限标题
  permissionText: chalk.hex('#F0F0F0'),      // 淡白 - 权限内容

  // Bypass模式
  bypass: chalk.hex('#FF8C00'),       // 深橙 - bypass警告
  bypassAuto: chalk.hex('#FFA500'),   // 橙色 - 自动批准

  // 子agent
  subAgent: chalk.hex('#708090'),     // 板岩灰 - 子agent信息

  // 背景 - Lain深色风格
  bg: chalk.bgHex('#0D1117'),         // GitHub深色背景风格
  bgAlt: chalk.bgHex('#1A1B26'),      // 更深的背景
  bgBorder: chalk.bgHex('#161B22'),   // 边框背景色
};

// ANSI背景色控制
export const BG = {
  // 设置深色背景（Lain风格）
  set: () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[48;2;13;17;23m');
    }
  },

  // 恢复默认背景
  reset: () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[49m');
    }
  },

  // 清屏
  clear: () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H');
    }
  },

  // 极简横幅
  banner: () => {
    const cyan = '\x1b[38;2;0;206;209m';
    const reset = '\x1b[0m';
    console.log(`${cyan}spica${reset}`);
  },
};

// 格式化函数
export const format = {
  // 主提示符
  prompt: () => LAIN_COLORS.prompt('>'),

  // 成功/错误
  success: (text: string) => LAIN_COLORS.success(text),
  error: (text: string) => LAIN_COLORS.error(text),
  warning: (text: string) => LAIN_COLORS.warning(text),

  // 工具调用
  toolCall: (name: string) => LAIN_COLORS.tool(`→ ${name}`),
  toolResult: (name: string, success: boolean, output: string) => {
    const icon = success ? LAIN_COLORS.success('✓') : LAIN_COLORS.error('✗');
    return `${icon} ${name}: ${output}`;
  },

  // Reasoning
  reasoning: (content: string) => LAIN_COLORS.reasoning(content),

  // Diff
  diffFile: (path: string) => LAIN_COLORS.file(`📄 ${path}`),
  diffAdd: (line: string) => LAIN_COLORS.diffAdd(`+ ${line}`),
  diffRemove: (line: string) => LAIN_COLORS.diffRemove(`- ${line}`),

  // 权限框
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

  // 状态
  status: (bypass: boolean, msgs: number, workspace: string) => {
    const mode = bypass
      ? LAIN_COLORS.warning('BYPASS')
      : LAIN_COLORS.success('STRICT');
    return `
${LAIN_COLORS.primary.bold('Current Status:')}
  Permission mode: ${mode}
  Messages in context: ${msgs}
  Workspace: ${workspace}
`;
  },

  // 次要信息
  muted: (text: string) => LAIN_COLORS.muted(text),
  dim: (text: string) => LAIN_COLORS.dim(text),
};