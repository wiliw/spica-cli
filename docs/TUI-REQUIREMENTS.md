# TUI 需求文档（已实现）

**最后更新**: 2026-05-12 (修复版)
**状态**: 已完全实现 + 问题修复完成

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
const contentHeight = terminalHeight - inputHeight;
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
│ Status Bar (动态)                          │  ← 新增：运行时显示进度
├───────────────────────────────────────────┤
│ Input (固定)                               │
└───────────────────────────────────────────┘
```

---

## 3. ing/ed 状态工作方式

### ThinkingPanel
- **ing**: 只显示最新内容，`slice(-maxLines)`
- **ed**: marquee滚动完整历史

### ToolsPanel  
- **ing**: 最新工具，每工具占2行（名称+output）
- **ed**: 完整历史，带依赖符号（→串行 / ‖并行）

---

## 4. Ink边框计算（已修正）

### 关键发现
Ink的 `borderStyle` 在**内部**占用空间，不是外部：
- 边框占用：上下各1行 = 2行
- 内容区高度 = totalHeight - 2（边框） - 1（标题）

```typescript
const borderHeight = 2;
const titleHeight = 1;
const contentLines = totalHeight - borderHeight - titleHeight;
```

---

## 5. 新增功能

### 5.1 工作状态指示条
运行时在Input上方显示黄色状态条：
```
┌─────────────────────────────────┐
│ ⠏ Step 3: file_read             │
└─────────────────────────────────┘
```

### 5.2 错误恢复建议
工具失败时显示红色横幅+修复建议：
```
┌─────────────────────────────────┐
│ ⚠ file_read failed              │
│ 文件不存在: /path. 建议: 检查路径 │
│ 💡 使用glob搜索正确路径          │
└─────────────────────────────────┘
```

### 5.3 结果预览
文件编辑后显示diff摘要（3秒后消失）：
```
┌─────────────────────────────────┐
│ 📝 src/agent.ts (+5/-2)         │
│ + import { compressHistory }    │
│ - const oldCode = ...           │
└─────────────────────────────────┘
```

### 5.4 多任务队列
显示排队任务数量：`[Queue: 2]`

### 5.5 快捷键
- `Ctrl+H` - 显示快捷键帮助
- `Ctrl+E` - 导出会话为markdown
- `Ctrl+P` - Provider设置
- `Tab` - 命令补全
- `↑/↓` - 滚动内容/切换回合
- `G` - 跳到最新回合
- `ESC` - 中断任务

### 5.6 上下文压缩
超过20条消息自动压缩历史，生成摘要。

### 5.7 工具依赖显示
- `→` 串行执行（不同工具类型）
- `‖` 并行执行（同类型连续）

### 5.8 实时内容显示
运行时显示流式内容：
- `currentStream` - 实时AI回复
- `currentReasoning` - 实时思考内容

---

## 6. 验证清单（全部完成）

### 功能验证
- [x] 全屏显示（无终端滚动）
- [x] 左右60/40比例
- [x] Thinking上下60/40比例
- [x] Input固定底部
- [x] ing状态：最新内容
- [x] ed状态：marquee滚动
- [x] 内容不撑开边框
- [x] 单线边框样式
- [x] 工作状态指示条
- [x] 错误恢复建议
- [x] 结果预览
- [x] 多任务队列
- [x] 快捷键帮助
- [x] 会话导出
- [x] 命令补全
- [x] 上下文压缩
- [x] 工具依赖显示
- [x] 实时内容流式显示

### 测试验证
- [x] 85个测试全部通过
- [x] TypeScript编译无误
- [x] 真实终端运行验证

---

## 7. 文件清单

### 核心文件
- `src/tui/App.tsx` - 主布局
- `src/tui/components/AIOutputPanel.tsx` - Rounds区（含实时流）
- `src/tui/components/ThinkingPanel.tsx` - Thinking区
- `src/tui/components/ToolsPanel.tsx` - Tools区（含依赖分析）
- `src/tui/components/InputPanel.tsx` - Input框（含补全）
- `src/tui/components/StatusBanners.tsx` - 错误/预览横幅
- `src/tui/hooks/useAgent.ts` - 状态管理（任务完成时强制更新turns）
- `src/tui/hooks/useScroll.ts` - 滚动逻辑（运行时自动跟随）
- `src/tui/hooks/useMarquee.ts` - marquee滚动
- `src/tui/utils/associateEvents.ts` - 事件关联（处理两种tool事件方式）
- `src/tui/types.ts` - 类型定义
- `src/agent.ts` - Agent核心（含错误建议、上下文压缩）

---

## 8. 问题修复记录

### 修复的问题
1. **AIOutputPanel undefined safeOffset** → 使用 `contentOffset`
2. **Toolcalled显示(0)** → 任务完成时强制更新turns
3. **Rounds内容不全** → 显示思考摘要+工具摘要+实时流
4. **autoFollow不滚动** → 运行时设置大offset自动跟随
5. **内容截断** → 改用高度控制而非pre-truncation
6. **associateEvents工具状态** → 支持两种事件方式(tool_call/tool_result)

### 测试状态
- 所有85个测试通过
- associateEvents.test.ts 正确处理tool_result事件

---

## 更新历史

- **2026-05-12**: 完全实现所有功能，新增7项高级特性
- **2026-05-12**: 修复6个关键问题，测试全部通过