import React from 'react';
import { render } from 'ink-testing-library';
import { ThinkingPanel } from '../src/tui/components/ThinkingPanel';

describe('ThinkingPanel', () => {
  test('displays short content without marquee', async () => {
    const shortContent = 'Line 1\nLine 2\nLine 3';
    const { stdout, unmount } = render(<ThinkingPanel content={shortContent} />);
    
    await new Promise(r => setTimeout(r, 100));
    
    const output = stdout.lastFrame();
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 2');
    expect(output).toContain('Line 3');
    
    unmount();
  });

  test('displays first 10 lines initially for long content', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
    const longContent = lines.join('\n');
    
    const { stdout, unmount } = render(<ThinkingPanel content={longContent} />);
    
    await new Promise(r => setTimeout(r, 100));
    
    const output = stdout.lastFrame();
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 10');
    expect(output).not.toContain('Line 11');
    
    unmount();
  });

  test('scrolls through long content with marquee', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
    const longContent = lines.join('\n');
    
    const { stdout, unmount } = render(<ThinkingPanel content={longContent} />);
    
    await new Promise(r => setTimeout(r, 100));
    const initialOutput = stdout.lastFrame();
    expect(initialOutput).toContain('Line 1');
    expect(initialOutput).not.toContain('Line 11');
    
    await new Promise(r => setTimeout(r, 600));
    const afterFirstScroll = stdout.lastFrame();
    expect(afterFirstScroll).toContain('Line 11');
    expect(afterFirstScroll).toContain('Line 2');
    
    unmount();
  });

  test('wraps around when reaching end', async () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`);
    const content = lines.join('\n');
    
    const { stdout, unmount } = render(<ThinkingPanel content={content} />);
    
    await new Promise(r => setTimeout(r, 100));
    expect(stdout.lastFrame()).toContain('Line 1');
    
    await new Promise(r => setTimeout(r, 500));
    expect(stdout.lastFrame()).toContain('Line 2');
    
    await new Promise(r => setTimeout(r, 500));
    expect(stdout.lastFrame()).toContain('Line 3');
    
    await new Promise(r => setTimeout(r, 500));
    expect(stdout.lastFrame()).toContain('Line 1');
    
    unmount();
  });

  test('shows No thinking for empty content', async () => {
    const { stdout, unmount } = render(<ThinkingPanel content="" />);
    
    await new Promise(r => setTimeout(r, 100));
    
    const output = stdout.lastFrame();
    expect(output).toContain('No thinking');
    
    unmount();
  });
});