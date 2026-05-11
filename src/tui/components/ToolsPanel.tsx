import React from 'react';
import { Box, Text } from 'ink';

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

  const visibleTools = tools.slice(0, maxLines);

  return (
    <Box flexDirection="column" minHeight={height} maxHeight={height}>
      <Box borderStyle="single" borderColor="green">
        <Text bold color="green">{title} ({tools.length})</Text>
      </Box>
      <Box flexDirection="column" minHeight={maxLines} maxHeight={maxLines} paddingX={1}>
        {visibleTools.length > 0 ? (
          visibleTools.map((tool, i) => {
            const icon = tool.status === 'running' ? '...' : tool.status === 'success' ? '[OK]' : '[ERR]';
            const color = tool.status === 'running' ? 'yellow' : tool.status === 'success' ? 'green' : 'red';
            const text = `${icon} ${tool.name}${tool.output ? ` : ${tool.output.slice(0, 30)}` : ''}`;
            return (
              <Box key={i} minHeight={1} maxHeight={1}>
                <Text color={color} wrap="truncate">{text}</Text>
              </Box>
            );
          })
        ) : (
          <Text dimColor>No tools used</Text>
        )}
      </Box>
    </Box>
  );
});

ToolsPanel.displayName = 'ToolsPanel';