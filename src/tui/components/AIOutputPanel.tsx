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
  const prevTurns = turns.slice(Math.max(0, focusIndex - 2), focusIndex);
  const nextTurns = turns.slice(focusIndex + 1, focusIndex + 2);

  const contentLines = focusedTurn 
    ? [
        `Q: ${focusedTurn.userMessage}`,
        ...focusedTurn.assistantMessage.split('\n').filter(l => l)
      ]
    : [];
  
  const headerHeight = 2;
  const focusHeaderHeight = 3;
  const visibleContentHeight = height - headerHeight - focusHeaderHeight - prevTurns.length * 4 - nextTurns.length * 4 - 2;
  const maxOffset = Math.max(0, contentLines.length - visibleContentHeight);
  const safeOffset = Math.min(Math.max(0, contentOffset), maxOffset);
  const visibleLines = contentLines.slice(safeOffset, safeOffset + visibleContentHeight);
  const hasMoreAbove = safeOffset > 0;
  const hasMoreBelow = safeOffset + visibleContentHeight < contentLines.length;

  return (
    <Box flexDirection="column" height={height}>
      <Box borderStyle="single" borderColor="cyan" height={headerHeight}>
        <Text bold color="cyan">
          Rounds {focusIndex + 1}/{turns.length} {autoFollow ? '[AUTO]' : '[MANUAL]'}
        </Text>
      </Box>
      
      <Box flexDirection="column" flexGrow={1}>
        {prevTurns.map((turn, i) => (
          <Box key={turn.id} flexDirection="column" marginTop={1}>
            <Text dimColor color="gray">
              -- Round {focusIndex - 2 + i + 1} --
            </Text>
            <Text dimColor>
              Q: {turn.userMessage}
            </Text>
            <Text dimColor>
              A: {turn.assistantMessage.split('\n')[0]}
            </Text>
          </Box>
        ))}
        
        {focusedTurn && (
          <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={1} marginTop={1} flexGrow={1}>
            <Text bold color="yellow" inverse>
              == FOCUS: Round {focusIndex + 1} ==
            </Text>
            {hasMoreAbove && (
              <Text dimColor color="gray">{'<'} scroll up for more</Text>
            )}
            <Box flexDirection="column" marginTop={1}>
              {visibleLines.map((line, i) => (
                <Text key={i} color={i === 0 ? 'green' : 'white'}>{line}</Text>
              ))}
            </Box>
            {hasMoreBelow && (
              <Text dimColor color="gray">scroll down for more {'>'}</Text>
            )}
          </Box>
        )}
        
        {nextTurns.map((turn, i) => (
          <Box key={turn.id} flexDirection="column" marginTop={1}>
            <Text dimColor color="gray">
              -- Round {focusIndex + i + 2} --
            </Text>
            <Text dimColor>
              Q: {turn.userMessage}
            </Text>
            <Text dimColor>
              A: {turn.assistantMessage.split('\n')[0]}
            </Text>
          </Box>
        ))}
        
        {turns.length === 0 && (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <Text dimColor>No rounds yet</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

AIOutputPanel.displayName = 'AIOutputPanel';