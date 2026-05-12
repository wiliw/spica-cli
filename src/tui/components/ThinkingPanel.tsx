import React from 'react';
import { Box, Text } from 'ink';
import { useMarquee } from '../hooks/useMarquee';

interface ThinkingPanelProps {
  content: string;
  isRunning?: boolean;
  height?: number;
}

export const ThinkingPanel = React.memo(({ content, isRunning, height = 20 }: ThinkingPanelProps) => {
  const title = isRunning ? 'Thinking' : 'Thoughts';

  // 关键：height设置的是内容区高度，border在外面占额外2行
  // 所以总渲染高度 = height + 2
  // 我们用外部容器固定总高度，内部边框内容 = 总高度 - 2
  const totalHeight = height;
  const innerHeight = totalHeight - 2; // 减去border
  const titleHeight = 1;
  const contentLines = innerHeight - titleHeight;

  const allLines = content.trim() ? content.split('\n') : [];

  // 精确限制显示行数
  const safeMaxLines = Math.max(1, contentLines);
  let displayLines: string[];

  if (isRunning) {
    displayLines = allLines.slice(-safeMaxLines);
  } else {
    if (allLines.length > safeMaxLines) {
      const marqueeText = useMarquee(content, safeMaxLines);
      displayLines = marqueeText.split('\n');
    } else {
      displayLines = allLines;
    }
  }

  // 强制限制
  displayLines = displayLines.slice(0, safeMaxLines);

  return (
    // 外部容器：固定总高度，overflow裁剪
    <Box flexDirection="column" height={totalHeight} overflow="hidden" flexGrow={0} flexShrink={0}>
      <Box
        flexDirection="column"
        height={innerHeight}
        borderStyle="single"
        borderColor="magenta"
      >
        {/* 标题 */}
        <Box flexShrink={0}>
          <Text bold color="magenta" backgroundColor="black">{title}</Text>
        </Box>
        {/* 内容 */}
        {displayLines.length > 0 ? (
          displayLines.map((line, i) => (
            <Box key={i} flexShrink={0}>
              <Text color="yellow" wrap="truncate">{line}</Text>
            </Box>
          ))
        ) : (
          <Box flexShrink={0}>
            <Text dimColor color="magenta">No thinking recorded</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

ThinkingPanel.displayName = 'ThinkingPanel';