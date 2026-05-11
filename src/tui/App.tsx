import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useAgent } from './hooks/useAgent';
import { ProviderSetupTUI } from './ProviderSetupTUI';
import { InputPanel } from './components/InputPanel';

export function App() {
  const { state, startTask, interrupt } = useAgent();
  const [showSetup, setShowSetup] = React.useState(false);
  const [showInterruptConfirm, setShowInterruptConfirm] = React.useState(false);
  const [showExitSummary, setShowExitSummary] = React.useState(false);

  const renderEvent = (event: any, i: number, events: any[]) => {
    if (event.type === 'message') {
      if (event.role === 'user') {
        return <Text key={i} bold color="cyan">You: {event.content}</Text>;
      } else {
        return <Text key={i} color="white">{event.content}</Text>;
      }
    }
    
    if (event.type === 'reasoning') {
      const isFirstReasoning = events.slice(0, i).filter(e => e.type === 'reasoning').length === 0;
      return <Text key={i} color="gray">{isFirstReasoning ? '[思] ' : ''}{event.content}</Text>;
    }
    
    if (event.type === 'tool_call') {
      const icon = event.toolStatus === 'running' ? '←' : event.toolStatus === 'success' ? '✓' : '✗';
      const color = event.toolStatus === 'running' ? 'yellow' : event.toolStatus === 'success' ? 'green' : 'red';
      
      let argDesc = '';
      if (event.toolArguments?.tasks) {
        const tasks = event.toolArguments.tasks;
        argDesc = `并行处理${tasks.length}个任务: ${tasks.map(t => t.description).join(', ')}`;
      } else {
        argDesc = event.toolArguments?.description || event.toolArguments?.prompt || '';
      }
      
      return (
        <Box key={i} flexDirection="column">
          <Text color={color}>{icon} {event.toolName}{argDesc ? `: ${argDesc}` : ''}</Text>
          {event.toolStatus !== 'running' && event.content && (
            <Text color="gray">{event.content.split('\n').slice(0, 3).join('\n')}</Text>
          )}
        </Box>
      );
    }
    
    return null;
  };

  useInput((ch, key) => {
    if (showExitSummary) {
      if (key.return) process.exit(0);
      return;
    }
    
    if (showInterruptConfirm) {
      if (key.escape) {
        interrupt();
        setShowInterruptConfirm(false);
      } else if (key.return) {
        setShowInterruptConfirm(false);
      }
      return;
    }
    
    if (key.escape && state.isRunning) {
      setShowInterruptConfirm(true);
      return;
    }
    
    if (key.ctrl && ch === 'p') setShowSetup(true);
  });

  if (showSetup) return <ProviderSetupTUI onComplete={() => setShowSetup(false)} />;

  if (showExitSummary) {
    const duration = state.sessionStart 
      ? Math.round((new Date().getTime() - state.sessionStart.getTime()) / 1000 / 60)
      : 0;
    
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Box borderStyle="double" borderColor="green" padding={2} flexDirection="column">
          <Text bold color="green">Session Summary</Text>
          <Text>━━━━━━━━━━━━━━━</Text>
          <Text>Duration: {duration} min</Text>
          <Text>Tasks: {state.taskCount}</Text>
          <Text dimColor>Enter to exit</Text>
        </Box>
      </Box>
    );
  }

  if (showInterruptConfirm) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Box borderStyle="single" borderColor="yellow" padding={2}>
          <Text bold color="yellow">Interrupt?</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>ESC = yes | Enter = no</Text>
        </Box>
      </Box>
    );
  }

  const borderColor = state.isRunning ? 'yellow' : 'gray';
  
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        {state.events
          .filter(e => e.timestamp)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          .map((event, i) => renderEvent(event, i, state.events))}
        
        {state.currentStream && (
          <Text color="white">{state.currentStream}</Text>
        )}
        
        {state.error && <Text color="red">✗ {state.error}</Text>}
        
        {!state.isRunning && state.events.length === 0 && (
          <Text dimColor>Ready</Text>
        )}
      </Box>

      <Box borderStyle="single" borderColor={borderColor} paddingX={1}>
        <InputPanel onSubmit={startTask} isRunning={state.isRunning} />
      </Box>
    </Box>
  );
}