import React from 'react';
import { Box, Text } from 'ink';
import type { MessageWithContext } from '../types';

interface MessageItemProps {
  message: MessageWithContext;
  isFocused: boolean;
}

export const MessageItem = React.memo(({ message, isFocused }: MessageItemProps) => {
  const roleColor = message.role === 'user' ? 'cyan' : 'white';
  const rolePrefix = message.role === 'user' ? 'You:' : 'AI:';
  const focusIndicator = isFocused ? ' ←' : '';

  return (
    <Box flexDirection="column">
      <Text bold color={roleColor}>
        {rolePrefix} {focusIndicator}
      </Text>
      <Text color="white">
        {message.content.slice(0, 100)}{message.content.length > 100 ? '...' : ''}
      </Text>
    </Box>
  );
});

MessageItem.displayName = 'MessageItem';