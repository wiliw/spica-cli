import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../src/tui/App';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const cleanup = () => {
  const historyFile = path.join(process.env.HOME || '/tmp', '.spica', 'history.json');
  if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
  
  const testDir = '/tmp/test-spica-tui';
  if (fs.existsSync(testDir)) {
    execSync(`rm -rf ${testDir}`);
  }
  execSync(`mkdir -p ${testDir}`);
};

describe('Spica TUI Tests', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  test('输入流畅性测试', async () => {
    const { stdin, stdout, unmount } = render(<App />);
    
    // 模拟快速输入
    for (let i = 0; i < 10; i++) {
      stdin.write('h');
      await new Promise(r => setTimeout(r, 10));
    }
    
    stdin.write('i');
    await new Promise(r => setTimeout(r, 100));
    
    const output = stdout.lastFrame();
    console.log('快速输入输出:', output);
    
    unmount();
  });

  test('thinking显示测试', async () => {
    const { stdin, stdout, unmount } = render(<App />);
    
    stdin.write('创建一个简单的hello程序');
    stdin.write('\n');
    
    await new Promise(r => setTimeout(r, 3000));
    
    const frames = stdout.frames;
    console.log('所有frames:', frames);
    
    // 检查thinking是否按段落显示
    const hasThinkTag = frames.some(f => f.includes('[思]') || f.includes('[Think]'));
    const thinkNotFragmented = !frames.some(f => 
      f.includes('[思]') && f.includes('[思]') && f.indexOf('[思]') !== f.lastIndexOf('[思]')
    );
    
    console.log('thinking标签存在:', hasThinkTag);
    console.log('thinking未碎片化:', thinkNotFragmented);
    
    unmount();
  });

  test('记忆加载测试', async () => {
    // 第一次对话
    const { stdin: stdin1, stdout: stdout1, unmount: unmount1 } = render(<App />);
    
    stdin1.write('创建一个文件叫test.txt');
    stdin1.write('\n');
    
    await new Promise(r => setTimeout(r, 2000));
    unmount1();
  }, 10000);

  test('输出顺序测试', async () => {
    const { stdin, stdout, unmount } = render(<App />);
    
    stdin.write('检查当前目录');
    stdin.write('\n');
    
    await new Promise(r => setTimeout(r, 3000));
    
    const frames = stdout.frames;
    console.log('frames数量:', frames.length);
    
    // 分析时间顺序
    const events = [];
    let lastEventTime = 0;
    
    frames.forEach((frame, i) => {
      const lines = frame.split('\n');
      lines.forEach(line => {
        if (line.includes('[思]')) {
          events.push({ type: 'thinking', frame: i });
        } else if (line.includes('←') || line.includes('✓')) {
          events.push({ type: 'tool', frame: i });
        } else if (line.includes('You:') || line.includes('你好')) {
          events.push({ type: 'message', frame: i });
        }
      });
    });
    
    console.log('事件顺序:', events);
    
    // 检查thinking是否在message之前
    const thinkingFrames = events.filter(e => e.type === 'thinking').map(e => e.frame);
    const messageFrames = events.filter(e => e.type === 'message').map(e => e.frame);
    
    if (thinkingFrames.length > 0 && messageFrames.length > 0) {
      const thinkingBeforeMessage = Math.max(...thinkingFrames) < Math.min(...messageFrames);
      console.log('thinking在message之前:', thinkingBeforeMessage);
    }
    
    unmount();
  });

  test('split layout renders', async () => {
    const { stdout, unmount } = render(<App />);
    await new Promise(r => setTimeout(r, 500));
    
    const output = stdout.lastFrame();
    expect(output).toContain('Rounds');
    expect(output).toContain('Thoughts');
    expect(output).toContain('Toolcalled');
    
    unmount();
  });

  test('keyboard scroll works', async () => {
    const { stdin, stdout, unmount } = render(<App />);
    
    // Press down arrow
    stdin.write('\x1b[B');
    await new Promise(r => setTimeout(r, 100));
    
    const output = stdout.lastFrame();
    // Should show scroll happened
    
    unmount();
  });
});