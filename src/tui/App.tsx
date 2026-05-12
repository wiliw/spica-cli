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
  const terminalWidth = stdout?.columns || 100;

  // Input占用固定3行
  const inputHeight = 3;
  const contentHeight = terminalHeight - inputHeight;

  const { state, startTask, interrupt } = useAgent();
  const {
    focusIndex,
    contentOffset,
    autoFollow,
    scrollUp,
    scrollDown,
    jumpToLatest,
    setMaxContentOffset
  } = useScroll(state.turns.length);

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

    // 滚动控制
    if (key.upArrow) scrollUp();
    if (key.downArrow) scrollDown();
    if (key.pageDown || ch === 'G') jumpToLatest();

    if (key.ctrl && ch === 'p') setShowSetup(true);

    if (state.isRunning && key.escape) {
      setShowInterruptConfirm(true);
    }
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

  // ed状态显示focusedTurn的工具，ing状态显示当前运行的工具
  const displayTools: Array<{ name: string; status: 'running' | 'success' | 'error'; output?: string }> = state.isRunning
    ? state.events.filter(e => e.type === 'tool_call').map(e => ({
        name: e.toolName || 'unknown',
        status: e.toolStatus || 'running',
        output: e.content || '',
      }))
    : (focusedTurn?.tools || []).map(t => ({
        name: t.name,
        status: t.status,
        output: t.output || '',
      }));

  // 60/40 左右分屏
  const leftWidth = Math.floor(terminalWidth * 0.6);
  const rightWidth = terminalWidth - leftWidth;

  // 60/40 右侧上下分屏
  const thinkingHeight = Math.floor(contentHeight * 0.6);
  const toolsHeight = contentHeight - thinkingHeight;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {/* 内容区域 */}
      <Box flexDirection="row" height={contentHeight} width={terminalWidth}>
        {/* 左侧 - AI输出 */}
        <Box width={leftWidth} height={contentHeight} flexDirection="column">
          <AIOutputPanel
            turns={state.turns}
            focusIndex={focusIndex}
            contentOffset={contentOffset}
            autoFollow={autoFollow}
            height={contentHeight}
            pendingInput={state.pendingInput}
            onMaxOffsetChange={setMaxContentOffset}
          />
        </Box>
        {/* 右侧 - Thinking + Tools */}
        <Box width={rightWidth} height={contentHeight} flexDirection="column">
          <ThinkingPanel
            content={displayReasoning}
            isRunning={state.isRunning}
            height={thinkingHeight}
          />
          <ToolsPanel
            tools={displayTools}
            isRunning={state.isRunning}
            height={toolsHeight}
          />
        </Box>
      </Box>
      {/* 输入框 */}
      <Box height={inputHeight} width={terminalWidth}>
        <InputPanel
          onSubmit={startTask}
          onQuit={handleQuit}
          onInterrupt={handleInterrupt}
          isRunning={state.isRunning}
        />
      </Box>
    </Box>
  );
}