import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useAgent } from './hooks/useAgent';
import { useScroll } from './hooks/useScroll';
import { ProviderSetupTUI } from './ProviderSetupTUI';
import { InputPanel } from './components/InputPanel';
import { AIOutputPanel } from './components/AIOutputPanel';
import { ThinkingPanel } from './components/ThinkingPanel';
import { ToolsPanel } from './components/ToolsPanel';

export function App() {
  const { state, startTask, interrupt } = useAgent();
  const { scrollOffset, focusIndex, scrollUp, scrollDown } = useScroll(state.messages.length);
  const [showSetup, setShowSetup] = React.useState(false);
  const [showInterruptConfirm, setShowInterruptConfirm] = React.useState(false);
  const [showExitSummary, setShowExitSummary] = React.useState(false);

  const handleQuit = () => {
    setShowExitSummary(true);
  };

  const handleInterrupt = () => {
    setShowInterruptConfirm(true);
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
    
    if (!state.isRunning) {
      if (key.upArrow) scrollUp();
      if (key.downArrow) scrollDown();
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

  const focusedMessage = state.messages[focusIndex];
  const displayReasoning = state.currentReasoning || focusedMessage?.reasoning || '';
  const displayTools = state.isRunning 
    ? state.events.filter(e => e.type === 'tool_call').map(e => ({
        name: e.toolName || 'unknown',
        status: e.toolStatus || 'running',
        output: e.content || '',
      }))
    : focusedMessage?.tools || [];

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box width="50%">
          <AIOutputPanel
            messages={state.messages}
            scrollOffset={scrollOffset}
            focusIndex={focusIndex}
          />
        </Box>
        <Box width="50%" flexDirection="column">
          <ThinkingPanel content={displayReasoning} />
          <ToolsPanel tools={displayTools} />
        </Box>
      </Box>
      <InputPanel 
        onSubmit={startTask} 
        onQuit={handleQuit}
        onInterrupt={handleInterrupt}
        isRunning={state.isRunning} 
      />
    </Box>
  );
}