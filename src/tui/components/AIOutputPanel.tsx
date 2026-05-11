import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationTurn } from '../types';

interface AIOutputPanelProps {
  turns: ConversationTurn[];
  focusIndex: number;
  contentOffset: number;
  autoFollow?: boolean;
  height?: number;
}

export const AIOutputPanel = React.memo(({ turns, focusIndex, contentOffset, autoFollow, height = 30 }: AIOutputPanelProps) => {
  const focusedTurn = turns[focusIndex];
  const prevTurn = turns[focusIndex - 1];
  const nextTurn = turns[focusIndex + 1];

  if (!focusedTurn) {
    return (
      <Box flexDirection="column" height={height}>
        <Box borderStyle="single" borderColor="cyan" height={1}>
          <Text bold color="cyan">Rounds 0/0</Text>
        </Box>
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text dimColor>No rounds yet</Text>
        </Box>
      </Box>
    );
  }

  const contentLines = [
    `Q: ${focusedTurn.userMessage}`,
    ...focusedTurn.assistantMessage.split('\n').filter(l => l)
  ];

  const headerLines = 3;
  const indicatorLines = (prevTurn ? 1 : 0) + (nextTurn ? 1 : 0);
  const availableLines = height - headerLines - indicatorLines;
  const maxOffset = Math.max(0, contentLines.length - availableLines);
  const safeOffset = Math.min(Math.max(0, contentOffset), maxOffset);
  const visibleLines = contentLines.slice(safeOffset, safeOffset + availableLines);
  const hasMoreAbove = safeOffset > 0;
  const hasMoreBelow = safeOffset + availableLines < contentLines.length;

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="cyan" height={1}>
        <Text bold color="cyan">
          Rounds {focusIndex + 1}/{turns.length} {autoFollow ? '[AUTO]' : '[MANUAL]'}
        </Text>
      </Box>
      
      <Box borderStyle="double" borderColor="yellow" paddingX={1} flexGrow={1}>
        <Box flexDirection="column">
          <Text bold color="yellow" inverse>
            == FOCUS: Round {focusIndex + 1} ==
          </Text>
          
          {(hasMoreAbove || prevTurn) && (
            <Text dimColor color="gray">
              {hasMoreAbove ? '< scroll up' : `< Round ${focusIndex}`}
            </Text>
          )}
          
          <Box flexDirection="column" marginTop={1}>
            {visibleLines.map((line, i) => (
              <Text key={i} color={i === 0 ? 'green' : 'white'}>{line}</Text>
            ))}
          </Box>
          
          {(hasMoreBelow || nextTurn) && (
            <Text dimColor color="gray">
              {hasMoreBelow ? 'scroll down >' : `Round ${focusIndex + 2} >`}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
});

AIOutputPanel.displayName = 'AIOutputPanel';