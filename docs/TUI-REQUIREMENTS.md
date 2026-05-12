# TUI 需求文档（已确认）

**最后更新**: 2026-05-12  
**状态**: 已确认并实现

---

## 1. 全屏显示（核心需求）

### 要求
- **必须在终端内全屏显示**，不需要滚动整个终端
- 所有内容区域的滚动都在**区域内滚动**，终端本身固定不动
- 基于真实终端窗口大小：`stdout.rows` 和 `stdout.columns`

### 实现
```typescript
const terminalHeight = stdout?.rows || 40;
const terminalWidth = stdout?.columns || 100;
const inputHeight = 3;
const inputBorderSpace = 2;
const contentHeight = terminalHeight - inputHeight - inputBorderSpace;
```

---

## 2. 布局比例（黄金分割）

### 固定比例
```
┌─────────────────────┬─────────────────────┐
│ Rounds (左 60%)     │ Thinking (上 60%)   │
│                     ├─────────────────────┤
│                     │ Tools    (下 40%)   │
├─────────────────────┴─────────────────────┤
│ Input (固定 3行)                          │
└───────────────────────────────────────────┘
```

### 代码
```typescript
<Box width="60%">
  <AIOutputPanel height={contentHeight} />
</Box>
<Box width="40%" flexDirection="column">
  <ThinkingPanel height={Math.floor(contentHeight * 0.6)} />
  <ToolsPanel height={Math.ceil(contentHeight * 0.4)} />
</Box>
```

---

## 3. ing/ed 状态工作方式

### ThinkingPanel

#### ing状态 (isRunning=true)
- **标题**: "Thinking"
- **内容显示**: 只显示最新内容，旧内容消失
- **实现**: `slice(-maxLines)` - 从末尾取N行
- **无marquee**: 不滚动，固定显示最新

```typescript
const visibleLines = isRunning 
  ? allLines.slice(-maxLines)  // 最新N行
  : allLines.slice(0, maxLines);
```

#### ed状态 (isRunning=false)
- **标题**: "Thoughts"
- **内容显示**: 显示完整历史
- **marquee滚动**: 如果内容超过maxLines，自动滚动
- **实现**: `useMarquee(content, maxLines)` - 每500ms滚动一帧

```typescript
const needsMarquee = !isRunning && allLines.length > maxLines;
const displayText = needsMarquee 
  ? useMarquee(content, maxLines)
  : visibleLines.join('\n');
```

### ToolsPanel

#### ing状态 (isRunning=true)
- **标题**: "Toolcalling"
- **内容显示**: 只显示最新正在执行的tools
- **实现**: `slice(-maxLines)` - 最新N个tool
- **无marquee**: 不滚动

#### ed状态 (isRunning=false)
- **标题**: "Toolcalled"
- **内容显示**: 显示完整历史tools
- **marquee滚动**: 如果tools超过maxLines，自动滚动
- **实现**: `useMarquee(toolTexts.join('\n'), maxLines)`

---

## 4. 高度约束（防止撑开）

### 严格要求
**所有Box必须使用双重约束**，防止内容撑开边框：

```typescript
// ❌ 错误 - 内容会撑开
<Box height={30}>

// ✅ 正确 - 强制固定高度
<Box minHeight={30} maxHeight={30}>
```

### 应用范围
1. **整个面板**: `<Box minHeight={height} maxHeight={height}>`
2. **header区域**: `<Box minHeight={2} maxHeight={2}>`
3. **content区域**: `<Box minHeight={contentHeight} maxHeight={contentHeight}>`
4. **每一行内容**: `<Box minHeight={1} maxHeight={1}>`

### 边框空间计算
Ink的 `borderStyle="single"` 会占用额外高度：
- **top边框**: 1行
- **bottom边框**: 1行
- **header总高度**: 2行

```typescript
const headerHeight = 2;  // 包含边框
const contentHeight = height - headerHeight;
```

---

## 5. 边框样式

### 样式要求
- **单线边框**: `borderStyle="single"`
- **字符**: `┌─┐│└┘`（简洁的单线框）
- **颜色**: 
  - Rounds: cyan
  - Thinking: magenta
  - Tools: green
  - Input: gray (idle) / yellow (running)

### 实现
```typescript
<Box borderStyle="single" borderColor="cyan">
```

---

## 6. Input框

### 固定要求
- **高度**: 固定3行
- **宽度**: 100%（全宽，不跟随内容）
- **位置**: 紧贴在content区域下方，无空隙

### 实现
```typescript
<Box minHeight={3} maxHeight={3} width="100%">
  <InputPanel />
</Box>
```

---

## 7. 内容显示规则

### Rounds (AIOutputPanel)
- **焦点round**: 完整显示内容（可区域内滚动）
- **相邻round**: 只显示indicator（`< Round N` / `Round N >`）
- **内容超出**: 在区域内滚动，不撑开边框

### Thinking/Tools
- **ing状态**: 最新内容，旧内容消失
- **ed状态**: marquee滚动完整历史
- **空内容**: 显示占位文本（居中显示）

---

## 8. 禁止事项

### ❌ 严禁
1. 使用单一 `height={X}` - 会撑开
2. 内容撑开边框 - 必须强制约束
3. 终端本身滚动 - 必须全屏固定
4. Input宽度跟随内容 - 必须100%全宽
5. ing状态使用marquee - 只显示最新
6. ed状态不显示完整历史 - 必须marquee

---

## 9. 验证清单

### 功能验证
- [ ] 全屏显示（无终端滚动）
- [ ] 左右60/40比例
- [ ] Thinking上下60/40比例
- [ ] Input固定底部3行
- [ ] Input全宽（不跟随内容）
- [ ] ing状态：最新内容消失旧内容
- [ ] ed状态：marquee滚动历史
- [ ] 内容不撑开边框
- [ ] 单线边框样式

### 测试验证
- [ ] 所有79个测试通过
- [ ] 真实终端运行验证
- [ ] 长内容测试（不撑开）
- [ ] 快速输入测试（Input稳定）
- [ ] ing→ed状态切换测试

---

## 10. 文件清单

### 核心文件
- `src/tui/App.tsx` - 主布局
- `src/tui/components/AIOutputPanel.tsx` - Rounds区
- `src/tui/components/ThinkingPanel.tsx` - Thinking区
- `src/tui/components/ToolsPanel.tsx` - Tools区
- `src/tui/components/InputPanel.tsx` - Input框
- `src/tui/hooks/useMarquee.ts` - marquee滚动
- `docs/tui-architecture.md` - 技术架构
- `docs/TUI-REQUIREMENTS.md` - 本需求文档

---

## 更新历史

- **2026-05-12**: 初始版本，记录已确认需求