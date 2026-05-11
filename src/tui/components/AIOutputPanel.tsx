import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationTurn } from '../types';

interface AIOutputPanelProps {
  turns: ConversationTurn[];
  scrollOffset: number;
  focusIndex: number;
  autoFollow?: boolean;
}

export const AIOutputPanel = React.memo(({ turns, scrollOffset, focusIndex, autoFollow }: AIOutputPanelProps) => {
  const focusedTurn = turns[focusIndex];
  const prevTurns = turns.slice(Math.max(0, focusIndex - 2), focusIndex);
  const nextTurns = turns.slice(focusIndex + 1, focusIndex + 2);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="single" borderColor="cyan">
        <Text bold color="cyan">
          Turns {focusIndex + 1}/{turns.length} {autoFollow ? '●AUTO' : '○MANUAL'}
        </Text>
      </Box>
      
      <Box flexDirection="column" flexGrow={1}>
        {prevTurns.map((turn, i) => (
          <Box key={turn.id} flexDirection="column" marginTop={1}>
            <Text dimColor color="gray">
              ── Turn {focusIndex - 2 + i + 1} ──
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
          <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={1} marginTop={1}>
            <Text bold color="yellow" inverse>
              ══ FOCUS: Turn {focusIndex + 1} ══
            </Text>
            <Box marginTop={1}>
              <Text bold color="green">
                ❯ Q: {focusedTurn.userMessage}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color="white">
                {focusedTurn.assistantMessage}
              </Text>
            </Box>
          </Box>
        )}
        
        {nextTurns.map((turn, i) => (
          <Box key={turn.id} flexDirection="column" marginTop={1}>
            <Text dimColor color="gray">
              ── Turn {focusIndex + i + 2} ──
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
            <Text dimColor>No turns yet</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

AIOutputPanel.displayName = 'AIOutputPanel';