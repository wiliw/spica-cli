import React from 'react';
import { Box, Text } from 'ink';

interface ThinkingPanelProps {
  content: string;
}

export const ThinkingPanel = React.memo(({ content }: ThinkingPanelProps) => {
  const maxLines = 10;
  const lines = content.split('\n');
  const displayLines = lines.slice(0, maxLines);
  const hasMore = lines.length > maxLines;

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="magenta">
        <Text bold color="magenta">Thinking</Text>
      </Box>
      <Box flexDirection="column">
        {content ? (
          <>
            {displayLines.map((line, i) => (
              <Text key={i} dimColor>{line}</Text>
            ))}
            {hasMore && <Text dimColor>... {lines.length - maxLines} more lines</Text>}
          </>
        ) : (
          <Text dimColor>No thinking</Text>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';