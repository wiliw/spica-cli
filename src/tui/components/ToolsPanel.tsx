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
  const headerHeight = 2;
  const maxLines = height - headerHeight;

  const toolTexts = tools.map(t => {
    const icon = t.status === 'running' ? '...' : t.status === 'success' ? '[OK]' : '[ERR]';
    return `${icon} ${t.name}${t.output ? ` : ${t.output}` : ''}`;
  });

  const needsMarquee = !isRunning && toolTexts.length > maxLines;
  const toolContent = toolTexts.join('\n');
  
  const displayText = isRunning
    ? toolTexts.slice(-maxLines).join('\n')
    : needsMarquee
      ? useMarquee(toolContent, maxLines)
      : toolTexts.slice(0, maxLines).join('\n');

  const displayLines = displayText.split('\n');

  return (
    <Box flexDirection="column" minHeight={height} maxHeight={height}>
      <Box borderStyle="single" borderColor="green" height={1}>
        <Text bold color="green" backgroundColor="black">{title} ({tools.length})</Text>
      </Box>
      <Box flexDirection="column" minHeight={maxLines} maxHeight={maxLines} paddingX={1}>
        {displayLines.length > 0 ? (
          displayLines.slice(0, maxLines).map((line, i) => {
            const tool = tools[i];
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