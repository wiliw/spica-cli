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
}

export const ToolsPanel = React.memo(({ tools, height = 10 }: ToolsPanelProps) => {
  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="green" height={1}>
        <Text bold color="green">Toolcalls ({tools.length})</Text>
      </Box>
      <Box flexDirection="column" height={height - 1} paddingX={1}>
        {tools.length > 0 ? (
          tools.slice(0, height - 1).map((tool, i) => {
            const icon = tool.status === 'running' ? '...' : tool.status === 'success' ? '[OK]' : '[ERR]';
            const color = tool.status === 'running' ? 'yellow' : tool.status === 'success' ? 'green' : 'red';
            return (
              <Box key={i} flexDirection="row">
                <Text color={color}>{icon} </Text>
                <Text bold color={color}>{tool.name}</Text>
                {tool.output && (
                  <Text dimColor> : {tool.output.slice(0, 40)}</Text>
                )}
              </Box>
            );
          })
        ) : (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <Text dimColor>No tools used</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

ToolsPanel.displayName = 'ToolsPanel';