# Spica CLI - TUI Architecture

## Overview
Spica CLI 提供全屏终端UI，用于AI编程代理交互。已实现所有核心功能和高级特性。

## Layout Design

### Screen Division (Golden Ratio)
```
┌─────────────────────────────────────────────────────────────┐
│ Terminal (100% width, height = stdout.rows)                 │
├──────────────────────┬──────────────────────────────────────┤
│ Rounds (60%)         │ Thinking (60% of right)              │
│                      ├──────────────────────────────────────┤
│                      │ Tools (40% of right)                 │
├──────────────────────┴──────────────────────────────────────┤
│ Status Bar (running时显示)                                   │
├─────────────────────────────────────────────────────────────┤
│ Input Panel (fixed height)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Ink Border Calculation (关键修正)
Ink的borderStyle在**内部**占用空间：
```typescript
const borderHeight = 2;  // 上下边框各1行
const titleHeight = 1;
const contentHeight = totalHeight - borderHeight - titleHeight;
```

### Height Enforcement
使用固定高度 + overflow="hidden"：
```typescript
<Box height={totalHeight} overflow="hidden" flexGrow={0} flexShrink={0}>
  <Box flexDirection="column" borderStyle="single" borderColor="cyan">
    <Box height={1}><Text>Title</Text></Box>
    <Box height={contentHeight} overflow="hidden">...</Box>
  </Box>
</Box>
```

## Components

### AIOutputPanel (Rounds)
- **Focus Model**: One round = User + Assistant + Tools
- **Navigation**: ↑↓ 滚动内容，边界处切换回合
- **States**: `[AUTO]` 自动跟随最新，`[MANUAL]` 浏览历史
- **Wrap**: `wrap="wrap"` 换行显示，不截断

### ThinkingPanel  
- **ing**: `slice(-maxLines)` 只显示最新
- **ed**: `useMarquee()` 滚动历史
- **Color**: Magenta边框，Yellow文本

### ToolsPanel
- **ing**: 最新工具，每工具2行（名称+output）
- **ed**: 完整历史，带依赖符号
- **Dependencies**: `→` 串行，`‖` 并行
- **Color**: Green边框，状态彩色

### InputPanel
- **Height**: 固定3行
- **Running**: 显示状态条（Step X: tool_name）
- **Queue**: 显示任务队列 `[Queue: N]`
- **Tab**: 命令补全

### StatusBanners
- **ErrorBanner**: 红色横幅，显示错误+修复建议
- **DiffPreview**: 蓝色横幅，显示编辑摘要

## Data Flow

### Event → Turn Association
```typescript
associateEvents(events: Event[]): ConversationTurn[]
```
- 同工具名只保留最新状态（替换running→success）
- 创建incomplete turn等待响应
- 响应完成时push turn

### State Management
```typescript
interface AgentState {
  turns: ConversationTurn[]
  events: Event[]
  isRunning: boolean
  currentToolName: string | null
  iterationCount: number
  errorSuggestion: ErrorSuggestion | null
  diffPreview: DiffPreview | null
  taskQueue: string[]
}
```

## New Features

### 1. Error Recovery Suggestion
```typescript
// agent.ts
private generateErrorSuggestion(toolName, error, args): string
```
- file_read ENOENT → "文件不存在，使用glob搜索"
- bash command not found → "安装对应工具"
- 自动发送 `error_suggestion` 事件

### 2. Diff Preview
```typescript
// 文件编辑成功时
this.emit('diff_preview', { filePath, diff })
```
- 显示前6行diff
- 3秒后自动消失

### 3. Context Compression
```typescript
compressHistory(messages: ChatMessage[]): ChatMessage[]
```
- 超过20条时压缩
- 保留最近消息
- 旧消息生成摘要

### 4. Command Completion
```typescript
COMMAND_SUGGESTIONS = [
  'read ', 'write ', 'edit ', 'bash ', ...
]
```
- Tab补全
- 循环显示建议

### 5. Session Export
```typescript
exportSession(state): void
```
- Ctrl+E导出
- 输出到 `spica-session.md`

### 6. Keyboard Help
- Ctrl+H显示overlay
- 列出所有快捷键

### 7. Tool Dependencies
```typescript
analyzeDependencies(toolList): ToolDisplay[]
```
- prevTool.name === tool.name → `‖` 并行
- 否则 → `→` 串行

## Interrupt Mechanism

```typescript
// AbortController模式
abortController = new AbortController()
provider.generate(prompt, tools, abortController.signal)

// 流中断
if (signal?.aborted) break
```

## Color Scheme
- Cyan: Rounds
- Magenta: Thinking
- Green: Tools
- Yellow: Running状态
- Red: Error
- Blue: Diff预览

## Testing
- 85个测试全部通过
- TypeScript编译无误
- 真实终端验证完成

## File Structure
```
src/tui/
  App.tsx                    # 主布局
  components/
    AIOutputPanel.tsx        # Rounds
    ThinkingPanel.tsx        # Thinking/Thoughts
    ToolsPanel.tsx           # Toolcalling/Toolcalled
    InputPanel.tsx           # Input + 补全 + 队列
    StatusBanners.tsx        # Error + Diff横幅
  hooks/
    useAgent.ts              # 状态管理
    useScroll.ts             # 滚动逻辑
    useMarquee.ts            # 自动滚动
  utils/
    associateEvents.ts       # Event→Turn
  types.ts                   # 类型定义
src/agent.ts                 # Agent核心（含压缩、错误建议）
```