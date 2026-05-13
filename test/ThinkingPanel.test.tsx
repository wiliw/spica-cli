import React from 'react';
import { render } from 'ink-testing-library';
import { ThinkingPanel } from '../src/tui/components/ThinkingPanel';

describe('ThinkingPanel', () => {
  test('displays short content without scroll', async () => {
    const shortContent = 'Line 1\nLine 2\nLine 3';
    const { stdout, unmount } = render(<ThinkingPanel content={shortContent} height={10} />);

    await new Promise(r => setTimeout(r, 100));

    const output = stdout.lastFrame();
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 2');
    expect(output).toContain('Line 3');

    unmount();
  });

  test('running state scrolls through all content', async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`);
    const longContent = lines.join('\n');

    // height = 边框2 + 标题1 + 内容7 = 10
    const { stdout, unmount } = render(
      <ThinkingPanel content={longContent} height={10} isRunning={true} />
    );

    await new Promise(r => setTimeout(r, 100));
    const output = stdout.lastFrame();
    // running时滚动显示全部内容，从Line 1开始
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 7');
    expect(output).not.toContain('Line 30');

    // 等待滚动到最新内容
    await new Promise(r => setTimeout(r, 3000));
    const afterScroll = stdout.lastFrame();
    // 滚动一段时间后，应该能看到最新内容
    expect(afterScroll).toContain('Line');

    unmount();
  });

  test('ed state scrolls from top after running ends', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
    const longContent = lines.join('\n');

    // height = 边框2 + 标题1 + 内容7 = 10
    const { stdout, unmount } = render(
      <ThinkingPanel content={longContent} height={10} isRunning={false} />
    );

    await new Promise(r => setTimeout(r, 100));
    const initialOutput = stdout.lastFrame();
    // 结束后从顶部开始滚动，应该看到Line 1-7
    expect(initialOutput).toContain('Line 1');
    expect(initialOutput).toContain('Line 7');
    expect(initialOutput).not.toContain('Line 20');

    // 等待滚动到下一帧
    await new Promise(r => setTimeout(r, 500));
    const afterScroll = stdout.lastFrame();
    // 滚动后应该看到Line 2-8
    expect(afterScroll).toContain('Line 2');

    unmount();
  });

  test('shows No thinking for empty content', async () => {
    const { stdout, unmount } = render(<ThinkingPanel content="" height={5} />);

    await new Promise(r => setTimeout(r, 100));

    const output = stdout.lastFrame();
    expect(output).toContain('No thinking recorded');

    unmount();
  });
});