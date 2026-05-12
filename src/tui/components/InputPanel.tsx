import React from 'react';
import { Box } from 'ink';
import TextInput from 'ink-text-input';

interface InputPanelProps {
  onSubmit: (text: string) => void;
  onQuit: () => void;
  onInterrupt: () => void;
  isRunning: boolean;
}

export const InputPanel = React.memo(({ onSubmit, onQuit, isRunning }: InputPanelProps) => {
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

  const borderColor = isRunning ? 'yellow' : 'gray';
  const placeholder = isRunning ? 'Running... (ESC to interrupt)' : 'Input (quit to exit)';

  return (
    <Box height={3} overflow="hidden" flexGrow={0} flexShrink={0}>
      <Box height={1} borderStyle="single" borderColor={borderColor} paddingX={1}>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
    </Box>
  );
});

InputPanel.displayName = 'InputPanel';