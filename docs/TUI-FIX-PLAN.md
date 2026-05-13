# TUI修复计划

## 问题列表

### 1. Toolcalled结束生成后显示(0) - 顽固问题
**根因分析**：
- `associateEvents.ts` 第59-76行：assistant message到达时创建turn并清空tools
- 但在创建turn时`tools: [...currentTools]`应该是正确的复制
- 问题在于：assistant message可能在tool_result之前到达，导致turn创建时tools还是running状态
- 或者：最终turn创建时，currentTools已被清空

**修复方案**：
- 修改associateEvents逻辑：不立即清空tools，等待下一个user message才清空
- 或者：turn创建时保留之前所有工具（不按message分割）

### 2. ThinkingPanel没有滚动
**根因分析**：
- `useMarquee.ts` 每500ms滚动一行，但content可能变化时phase没有重置
- ing状态用slice(-contentHeight)，ed状态用marquee
- marquee可能没有正确工作（phase重置问题）

**修复方案**：
- 修复useMarquee：content变化时重置phase=0
- 确保interval正常工作

### 3. ToolsPanel没有滚动
**根因分析**：
- 同ThinkingPanel，useMarquee问题
- lines构建正确但displayContent可能不对

**修复方案**：
- 修复useMarquee（同上）

### 4. 各框滚动混乱
**根因分析**：
- AIOutputPanel有自己的scroll逻辑（contentOffset）
- ThinkingPanel/ToolsPanel使用marquee（自动滚动）
- 两者独立但可能状态冲突

**修复方案**：
- 确保每个Panel独立处理滚动
- AIOutputPanel：用户↑↓控制
- Thinking/Tools：自动marquee滚动

## 修复顺序

1. 先修复Toolcalled显示问题（最顽固）
2. 修复useMarquee滚动问题
3. 确保各框独立滚动
4. 运行测试验证