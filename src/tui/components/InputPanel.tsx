import React from 'react';
import { Box } from 'ink';
import TextInput from 'ink-text-input';

interface InputPanelProps {
  onSubmit: (text: string) => void;
  isRunning: boolean;
}

export const InputPanel = React.memo(({ onSubmit, isRunning }: InputPanelProps) => {
  const [value, setValue] = React.useState('');

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  const borderColor = isRunning ? 'yellow' : 'gray';
  const placeholder = isRunning ? 'Running...' : 'Input (ESC to interrupt)';

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