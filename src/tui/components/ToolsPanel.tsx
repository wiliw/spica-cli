import React from 'react';
import { Box, Text } from 'ink';

interface ToolDisplay {
  name: string;
  status: string;
  output?: string;
}

interface ToolsPanelProps {
  tools: ToolDisplay[];
}

export const ToolsPanel = React.memo(({ tools }: ToolsPanelProps) => {
  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="green">
        <Text bold color="green">Tools ({tools.length})</Text>
      </Box>
      <Box flexDirection="column">
        {tools.slice(0, 3).map((tool, i) => {
          const icon = tool.status === 'running' ? '←' : tool.status === 'success' ? '✓' : '✗';
          const color = tool.status === 'running' ? 'yellow' : tool.status === 'success' ? 'green' : 'red';
          return (
            <Text key={i} color={color}>
              {icon} {tool.name}
            </Text>
          );
        })}
        {tools.length === 0 && <Text dimColor>No tools</Text>}
      </Box>
    </Box>
  );
});

ToolsPanel.displayName = 'ToolsPanel';