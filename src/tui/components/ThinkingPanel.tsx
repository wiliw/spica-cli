import React from 'react';
import { Box, Text } from 'ink';
import { useMarquee } from '../hooks/useMarquee';

interface ThinkingPanelProps {
  content: string;
  isRunning?: boolean;
  height?: number;
}

export const ThinkingPanel = React.memo(({ content, isRunning, height = 20 }: ThinkingPanelProps) => {
  const title = isRunning ? 'Thinking' : 'Thoughts';
  const contentHeight = height - 1;
  
  const lines = content.split('\n').filter(l => l);
  const needsScroll = lines.length > contentHeight && !isRunning;
  const displayLines = isRunning 
    ? lines.slice(-contentHeight)
    : needsScroll 
      ? useMarquee(content, contentHeight).split('\n')
      : lines;

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="magenta" height={1}>
        <Text bold color="magenta">{title}</Text>
      </Box>
      <Box flexDirection="column" height={contentHeight} paddingX={1}>
        {content ? (
          displayLines.slice(0, contentHeight).map((line, i) => (
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