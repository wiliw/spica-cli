# TUI 测试方法文档

## 概述

本文档总结了使用 `node-pty` 进行 TUI（终端用户界面）自动化测试的方法。

## 核心原理

### 为什么要用 PTY 测试

传统的单元测试无法测试真实的终端行为：
- ANSI 序列处理
- 光标位置计算
- 用户交互流程

PTY（伪终端）提供真实的终端环境，可以：
1. 发送真实的键盘输入（包括特殊键如箭头键）
2. 捕获完整的 ANSI 输出序列
3. 测试光标定位、屏幕刷新等真实行为

## 测试框架结构

### 1. PTY 测试运行器

```typescript
import * as pty from 'node-pty';

async function runPTYTest(
  scriptPath: string,
  inputs: string[],
  options = {}
): Promise<{ output: string; exitCode: number }> {
  const ptyProcess = pty.spawn('npx', ['tsx', scriptPath], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env,
  });

  // 捕获输出
  let output = '';
  ptyProcess.onData(d => output += d);

  // 分块发送输入
  for (const input of inputs) {
    ptyProcess.write(input);
    await delay(150);  // 等待处理
  }

  // 发送退出信号
  ptyProcess.write('\x03');  // Ctrl+C

  return new Promise(resolve => {
    ptyProcess.onExit(({ exitCode }) => resolve({ output, exitCode }));
  });
}
```

### 2. 键盘输入序列

```typescript
const Keys = {
  Enter: '\r',
  Backspace: '\b',     // 注意：使用 BS (0x08)，不要用 DEL (0x7f)
  Tab: '\t',
  Escape: '\x1b',
  CtrlC: '\x03',
  ArrowUp: '\x1b[A',
  ArrowDown: '\x1b[B',
  ArrowRight: '\x1b[C',
  ArrowLeft: '\x1b[D',
  // 粘贴序列
  paste: (content: string) => `\x1b[200~${content}\x1b[201~`,
};
```

### 3. 测试脚本模式

测试脚本需要：
- 不依赖 TUI 初始化（如 `screen.start()`），避免滚动区域干扰输出
- 输出简单的文本结果，便于 PTY 捕获
- 正确处理分块到达的输入

```typescript
// 简化的测试脚本结构
const screen = getScreenManager();
screen.state.inputBuffer = [''];
screen.state.cursorCol = 0;

process.stdin.on('data', (data: Buffer) => {
  const str = data.toString('utf8');
  // 解析输入，处理 ANSI 序列
  // 输出测试结果到 stdout
});
```

## 关键发现

### PTY 输入处理特性

1. **分块到达**：输入可能分多个数据块到达，需要累积处理
2. **ANSI 序列**：`\x1b[D`（左箭头）等序列需要正确解析
3. **Backspace 转换**：PTY 会把 `\x7f` (DEL) 转换为 `\n`，必须使用 `\b` (BS)
4. **粘贴序列**：`\x1b[200~` 和 `\x1b[201~` 需要特殊处理

### 全角字符处理

- CJK 字符（中文等）：显示宽度 2
- 全角标点（！？，。）：显示宽度 2
- 需要 `isFullWidth()` 函数正确检测

## 测试用例示例

```typescript
describe('TUI Tests', () => {
  it('should handle Chinese input', async () => {
    const result = await runPTYTest(scriptPath, ['你好', Keys.Enter]);
    expect(result.output).toContain('你好');
    expect(result.output).toContain('CharCount: 2');
    expect(result.output).toContain('DisplayWidth: 4');
  });

  it('should handle arrow key movement', async () => {
    const result = await runPTYTest(scriptPath, [
      'test',
      Keys.ArrowLeft,
      Keys.Backspace,
      Keys.Enter,
    ]);
    expect(result.output).toContain('tet');  // 删除了 's'
  });
});
```

## 文件位置

- PTY 测试框架：`src/cli/ui/__tests__/tuiPty.test.ts`
- 测试脚本：`src/cli/ui/__tests__/tuiStateTest.ts`
- 全角字符处理：`src/cli/ui/stringWidth.ts`
- ScreenManager：`src/cli/ui/screenManager.ts`

## 运行测试

```bash
npm run test:run -- src/cli/ui/__tests__/tuiPty.test.ts
```

## 最佳实践

1. **简化输出**：测试脚本输出纯文本，避免复杂的 ANSI 序列
2. **累积输入**：使用缓冲区处理分块到达的数据
3. **正确处理 ANSI**：识别并正确处理箭头键、Backspace 等控制序列
4. **等待时间**：给 PTY 足够的处理时间（150ms 以上）
5. **清理退出**：使用 Ctrl+C 退出，确保输出完整捕获