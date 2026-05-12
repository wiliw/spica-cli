import React from 'react';
import { Box, Text } from 'ink';
import { useMarquee } from '../hooks/useMarquee';

interface ToolDisplay {
  name: string;
  status: 'running' | 'success' | 'error';
  output?: string;
}

interface ToolsPanelProps {
  tools: ToolDisplay[];
  height?: number;
  isRunning?: boolean;
}

export const ToolsPanel = React.memo(({ tools, height = 10, isRunning }: ToolsPanelProps) => {
  const title = isRunning ? 'Toolcalling' : 'Toolcalled';

  // 外部容器固定总高度，内部border = 总高度 - 2
  const totalHeight = height;
  const innerHeight = totalHeight - 2;
  const titleHeight = 1;
  const contentLines = Math.max(1, innerHeight - titleHeight);

  const toolTexts = tools.map(t => {
    const icon = t.status === 'running' ? '...' : t.status === 'success' ? '[OK]' : '[ERR]';
    // 截断输出防止长文本撑开
    const outputPreview = t.output ? t.output.replace(/\n/g, ' ').slice(0, 30) : '';
    return `${icon} ${t.name}${outputPreview ? `:${outputPreview}` : ''}`;
  });

  let displayLines: string[];

  if (isRunning) {
    displayLines = toolTexts.slice(-contentLines);
  } else {
    if (toolTexts.length > contentLines) {
      const marqueeText = useMarquee(toolTexts.join('\n'), contentLines);
      displayLines = marqueeText.split('\n');
    } else {
      displayLines = toolTexts;
    }
  }

  displayLines = displayLines.slice(0, contentLines);

  return (
    <Box flexDirection="column" height={totalHeight} overflow="hidden" flexGrow={0} flexShrink={0}>
      <Box
        flexDirection="column"
        height={innerHeight}
        borderStyle="single"
        borderColor="green"
      >
        {/* 标题 */}
        <Box flexShrink={0}>
          <Text bold color="green" backgroundColor="black">{title} ({tools.length})</Text>
        </Box>
        {/* 内容 */}
        {displayLines.length > 0 ? (
          displayLines.map((line, i) => {
            const toolIndex = Math.min(i, tools.length - 1);
            const tool = tools[toolIndex];
            const color = tool?.status === 'running' ? 'yellow' : tool?.status === 'success' ? 'green' : 'red';
            return (
              <Box key={i} flexShrink={0}>
                <Text color={color} bold wrap="truncate">{line}</Text>
              </Box>
            );
          })
        ) : (
          <Box flexShrink={0}>
            <Text dimColor color="cyan">No tools in this round</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

ToolsPanel.displayName = 'ToolsPanel';