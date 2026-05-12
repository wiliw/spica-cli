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
  const headerHeight = 1;
  const maxLines = height - headerHeight;

  const allLines = content.split('\n');
  const visibleLines = isRunning 
    ? allLines.slice(Math.max(0, allLines.length - maxLines))
    : allLines.slice(0, maxLines);

  const needsMarquee = !isRunning && allLines.length > maxLines;
  const displayText = isRunning 
    ? visibleLines.join('\n')
    : needsMarquee 
      ? useMarquee(content, maxLines)
      : visibleLines.join('\n');

  const displayLines = displayText.split('\n').slice(0, maxLines);

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="magenta" height={headerHeight}>
        <Text bold color="magenta" backgroundColor="black">{title}</Text>
      </Box>
      <Box flexDirection="column" height={maxLines} paddingX={1}>
        {displayLines.length > 0 ? (
          displayLines.map((line, i) => (
            <Box key={i} minHeight={1} maxHeight={1}>
              <Text color="yellow">{line}</Text>
            </Box>
          ))
        ) : (
          <Text dimColor color="magenta">No thinking recorded</Text>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';