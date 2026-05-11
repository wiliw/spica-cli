import React from 'react';
import { render, Box, Text, useInput } from 'ink';

interface ConfigItem {
  key: string;
  label: string;
  value: string | undefined;
}

interface Props {
  config: Record<string, any>;
  onSave: (key: string, value: string) => void;
  onExit: () => void;
}

export function ConfigTUI({ config, onSave, onExit }: Props) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  
  const items: ConfigItem[] = [
    { key: 'openai.apiKey', label: 'API Key', value: config.openai?.apiKey },
    { key: 'openai.model', label: 'Model', value: config.openai?.model || 'gpt-4' },
    { key: 'openai.baseUrl', label: 'Base URL', value: config.openai?.baseUrl },
  ];

  useInput((input, key) => {
    if (editing) {
      if (key.return) {
        onSave(items[selectedIndex].key, inputValue);
        setEditing(false);
        setInputValue('');
      } else if (key.escape) {
        setEditing(false);
        setInputValue('');
      } else if (key.backspace || key.delete) {
        setInputValue(prev => prev.slice(0, -1));
      } else {
        setInputValue(prev => prev + input);
      }
    } else {
      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
      } else if (key.return || input === 'e') {
        setInputValue(items[selectedIndex].value || '');
        setEditing(true);
      } else if (key.escape || input === 'q') {
        onExit();
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan">
        <Text bold color="cyan">spica config</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>↑↓ Navigate | Enter/E Edit | Esc/Q Exit</Text>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        {items.map((item, index) => (
          <Box key={`config-${index}`} marginBottom={1}>
            <Box width={2}>
              <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
                {index === selectedIndex ? '▸' : ' '}
              </Text>
            </Box>
            <Box width={12}>
              <Text bold={index === selectedIndex}>{item.label}:</Text>
            </Box>
            <Box flexGrow={1}>
              {editing && index === selectedIndex ? (
                <Text color="yellow">{inputValue}_</Text>
              ) : (
                <Text color={item.value ? 'green' : 'red'}>
                  {item.value || '(not set)'}
                </Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      
      {editing && (
        <Box marginTop={1}>
          <Text dimColor>Enter to save | Esc to cancel</Text>
        </Box>
      )}
    </Box>
  );
}

export async function runConfigTUI() {
  const { loadConfig, setConfigValue } = await import('./config');
  const config = await loadConfig();
  
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ConfigTUI
        config={config}
        onSave={async (key, value) => {
          await setConfigValue(key, value);
        }}
        onExit={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}