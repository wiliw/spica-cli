import React from 'react';
import { Box, Text } from 'ink';

interface ThinkingPanelProps {
  content: string;
}

export const ThinkingPanel = React.memo(({ content }: ThinkingPanelProps) => {
  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="magenta">
        <Text bold color="magenta">Thinking</Text>
      </Box>
      <Box flexDirection="column">
        {content ? (
          <Text dimColor>{content.slice(0, 200)}{content.length > 200 ? '...' : ''}</Text>
        ) : (
          <Text dimColor>No thinking</Text>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';