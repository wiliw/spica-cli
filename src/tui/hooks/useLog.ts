import { useState, useEffect, useRef } from 'react';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export function useLog(logFile?: string) {
  const [lines, setLines] = useState<string[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const maxLines = 100;

  useEffect(() => {
    if (!logFile) return;

    setIsWatching(true);

    const rl = createInterface({
      input: createReadStream(logFile),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      setLines(prev => {
        const newLines = [...prev, line];
        return newLines.slice(-maxLines);
      });
    });

    rl.on('close', () => {
      setIsWatching(false);
    });

    return () => {
      rl.close();
    };
  }, [logFile]);

  const addLine = (line: string) => {
    setLines(prev => {
      const newLines = [...prev, line];
      return newLines.slice(-maxLines);
    });
  };

  const clear = () => {
    setLines([]);
  };

  return {
    lines,
    isWatching,
    addLine,
    clear,
  };
}

export function useStdoutLog() {
  const [lines, setLines] = useState<string[]>([]);
  const maxLines = 100;

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      const line = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      setLines(prev => {
        const newLines = [...prev, line];
        return newLines.slice(-maxLines);
      });
      originalLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const line = '[ERROR] ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      setLines(prev => {
        const newLines = [...prev, line];
        return newLines.slice(-maxLines);
      });
      originalError.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  const clear = () => {
    setLines([]);
  };

  return {
    lines,
    clear,
  };
}