import { useInput } from 'ink';
import { useState, useEffect } from 'react';

interface InputOptions {
  onUp?: () => void;
  onDown?: () => void;
  onEnter?: () => void;
  onTab?: () => void;
  onEscape?: () => void;
  onQuit?: () => void;
  onChar?: (char: string) => void;
  enabled?: boolean;
}

export function useKeyboardInput(options: InputOptions) {
  const {
    onUp,
    onDown,
    onEnter,
    onTab,
    onEscape,
    onQuit,
    onChar,
    enabled = true,
  } = options;

  const [rawModeSupported, setRawModeSupported] = useState(true);

  useEffect(() => {
    if (process.stdin.isTTY) {
      try {
        const originalRawMode = process.stdin.isRaw;
        if (originalRawMode === false) {
          process.stdin.setRawMode(true);
          process.stdin.setRawMode(false);
        }
        setRawModeSupported(true);
      } catch (error) {
        setRawModeSupported(false);
      }
    } else {
      setRawModeSupported(false);
    }
  }, []);

  useInput((input, key) => {
    if (!enabled) return;

    if ((key.upArrow || input === 'k') && onUp) onUp();
    if ((key.downArrow || input === 'j') && onDown) onDown();
    if (key.return && onEnter) onEnter();
    if (key.tab && onTab) onTab();
    if ((key.escape || input === 'q') && onQuit) onQuit();
    if (input && onChar && !key.upArrow && !key.downArrow && !key.return && !key.tab && !key.escape && input !== 'j' && input !== 'k') {
      onChar(input);
    }
  }, { isActive: enabled && rawModeSupported });
}