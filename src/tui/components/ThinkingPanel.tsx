import React from 'react';
import { Box, Text } from 'ink';

interface ThinkingPanelProps {
  content: string;
  isRunning?: boolean;
  height?: number;
}

export const ThinkingPanel = React.memo(({ content, isRunning, height = 20 }: ThinkingPanelProps) => {
  const title = isRunning ? 'Thinking' : 'Thoughts';
  const headerHeight = 2;
  const maxLines = height - headerHeight;

  const allLines = content.split('\n');
  const visibleLines = isRunning 
    ? allLines.slice(-maxLines)
    : allLines.slice(0, maxLines);

  return (
    <Box flexDirection="column" minHeight={height} maxHeight={height}>
      <Box borderStyle="single" borderColor="magenta">
        <Text bold color="magenta">{title}</Text>
      </Box>
      <Box flexDirection="column" minHeight={maxLines} maxHeight={maxLines} paddingX={1}>
        {visibleLines.length > 0 ? (
          visibleLines.map((line, i) => (
            <Box key={i} minHeight={1} maxHeight={1}>
              <Text color="gray" wrap="truncate">{line.slice(0, 100)}</Text>
            </Box>
          ))
        ) : (
          <Text dimColor>No thinking recorded</Text>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';