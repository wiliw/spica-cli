# TUI修复计划 v2 - 完成状态

## 问题清单（用户反馈）

### P0 - 关阻塞性问题 ✅ 已修复
1. **Round切换bug** - 简化useScroll，去掉isTransitioningRef复杂逻辑
2. **Thinking滚动问题** - 修改useMarquee支持isRunning参数，running显示最新，ed状态滚动
3. **结束后Thoughts不滚动** - 修复marquee在isRunning=false时正确启动interval

### P1 - 重要问题 ✅ 已修复
4. **AI回复显示位置** - 检查代码确认正确，stream事件→currentStream→AIOutputPanel
5. **生成中无法切换round** - 简化useScroll，autoFollow=false时允许手动切换

### P2 - 已确认正确
6. **Toolcalled内容** - 用户确认正确，associateEvents修复有效

## 已完成的修复

### 1. useScroll.ts
- 去掉isTransitioningRef，简化逻辑
- 切换round时直接setContentOffset(0)
- scrollDown到达最后round时设置autoFollow=true

### 2. useMarquee.ts
- 新增isRunning参数
- running状态：显示最新内容（phase设为最大）
- ed状态：启动marquee滚动（phase从0开始，400ms间隔）

### 3. ThinkingPanel.tsx
- 使用统一的useMarquee
- slice(0, contentHeight)确保不超过高度

### 4. ToolsPanel.tsx
- 使用统一的useMarquee
- output截断到50字符避免过长

### 5. associateEvents.ts
- 按user消息分割对话
- 正确收集范围内的tools和reasoning

## 测试结果
- 93个测试全部通过 ✅