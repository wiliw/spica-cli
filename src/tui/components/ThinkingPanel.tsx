import React from 'react';
import { Box, Text } from 'ink';
import { useMarquee } from '../hooks/useMarquee';

interface ThinkingPanelProps {
  content: string;
  isRunning?: boolean;
}

export const ThinkingPanel = React.memo(({ content, isRunning }: ThinkingPanelProps) => {
  const displayContent = useMarquee(content, 20);
  const title = isRunning ? 'Thinking' : 'Thoughts';

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="single" borderColor="magenta">
        <Text bold color="magenta">{title}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {content ? (
          <Text color="gray">{displayContent}</Text>
        ) : (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <Text dimColor>No thinking recorded</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';