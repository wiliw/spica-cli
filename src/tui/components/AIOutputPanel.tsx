import React from 'react';
import { Box, Text } from 'ink';
import type { MessageWithContext } from '../types';
import { MessageItem } from './MessageItem';

const MAX_VISIBLE = 10;

interface AIOutputPanelProps {
  messages: MessageWithContext[];
  scrollOffset: number;
  focusIndex: number;
  autoFollow?: boolean;
}

export const AIOutputPanel = React.memo(({ messages, scrollOffset, focusIndex, autoFollow }: AIOutputPanelProps) => {
  const visibleMessages = messages.slice(scrollOffset, scrollOffset + MAX_VISIBLE);

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="cyan">
        <Text bold color="cyan">
          AI Output ({messages.length}) {autoFollow ? '●' : '○'}
        </Text>
      </Box>
      <Box flexDirection="column">
        {visibleMessages.map((msg, i) => (
          <MessageItem key={msg.id} message={msg} isFocused={scrollOffset + i === focusIndex} />
        ))}
        {messages.length === 0 && <Text dimColor>No messages</Text>}
      </Box>
    </Box>
  );
});

AIOutputPanel.displayName = 'AIOutputPanel';