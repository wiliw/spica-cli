import React from 'react';
import { render } from 'ink-testing-library';
import { vi } from 'vitest';
import { InputPanel } from '../src/tui/components/InputPanel';

describe('InputPanel', () => {
  test('isolated component renders', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(<InputPanel onSubmit={onSubmit} isRunning={false} />);
    expect(lastFrame()).toContain('Input');
  });

  test('submit calls callback with value', async () => {
    const onSubmit = vi.fn();
    const { stdin, unmount } = render(<InputPanel onSubmit={onSubmit} isRunning={false} />);
    
    stdin.write('test input');
    await new Promise(r => setTimeout(r, 50));
    stdin.write('\r');
    await new Promise(r => setTimeout(r, 50));
    
    expect(onSubmit).toHaveBeenCalledWith('test input');
    unmount();
  });
});