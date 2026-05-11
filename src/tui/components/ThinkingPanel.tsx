import React from 'react';
import { Box, Text } from 'ink';

interface ThinkingPanelProps {
  content: string;
  isRunning?: boolean;
  height?: number;
}

export const ThinkingPanel = React.memo(({ content, isRunning, height = 20 }: ThinkingPanelProps) => {
  const title = isRunning ? 'Thinking' : 'Thoughts';
  const headerHeight = 1;
  const contentHeight = height - headerHeight;

  const lines = content.split('\n').filter(l => l);
  const displayLines = isRunning 
    ? lines.slice(-contentHeight)
    : lines.slice(0, contentHeight);

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="magenta" height={headerHeight}>
        <Text bold color="magenta">{title}</Text>
      </Box>
      <Box flexDirection="column" height={contentHeight} paddingX={1}>
        {content ? (
          displayLines.map((line, i) => (
            <Text key={i} color="gray">{line}</Text>
          ))
        ) : (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <Text dimColor>No thinking recorded</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';