import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationTurn } from '../types';

interface AIOutputPanelProps {
  turns: ConversationTurn[];
  focusIndex: number;
  contentOffset: number;
  autoFollow?: boolean;
  viewportHeight?: number;
}

export const AIOutputPanel = React.memo(({ 
  turns, 
  focusIndex, 
  contentOffset, 
  autoFollow,
  viewportHeight = 20
}: AIOutputPanelProps) => {
  const focusedTurn = turns[focusIndex];
  const prevTurn = turns[focusIndex - 1];
  const nextTurn = turns[focusIndex + 1];

  const contentLines = focusedTurn 
    ? [
        `Q: ${focusedTurn.userMessage}`,
        '',
        ...focusedTurn.assistantMessage.split('\n')
      ].filter(Boolean)
    : [];

  const visibleLines = contentLines.slice(contentOffset, contentOffset + viewportHeight);
  const hasMoreAbove = contentOffset > 0;
  const hasMoreBelow = contentOffset + viewportHeight < contentLines.length;
  const contentHeight = contentLines.length;

  return (
    <Box flexDirection="column" height={viewportHeight}>
      <Box borderStyle="single" borderColor="cyan">
        <Text bold color="cyan">
          Rounds {focusIndex + 1}/{turns.length} {autoFollow ? '[AUTO]' : '[MANUAL]'}
        </Text>
      </Box>
      
      <Box flexDirection="column" flexGrow={1}>
        {prevTurn && (
          <Box marginTop={1}>
            <Text dimColor color="gray">
              [Round {focusIndex}] {'<'}{hasMoreAbove ? ' ^' : ''}
            </Text>
          </Box>
        )}
        
        {!prevTurn && hasMoreAbove && (
          <Box marginTop={1}>
            <Text dimColor color="gray">{'^'} more above</Text>
          </Box>
        )}
        
        {focusedTurn && (
          <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={1}>
            <Text bold color="yellow" inverse>
              == FOCUS: Round {focusIndex + 1} ==
            </Text>
            <Box marginTop={1}>
              {visibleLines.map((line, i) => (
                <Text key={i} color="white">{line}</Text>
              ))}
            </Box>
            {hasMoreBelow && (
              <Text dimColor color="gray">{'v'} more below</Text>
            )}
          </Box>
        )}
        
        {nextTurn && !hasMoreBelow && (
          <Box marginTop={1}>
            <Text dimColor color="gray">
              [Round {focusIndex + 2}] {'>'}
            </Text>
          </Box>
        )}
        
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