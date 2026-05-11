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
}

export const ToolsPanel = React.memo(({ tools, height = 10 }: ToolsPanelProps) => {
  const contentHeight = height - 1;
  const toolsText = tools.map(t => {
    const icon = t.status === 'running' ? '...' : t.status === 'success' ? '[OK]' : '[ERR]';
    return `${icon} ${t.name}${t.output ? ` : ${t.output.slice(0, 40)}` : ''}`;
  }).join('\n');
  
  const displayText = useMarquee(toolsText, contentHeight);

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="green" height={1}>
        <Text bold color="green">Toolcalls ({tools.length})</Text>
      </Box>
      <Box flexDirection="column" height={contentHeight} paddingX={1}>
        {tools.length > 0 ? (
          displayText.split('\n').map((line, i) => {
            const tool = tools[i];
            const color = tool?.status === 'running' ? 'yellow' : tool?.status === 'success' ? 'green' : 'red';
            return <Text key={i} color={color}>{line}</Text>;
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