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
}

export const AIOutputPanel = React.memo(({ turns, focusIndex, contentOffset, autoFollow, height = 30, pendingInput }: AIOutputPanelProps) => {
  const focusedTurn = turns[focusIndex];
  const prevTurn = turns[focusIndex - 1];
  const nextTurn = turns[focusIndex + 1];

  const headerHeight = 1;
  const borderHeight = 2;
  const contentHeight = height - headerHeight - borderHeight;

  if (!focusedTurn && !pendingInput) {
    return (
      <Box flexDirection="column" height={height}>
        <Box borderStyle="single" borderColor="cyan" height={headerHeight}>
          <Text bold color="cyan">Rounds 0/0</Text>
        </Box>
        <Box height={contentHeight} alignItems="center" justifyContent="center">
          <Text dimColor>No rounds yet</Text>
        </Box>
      </Box>
    );
  }

  let contentLines: string[] = [];
  let isPending = false;
  
  if (pendingInput && !focusedTurn) {
    contentLines = [`Q: ${pendingInput}`];
    isPending = true;
  } else if (focusedTurn) {
    contentLines = [
      `Q: ${focusedTurn.userMessage}`,
      ...focusedTurn.assistantMessage.split('\n')
    ];
  }

  const maxOffset = Math.max(0, contentLines.length - contentHeight);
  const safeOffset = Math.min(Math.max(0, contentOffset), maxOffset);
  const visibleLines = contentLines.slice(safeOffset, safeOffset + contentHeight);
  const hasMoreAbove = safeOffset > 0;
  const hasMoreBelow = safeOffset + contentHeight < contentLines.length;

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="cyan" height={headerHeight}>
        <Text bold color="cyan" backgroundColor="black">
          {isPending ? 'Rounds (pending)' : `Rounds ${focusIndex + 1}/${turns.length}`} {autoFollow ? '[AUTO]' : '[MANUAL]'}
        </Text>
      </Box>
      
      <Box borderStyle="double" borderColor="magenta" height={contentHeight} flexDirection="column">
        <Text bold color="magenta" inverse backgroundColor="black">
          == FOCUS: Round {focusIndex + 1} ==
        </Text>
        
        <Box flexDirection="column" marginTop={1} height={contentHeight - 4}>
          {(hasMoreAbove || prevTurn) && (
            <Text dimColor color="cyan">
              {hasMoreAbove ? '< scroll up' : `< Round ${focusIndex}`}
            </Text>
          )}
          {visibleLines.map((line, i) => (
            <Box key={i} minHeight={1}>
              <Text color={i === 0 ? 'green' : 'white'}>{line}</Text>
            </Box>
          ))}
          {(hasMoreBelow || nextTurn) && (
            <Text dimColor color="cyan">
              {hasMoreBelow ? 'scroll down >' : `Round ${focusIndex + 2} >`}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
});

AIOutputPanel.displayName = 'AIOutputPanel';