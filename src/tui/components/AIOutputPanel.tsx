import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationTurn } from '../types';

const MAX_VISIBLE = 5;

interface AIOutputPanelProps {
  turns: ConversationTurn[];
  scrollOffset: number;
  focusIndex: number;
  autoFollow?: boolean;
}

export const AIOutputPanel = React.memo(({ turns, scrollOffset, focusIndex, autoFollow }: AIOutputPanelProps) => {
  const visibleTurns = turns.slice(scrollOffset, scrollOffset + MAX_VISIBLE);

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="cyan">
        <Text bold color="cyan">
          Turns ({turns.length}) {autoFollow ? '●' : '○'}
        </Text>
      </Box>
      <Box flexDirection="column">
        {visibleTurns.map((turn, i) => {
          const isFocused = scrollOffset + i === focusIndex;
          return (
            <Box key={turn.id} flexDirection="column" borderStyle={isFocused ? 'single' : undefined} borderColor={isFocused ? 'yellow' : undefined}>
              {isFocused && <Text bold color="yellow" inverse>◀ FOCUS</Text>}
              <Text dimColor color="cyan">
                You: {turn.userMessage.slice(0, 30)}...
              </Text>
              <Text dimColor>
                AI: {turn.assistantMessage.slice(0, 30)}...
              </Text>
            </Box>
          );
        })}
        {turns.length === 0 && <Text dimColor>No turns</Text>}
      </Box>
    </Box>
  );
});

AIOutputPanel.displayName = 'AIOutputPanel';