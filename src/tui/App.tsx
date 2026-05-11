import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useAgent } from './hooks/useAgent';
import { useScroll } from './hooks/useScroll';
import { ProviderSetupTUI } from './ProviderSetupTUI';
import { InputPanel } from './components/InputPanel';
import { AIOutputPanel } from './components/AIOutputPanel';
import { ThinkingPanel } from './components/ThinkingPanel';
import { ToolsPanel } from './components/ToolsPanel';

export function App() {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows || 40;
  const contentHeight = terminalHeight - 3;
  const { state, startTask, interrupt } = useAgent();
  const { focusIndex, contentOffset, autoFollow, scrollUp, scrollDown, jumpToLatest } = useScroll(state.turns.length);
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
      if (key.pageDown || ch === 'G') jumpToLatest();
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

  const focusedTurn = state.turns[focusIndex];
  const displayReasoning = state.currentReasoning || focusedTurn?.reasoning || '';
  const displayTools = state.isRunning 
    ? state.events.filter(e => e.type === 'tool_call').map(e => ({
        name: e.toolName || 'unknown',
        status: e.toolStatus || 'running',
        output: e.content || '',
      }))
    : focusedTurn?.tools || [];

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Box flexDirection="row" height={contentHeight}>
        <Box width="62%" height={contentHeight}>
          <AIOutputPanel
            turns={state.turns}
            focusIndex={focusIndex}
            contentOffset={contentOffset}
            autoFollow={autoFollow}
            height={contentHeight}
          />
        </Box>
        <Box width="38%" flexDirection="column" height={contentHeight}>
          <ThinkingPanel content={displayReasoning} isRunning={state.isRunning} height={Math.floor(contentHeight * 0.6)} />
          <ToolsPanel tools={displayTools} height={Math.floor(contentHeight * 0.4)} />
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