import React from 'react';
import { Box, Text, useInput } from 'ink';
import { setProviderConfig, getProviderConfig } from '../utils/config';

export function ProviderSetupTUI({ onComplete }: { onComplete?: () => void }) {
  const [apiKey, setApiKey] = React.useState('');
  const [baseUrl, setBaseUrl] = React.useState('https://coding.dashscope.aliyuncs.com/v1');
  const [model, setModel] = React.useState('glm-5');
  
  const [index, setIndex] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  const [buffer, setBuffer] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [ready, setReady] = React.useState(false);

  const items = ['apiKey', 'baseUrl', 'model', 'save'] as const;
  const labels = ['API Key', 'Base URL', 'Model', '✓ 保存'];

  React.useEffect(() => {
    getProviderConfig('openai').then(c => {
      setApiKey(c.apiKey || '');
      setBaseUrl(c.baseUrl || '');
      setModel(c.model || '');
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const save = async () => {
    if (!apiKey) { setMsg('需要 API Key'); return; }
    await setProviderConfig('openai', apiKey, baseUrl, model);
    setMsg('已保存');
    setTimeout(() => onComplete?.(), 500);
  };

  useInput((ch, key) => {
    if (!ready) return;
    
    if (editing) {
      if (key.return) {
        if (items[index] === 'apiKey') setApiKey(buffer);
        if (items[index] === 'baseUrl') setBaseUrl(buffer);
        if (items[index] === 'model') setModel(buffer);
        setEditing(false);
        setBuffer('');
        if (index < 3) setIndex(i => i + 1);
      } else if (key.escape) {
        setEditing(false);
        setBuffer('');
      } else if (key.backspace) {
        setBuffer(b => b.slice(0, -1));
      } else if (ch && ch.length === 1) {
        setBuffer(b => b + ch);
      }
    } else {
      if (ch === 'j' || key.downArrow) setIndex(i => (i + 1) % 4);
      if (ch === 'k' || key.upArrow) setIndex(i => (i - 1 + 4) % 4);
      if (key.return) {
        if (index === 3) save();
        else {
          const vals = [apiKey, baseUrl, model];
          setBuffer(vals[index] || '');
          setEditing(true);
        }
      }
      if (key.escape || ch === 'q') onComplete?.();
    }
  });

  if (!ready) return <Text>...</Text>;

  const vals = [apiKey, baseUrl, model];
  
  return (
    <Box flexDirection="column" padding={1} width={60}>
      <Box borderStyle="double" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">配置 API</Text>
      </Box>
      
      {labels.map((label, i) => {
        const sel = i === index;
        const edit = editing && sel;
        const isSave = i === 3;
        
        return (
          <Box key={i} marginTop={1}>
            <Box width={12}>
              <Text color={isSave ? 'green' : sel ? 'cyan' : 'gray'}>
                {sel ? '→ ' : '  '}{label}
              </Text>
            </Box>
            {!isSave && (
              <Box flexGrow={1}>
                <Text dimColor>
                  {edit ? `[${buffer}_]` : (vals[i] || '(未设置)')}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
      
      {msg && <Box marginTop={1}><Text color="yellow">{msg}</Text></Box>}
      
      <Box marginTop={1}>
        <Text dimColor>
          {editing ? 'Enter=save  Esc=cancel' : 'j/k=select  Enter=edit/save  q=quit'}
        </Text>
      </Box>
    </Box>
  );
}