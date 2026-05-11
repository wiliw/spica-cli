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
  const headerHeight = 1;
  const contentHeight = height - headerHeight;

  const toolLines = tools.slice(0, contentHeight).map(t => {
    const icon = t.status === 'running' ? '...' : t.status === 'success' ? '[OK]' : '[ERR]';
    const color = t.status === 'running' ? 'yellow' : t.status === 'success' ? 'green' : 'red';
    const line = `${icon} ${t.name}${t.output ? ` : ${t.output.slice(0, 40)}` : ''}`;
    return { line, color };
  });

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="green" height={headerHeight}>
        <Text bold color="green">{title} ({tools.length})</Text>
      </Box>
      <Box flexDirection="column" height={contentHeight} paddingX={1}>
        {tools.length > 0 ? (
          toolLines.map((item, i) => (
            <Text key={i} color={item.color}>{item.line}</Text>
          ))
        ) : (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <Text dimColor>No tools used</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

ToolsPanel.displayName = 'ToolsPanel';