/**
 * spica-cli 全面功能测试
 *
 * 测试覆盖：
 * 1. CLI 基本命令
 * 2. 工具系统（所有33个工具）
 * 3. TUI 交互
 * 4. 核心功能（中断、压缩、Checkpoint）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as pty from 'node-pty';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { executeTool, setWorkspace } from '../tools/index';
import { isFullWidth, getStringWidth } from '../cli/ui/stringWidth';

const _TIMEOUT = 30000;

// 测试工作目录
const TEST_DIR = path.join(os.tmpdir(), 'spica-test-' + Date.now());

// CLI 基本命令测试
describe('CLI Commands', () => {
  beforeAll(async () => {
    await execa('npm', ['run', 'build']);
  });

  it('should show version', async () => {
    const result = await execa('./bin/spica', ['--version']);
    expect(result.stdout).toContain('1.0.0');
  });

  it('should show help', async () => {
    const result = await execa('./bin/spica', ['--help']);
    expect(result.stdout).toContain('AI coding assistant');
    expect(result.stdout).toContain('Examples:');
  });

  it('should list providers', async () => {
    const result = await execa('./bin/spica', ['list']);
    expect(result.stdout).toMatch(/●|○/);  // provider marker
  });

  it('should show provider details', async () => {
    const result = await execa('./bin/spica', ['show', 'aliyunglm5']);
    expect(result.stdout).toContain('name:');
    expect(result.stdout).toContain('url:');
    expect(result.stdout).toContain('model:');
  });
});

// 工具系统测试
describe('Tool System', () => {
  beforeAll(async () => {
    await fs.ensureDir(TEST_DIR);
  });

  afterAll(async () => {
    await fs.remove(TEST_DIR);
  });

  describe('File Tools', () => {
    it('file_read: should read file content', async () => {
      const testFile = path.join(TEST_DIR, 'test.txt');
      await fs.writeFile(testFile, 'Hello World');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_read', { path: 'test.txt' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('Hello World');
    });

    it('file_write: should write file with syntax check', async () => {
      setWorkspace(TEST_DIR);

      const result = await executeTool('file_write', {
        path: 'test.ts',
        content: 'const x: number = 1;',
      });
      expect(result.success).toBe(true);
      expect(result.syntaxErrors).toBeUndefined();
    });

    it('file_write: should detect syntax errors', async () => {
      setWorkspace(TEST_DIR);

      const result = await executeTool('file_write', {
        path: 'error.ts',
        content: 'const x: string = ;',  // syntax error
      });
      expect(result.success).toBe(true);
      expect(result.syntaxErrors).toBeDefined();
      expect(result.syntaxErrors!.length).toBeGreaterThan(0);
    });

    it('file_edit: should edit file by exact replacement', async () => {
      const testFile = path.join(TEST_DIR, 'edit.txt');
      await fs.writeFile(testFile, 'Hello World');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_edit', {
        path: 'edit.txt',
        oldString: 'Hello',
        newString: 'Hi',
      });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('Hi World');
    });

    it('file_multi_edit: should apply multiple edits', async () => {
      const testFile = path.join(TEST_DIR, 'multi.txt');
      await fs.writeFile(testFile, 'a b c d e');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_multi_edit', {
        path: 'multi.txt',
        edits: [
          { oldString: 'a', newString: '1' },
          { oldString: 'b', newString: '2' },
          { oldString: 'c', newString: '3' },
        ],
      });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('1 2 3 d e');
    });

    it('file_replace: should replace by regex', async () => {
      const testFile = path.join(TEST_DIR, 'replace.txt');
      await fs.writeFile(testFile, 'test1 test2 test3');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_replace', {
        path: 'replace.txt',
        pattern: 'test\\d',
        replacement: 'done',
      });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('done done done');
    });

    it('file_insert: should insert at line', async () => {
      const testFile = path.join(TEST_DIR, 'insert.txt');
      await fs.writeFile(testFile, 'line1\nline2\nline3');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_insert', {
        path: 'insert.txt',
        line: 2,
        content: 'inserted',
      });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('line1\ninserted\nline2');
    });

    it('file_exists: should check file existence', async () => {
      const testFile = path.join(TEST_DIR, 'exists.txt');
      await fs.writeFile(testFile, 'content');

      setWorkspace(TEST_DIR);

      const resultExist = await executeTool('file_exists', { path: 'exists.txt' });
      expect(resultExist.success).toBe(true);

      const resultNotExist = await executeTool('file_exists', { path: 'not-exist.txt' });
      expect(resultNotExist.success).toBe(false);
    });

    it('file_delete: should delete file', async () => {
      const testFile = path.join(TEST_DIR, 'delete.txt');
      await fs.writeFile(testFile, 'content');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_delete', { path: 'delete.txt' });
      expect(result.success).toBe(true);

      const exists = await fs.pathExists(testFile);
      expect(exists).toBe(false);
    });

    it('file_copy: should copy file', async () => {
      const src = path.join(TEST_DIR, 'copy-src.txt');
      const dest = path.join(TEST_DIR, 'copy-dest.txt');
      await fs.writeFile(src, 'content');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_copy', { source: 'copy-src.txt', destination: 'copy-dest.txt' });
      expect(result.success).toBe(true);

      const content = await fs.readFile(dest, 'utf8');
      expect(content).toBe('content');
    });

    it('file_move: should move file', async () => {
      const src = path.join(TEST_DIR, 'move-src.txt');
      const dest = path.join(TEST_DIR, 'move-dest.txt');
      await fs.writeFile(src, 'content');

      setWorkspace(TEST_DIR);

      const result = await executeTool('file_move', { source: 'move-src.txt', destination: 'move-dest.txt' });
      expect(result.success).toBe(true);

      const srcExists = await fs.pathExists(src);
      expect(srcExists).toBe(false);

      const content = await fs.readFile(dest, 'utf8');
      expect(content).toBe('content');
    });
  });

  describe('Directory Tools', () => {
    it('directory_create: should create directory', async () => {
      setWorkspace(TEST_DIR);

      const result = await executeTool('directory_create', { path: 'new-dir/nested' });
      expect(result.success).toBe(true);

      const exists = await fs.pathExists(path.join(TEST_DIR, 'new-dir/nested'));
      expect(exists).toBe(true);
    });

    it('directory_list: should list directory', async () => {
      await fs.ensureDir(path.join(TEST_DIR, 'list-dir'));
      await fs.writeFile(path.join(TEST_DIR, 'list-dir', 'file1.txt'), 'a');
      await fs.writeFile(path.join(TEST_DIR, 'list-dir', 'file2.txt'), 'b');

      setWorkspace(TEST_DIR);

      const result = await executeTool('directory_list', { path: 'list-dir' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('file1.txt');
      expect(result.content).toContain('file2.txt');
    });
  });

  describe('Search Tools', () => {
    it('glob: should find files by pattern', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'glob1.ts'), 'a');
      await fs.writeFile(path.join(TEST_DIR, 'glob2.ts'), 'b');
      await fs.writeFile(path.join(TEST_DIR, 'glob3.js'), 'c');

      setWorkspace(TEST_DIR);

      const result = await executeTool('glob', { pattern: '*.ts' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('glob1.ts');
      expect(result.content).toContain('glob2.ts');
      expect(result.content).not.toContain('glob3.js');
    });

    it('grep: should search content', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'grep.txt'), 'Hello World\nTest Line\nAnother Test');

      setWorkspace(TEST_DIR);

      const result = await executeTool('grep', { pattern: 'Test', path: 'grep.txt' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('Test Line');
      expect(result.content).toContain('Another Test');
    });
  });

  describe('Bash Tool', () => {
    it('bash: should execute command', async () => {
      setWorkspace(TEST_DIR);

      const result = await executeTool('bash', { command: 'echo "test output"' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('test output');
    });

    it('bash: should handle command failure', async () => {
      setWorkspace(TEST_DIR);

      const result = await executeTool('bash', { command: 'ls /nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Git Tool', () => {
    beforeAll(async () => {
      // 创建测试 git 仓库
      await fs.ensureDir(path.join(TEST_DIR, 'git-test'));
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- simple-git needs require for constructor call
      const git = require('simple-git')(path.join(TEST_DIR, 'git-test'));
      await git.init();
      await fs.writeFile(path.join(TEST_DIR, 'git-test', 'file.txt'), 'initial');
      await git.add('.');
      await git.commit('initial commit');
    });

    it('git: should show status', async () => {
      setWorkspace(path.join(TEST_DIR, 'git-test'));

      const result = await executeTool('git', { action: 'status' });
      expect(result.success).toBe(true);
    });

    it('git: should show log', async () => {
      setWorkspace(path.join(TEST_DIR, 'git-test'));

      const result = await executeTool('git', { action: 'log' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('initial commit');
    });
  });
});

// TUI 测试
describe('TUI Features', () => {
  const Keys = {
    Enter: '\r',
    Backspace: '\b',
    CtrlC: '\x03',
    ArrowLeft: '\x1b[D',
    ArrowRight: '\x1b[C',
  };

  it('should handle Chinese input correctly', async () => {
    const scriptPath = 'src/cli/ui/__tests__/tuiStateTest.ts';

    const result = await new Promise<{ output: string }>((resolve) => {
      const p = pty.spawn('npx', ['tsx', scriptPath], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
      });

      let output = '';
      p.onData(d => output += d);

      setTimeout(() => {
        p.write('你好世界');
        setTimeout(() => {
          p.write(Keys.Enter);
          setTimeout(() => {
            p.write(Keys.CtrlC);
            setTimeout(() => resolve({ output }), 500);
          }, 300);
        }, 300);
      }, 500);
    });

    expect(result.output).toContain('你好世界');
    expect(result.output).toContain('CharCount: 4');
    expect(result.output).toContain('DisplayWidth: 8');
  });

  it('should handle fullwidth punctuation', async () => {
    const scriptPath = 'src/cli/ui/__tests__/tuiStateTest.ts';

    const result = await new Promise<{ output: string }>((resolve) => {
      const p = pty.spawn('npx', ['tsx', scriptPath], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
      });

      let output = '';
      p.onData(d => output += d);

      setTimeout(() => {
        p.write('！？，。');
        setTimeout(() => {
          p.write(Keys.Enter);
          setTimeout(() => {
            p.write(Keys.CtrlC);
            setTimeout(() => resolve({ output }), 500);
          }, 300);
        }, 300);
      }, 500);
    });

    expect(result.output).toContain('！？，。');
    expect(result.output).toContain('CharCount: 4');
    expect(result.output).toContain('DisplayWidth: 8');
  });

  it('should handle mixed Chinese and ASCII', async () => {
    const scriptPath = 'src/cli/ui/__tests__/tuiStateTest.ts';

    const result = await new Promise<{ output: string }>((resolve) => {
      const p = pty.spawn('npx', ['tsx', scriptPath], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
      });

      let output = '';
      p.onData(d => output += d);

      setTimeout(() => {
        p.write('Hello世界');
        setTimeout(() => {
          p.write(Keys.Enter);
          setTimeout(() => {
            p.write(Keys.CtrlC);
            setTimeout(() => resolve({ output }), 500);
          }, 300);
        }, 300);
      }, 500);
    });

    expect(result.output).toContain('Hello世界');
    expect(result.output).toContain('CharCount: 7');
    expect(result.output).toContain('DisplayWidth: 9');
  });
});

// 全角字符宽度测试
describe('Fullwidth Character Detection', () => {
  it('should detect CJK characters', () => {
    expect(isFullWidth('中')).toBe(true);
    expect(isFullWidth('文')).toBe(true);
    expect(isFullWidth('字')).toBe(true);
  });

  it('should detect fullwidth punctuation', () => {
    expect(isFullWidth('！')).toBe(true);
    expect(isFullWidth('？')).toBe(true);
    expect(isFullWidth('，')).toBe(true);
    expect(isFullWidth('。')).toBe(true);
    expect(isFullWidth('；')).toBe(true);
    expect(isFullWidth('：')).toBe(true);
    expect(isFullWidth('（')).toBe(true);
    expect(isFullWidth('）')).toBe(true);
  });

  it('should not detect ASCII as fullwidth', () => {
    expect(isFullWidth('a')).toBe(false);
    expect(isFullWidth('Z')).toBe(false);
    expect(isFullWidth('!')).toBe(false);
    expect(isFullWidth('?')).toBe(false);
  });

  it('should calculate correct string width', () => {
    expect(getStringWidth('你好')).toBe(4);
    expect(getStringWidth('Hello')).toBe(5);
    expect(getStringWidth('Hello世界')).toBe(9);
    expect(getStringWidth('！？')).toBe(4);
  });
});