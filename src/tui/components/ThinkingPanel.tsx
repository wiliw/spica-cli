import React from 'react';
import { Box, Text } from 'ink';
import { useMarquee } from '../hooks/useMarquee';

interface ThinkingPanelProps {
  content: string;
}

export const ThinkingPanel = React.memo(({ content }: ThinkingPanelProps) => {
  const maxLines = 10;
  const displayContent = useMarquee(content, maxLines);

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="magenta">
        <Text bold color="magenta">Thinking</Text>
      </Box>
      <Box flexDirection="column">
        {content ? (
          <>
            {displayContent.split('\n').map((line, i) => (
              <Text key={i} dimColor>{line}</Text>
            ))}
          </>
        ) : (
          <Text dimColor>No thinking</Text>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';