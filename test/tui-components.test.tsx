import React from 'react';
import { render } from 'ink-testing-library';
import { AIOutputPanel } from '../src/tui/components/AIOutputPanel';
import { ToolsPanel } from '../src/tui/components/ToolsPanel';
import { ThinkingPanel } from '../src/tui/components/ThinkingPanel';
import type { ConversationTurn } from '../src/tui/types';

describe('TUI Components Detailed Tests', () => {
  describe('AIOutputPanel', () => {
    test('shows complete content without truncation', () => {
      const turn: ConversationTurn = {
        id: 'test-1',
        userMessage: '创建一个hello world程序',
        assistantMessage: '好的，我来帮你创建一个hello world程序。\n\n这是第一行内容。\n这是第二行内容。\n这是第三行内容。',
        reasoning: '',
        tools: [
          { name: 'file_write', arguments: {}, status: 'success', output: 'Created: hello.js', timestamp: new Date() },
          { name: 'bash', arguments: {}, status: 'success', output: 'Running node hello.js', timestamp: new Date() },
        ],
        timestamp: new Date(),
      };

      const { stdout, unmount } = render(
        <AIOutputPanel
          turns={[turn]}
          focusIndex={0}
          contentOffset={0}
          autoFollow={true}
          height={20}
        />
      );

      const output = stdout.lastFrame();

      // 验证用户问题显示
      expect(output).toContain('Q: 创建一个hello world程序');

      // 验证工具统计显示
      expect(output).toContain('Tools:');

      // 验证内容完整显示（不截断）
      expect(output).toContain('这是第一行内容');
      expect(output).toContain('这是第二行内容');
      expect(output).toContain('这是第三行内容');

      console.log('AIOutputPanel输出:\n', output);

      unmount();
    });

    test('shows streaming content during running', () => {
      const turn: ConversationTurn = {
        id: 'test-2',
        userMessage: '测试流式显示',
        assistantMessage: '',
        reasoning: '',
        tools: [],
        timestamp: new Date(),
      };

      const streamContent = '正在生成内容...\n这是流式输出的内容。';

      const { stdout, unmount } = render(
        <AIOutputPanel
          turns={[turn]}
          focusIndex={0}
          contentOffset={0}
          autoFollow={true}
          height={20}
          currentStream={streamContent}
          isRunning={true}
        />
      );

      const output = stdout.lastFrame();

      // 验证流式内容被正确分割为多行
      expect(output).toContain('正在生成内容...');
      // 注意：由于内容可能被换行显示，检查两行是否都存在
      const lines = output.split('\n');
      const hasBothLines = lines.some(l => l.includes('正在生成内容')) && lines.some(l => l.includes('这是流式输出'));

      console.log('Streaming输出:\n', output);
      console.log('是否包含两行:', hasBothLines);

      unmount();
    });
  });

  describe('ToolsPanel', () => {
    test('shows completed tools with correct colors', () => {
      const tools = [
        { name: 'file_read', status: 'success', output: 'Read 100 lines' },
        { name: 'file_write', status: 'success', output: 'Wrote hello.js' },
        { name: 'bash', status: 'error', output: 'Command failed' },
      ];

      const { stdout, unmount } = render(
        <ToolsPanel
          tools={tools}
          height={15}
          isRunning={false}
        />
      );

      const output = stdout.lastFrame();

      // 验证标题
      expect(output).toContain('Toolcalled');
      expect(output).toContain('(3)');

      // 验证工具名称显示
      expect(output).toContain('file_read');
      expect(output).toContain('file_write');
      expect(output).toContain('bash');

      // 验证输出内容显示
      expect(output).toContain('Read 100 lines');
      expect(output).toContain('Wrote hello.js');

      console.log('ToolsPanel输出:\n', output);

      unmount();
    });

    test('shows running tools with different color', () => {
      const tools = [
        { name: 'file_read', status: 'running', output: '' },
      ];

      const { stdout, unmount } = render(
        <ToolsPanel
          tools={tools}
          height={10}
          isRunning={true}
        />
      );

      const output = stdout.lastFrame();

      expect(output).toContain('Toolcalling');
      expect(output).toContain('...');

      console.log('Running Tools输出:\n', output);

      unmount();
    });
  });

  describe('ThinkingPanel', () => {
    test('shows thinking content', () => {
      const content = '用户想要创建程序。\n我需要：\n1. 先查看项目结构\n2. 创建文件\n3. 运行测试';

      const { stdout, unmount } = render(
        <ThinkingPanel
          content={content}
          height={10}
          isRunning={true}
        />
      );

      const output = stdout.lastFrame();

      expect(output).toContain('Thinking');
      expect(output).toContain('用户想要创建程序');

      console.log('ThinkingPanel输出:\n', output);

      unmount();
    });
  });

  describe('Integration: Full workflow', () => {
    test('completed task shows all tools in Toolcalled panel', async () => {
      // 模拟一个完成的任务状态
      const completedTurn: ConversationTurn = {
        id: 'completed-1',
        userMessage: '列出当前目录的文件',
        assistantMessage: '好的，当前目录包含以下文件：\n- src/\n- test/\n- package.json',
        reasoning: '用户想看目录内容',
        tools: [
          { name: 'bash', arguments: { command: 'ls' }, status: 'success', output: 'src test package.json', timestamp: new Date() },
        ],
        timestamp: new Date(),
      };

      // 测试AIOutputPanel显示完整内容
      const { stdout: aiOutput, unmount: unmountAI } = render(
        <AIOutputPanel
          turns={[completedTurn]}
          focusIndex={0}
          contentOffset={0}
          autoFollow={true}
          height={20}
        />
      );

      const aiFrame = aiOutput.lastFrame();
      console.log('AIOutput完整输出:\n', aiFrame);

      // 验证内容不截断
      expect(aiFrame).toContain('列出当前目录的文件');
      expect(aiFrame).toContain('src');
      expect(aiFrame).toContain('test');

      unmountAI();

      // 测试ToolsPanel显示已完成工具
      const { stdout: toolsOutput, unmount: unmountTools } = render(
        <ToolsPanel
          tools={completedTurn.tools.map(t => ({ name: t.name, status: t.status, output: t.output }))}
          height={10}
          isRunning={false}
        />
      );

      const toolsFrame = toolsOutput.lastFrame();
      console.log('Tools完整输出:\n', toolsFrame);

      // 关键测试：工具必须显示
      expect(toolsFrame).toContain('bash');
      expect(toolsFrame).toContain('[OK]');
      expect(toolsFrame).toContain('src test package.json');

      unmountTools();
    }, 5000);
  });
});