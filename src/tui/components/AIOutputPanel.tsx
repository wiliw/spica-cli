import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationTurn } from '../types';

interface AIOutputPanelProps {
  turns: ConversationTurn[];
  focusIndex: number;
  contentOffset: number;
  autoFollow?: boolean;
  height?: number;
  pendingInput?: string | null;
  onMaxOffsetChange?: (maxOffset: number) => void;
}

export const AIOutputPanel = React.memo(({ turns, focusIndex, contentOffset, autoFollow, height = 30, pendingInput, onMaxOffsetChange }: AIOutputPanelProps) => {
  const focusedTurn = turns[focusIndex];
  const prevTurn = turns[focusIndex - 1];
  const nextTurn = turns[focusIndex + 1];

  // 外部容器固定总高度
  const totalHeight = height;
  const innerHeight = totalHeight - 2; // border
  const titleHeight = 1;
  const focusHeaderHeight = 1;
  const indicatorHeight = 1;
  const contentAreaHeight = Math.max(1, innerHeight - titleHeight - focusHeaderHeight - indicatorHeight * 2);

  let contentLines: string[] = [];
  let isPending = false;

  if (!focusedTurn && !pendingInput) {
    contentLines = [];
    isPending = false;
  } else if (pendingInput && !focusedTurn) {
    contentLines = [`Q: ${pendingInput}`];
    isPending = true;
  } else if (focusedTurn) {
    contentLines = [
      `Q: ${focusedTurn.userMessage}`,
      ...focusedTurn.assistantMessage.split('\n')
    ];
  }

  const maxOffset = Math.max(0, contentLines.length - contentAreaHeight);

  React.useEffect(() => {
    onMaxOffsetChange?.(maxOffset);
  }, [maxOffset, onMaxOffsetChange]);

  // 空状态
  if (!focusedTurn && !pendingInput) {
    return (
      <Box flexDirection="column" height={totalHeight} overflow="hidden" flexGrow={0} flexShrink={0}>
        <Box flexDirection="column" height={innerHeight} borderStyle="single" borderColor="cyan">
          <Box flexShrink={0}>
            <Text bold color="cyan" backgroundColor="black">Rounds 0/0</Text>
          </Box>
          <Box alignItems="center" justifyContent="center">
            <Text dimColor>No rounds yet</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  const safeOffset = Math.min(Math.max(0, contentOffset), maxOffset);
  const visibleLines = contentLines.slice(safeOffset, safeOffset + contentAreaHeight);
  const hasMoreAbove = safeOffset > 0;
  const hasMoreBelow = safeOffset + contentAreaHeight < contentLines.length;

  return (
    <Box flexDirection="column" height={totalHeight} overflow="hidden" flexGrow={0} flexShrink={0}>
      <Box flexDirection="column" height={innerHeight} borderStyle="single" borderColor="cyan">
        {/* 标题 */}
        <Box flexShrink={0}>
          <Text bold color="cyan" backgroundColor="black">
            {isPending ? 'Rounds (pending)' : `Rounds ${focusIndex + 1}/${turns.length}`} {autoFollow ? '[AUTO]' : '[MANUAL]'}
          </Text>
        </Box>
        {/* FOCUS标题 */}
        <Box flexShrink={0}>
          <Text bold color="magenta" inverse backgroundColor="black">
            == FOCUS: Round {focusIndex + 1} ==
          </Text>
        </Box>
        {/* 上指示 */}
        <Box flexShrink={0}>
          <Text dimColor color="cyan">
            {hasMoreAbove ? '↑ more' : (prevTurn ? `< Round ${focusIndex}` : '')}
          </Text>
        </Box>
        {/* 内容 */}
        {visibleLines.map((line, i) => (
          <Box key={i} flexShrink={0}>
            <Text color={i === 0 ? 'green' : 'white'} wrap="truncate">{line}</Text>
          </Box>
        ))}
        {/* 下指示 */}
        <Box flexShrink={0}>
          <Text dimColor color="cyan">
            {hasMoreBelow ? '↓ more' : (nextTurn ? `Round ${focusIndex + 2} >` : '')}
          </Text>
        </Box>
      </Box>
    </Box>
  );
});

AIOutputPanel.displayName = 'AIOutputPanel';