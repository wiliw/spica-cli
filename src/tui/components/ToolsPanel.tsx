import React from 'react';
import { Box, Text } from 'ink';
import type { ToolCall } from '../types';

interface ToolsPanelProps {
  tools: ToolCall[];
}

export const ToolsPanel = React.memo(({ tools }: ToolsPanelProps) => {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="single" borderColor="green">
        <Text bold color="green">Tools ({tools.length})</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {tools.slice(0, 5).map((tool, i) => {
          const icon = tool.status === 'running' ? '←' : tool.status === 'success' ? '✓' : '✗';
          const color = tool.status === 'running' ? 'yellow' : tool.status === 'success' ? 'green' : 'red';
          return (
            <Text key={i} color={color}>
              {icon} {tool.name}
            </Text>
          );
        })}
        {tools.length > 5 && <Text dimColor>[...{tools.length - 5} more]</Text>}
        {tools.length === 0 && <Text dimColor>No tools</Text>}
      </Box>
    </Box>
  );
});

ToolsPanel.displayName = 'ToolsPanel';