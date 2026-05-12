import React from 'react';
import { Box, Text } from 'ink';
import { useMarquee } from '../hooks/useMarquee';

interface ToolDisplay {
  name: string;
  status: string;
  output?: string;
}

interface ToolsPanelProps {
  tools: ToolDisplay[];
  height?: number;
  isRunning?: boolean;
}

export const ToolsPanel = React.memo(({ tools, height = 10, isRunning }: ToolsPanelProps) => {
  const title = isRunning ? 'Toolcalling' : 'Toolcalled';
  const headerHeight = 1;
  const maxLines = height - headerHeight;

  const visibleCount = isRunning ? Math.min(tools.length, maxLines) : maxLines;
  const startIndex = isRunning ? Math.max(0, tools.length - visibleCount) : 0;

  const toolTexts = tools.slice(startIndex, startIndex + visibleCount).map(t => {
    const icon = t.status === 'running' ? '...' : t.status === 'success' ? '[OK]' : '[ERR]';
    return `${icon} ${t.name}${t.output ? ` : ${t.output}` : ''}`;
  });

  const displayLines = isRunning ? toolTexts : (
    tools.length > maxLines
      ? useMarquee(toolTexts.join('\n'), maxLines).split('\n')
      : toolTexts
  );

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="green" height={headerHeight}>
        <Text bold color="green" backgroundColor="black">{title} ({tools.length})</Text>
      </Box>
      <Box flexDirection="column" height={maxLines} paddingX={1}>
        {displayLines.length > 0 ? (
          displayLines.slice(0, maxLines).map((line, i) => {
            const tool = tools[startIndex + i];
            const color = tool?.status === 'running' ? 'yellow' : tool?.status === 'success' ? 'green' : 'red';
            return (
              <Box key={i} minHeight={1} maxHeight={1}>
                <Text color={color} bold>{line}</Text>
              </Box>
            );
          })
        ) : (
          <Text dimColor color="cyan">No tools used</Text>
        )}
      </Box>
    </Box>
  );
});

ToolsPanel.displayName = 'ToolsPanel';