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

  if (isFocused) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text bold color="yellow" inverse>
          {rolePrefix} ◀ FOCUS
        </Text>
        <Text color="white" bold>
          {message.content.slice(0, 80)}{message.content.length > 80 ? '...' : ''}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text dimColor color={roleColor}>
        {rolePrefix}
      </Text>
      <Text dimColor>
        {message.content.slice(0, 60)}{message.content.length > 60 ? '...' : ''}
      </Text>
    </Box>
  );
});

MessageItem.displayName = 'MessageItem';