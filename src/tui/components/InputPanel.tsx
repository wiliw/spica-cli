import React from 'react';
import { Box, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputPanelProps {
  onSubmit: (text: string) => void;
  onQuit: () => void;
  onInterrupt: () => void;
  isRunning: boolean;
}

export const InputPanel = React.memo(({ onSubmit, onQuit, onInterrupt, isRunning }: InputPanelProps) => {
  const [value, setValue] = React.useState('');

  const handleSubmit = () => {
    if (value.trim().toLowerCase() === 'quit') {
      onQuit();
      setValue('');
      return;
    }
    
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  useInput((input, key) => {
    if (key.escape && isRunning) {
      onInterrupt();
    }
  });

  const borderColor = isRunning ? 'yellow' : 'gray';
  const placeholder = isRunning ? 'Running... (ESC to interrupt)' : 'Input (quit to exit)';

  return (
    <Box borderStyle="single" borderColor={borderColor} paddingX={1}>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
});

InputPanel.displayName = 'InputPanel';