# 架构审视报告

**日期**: 2026-05-16
**版本**: 当前稳定版本 (5b882c5+)

## 测试验证 (2026-05-16)

### ESC 中断功能测试
```
=== Testing ESC Interrupt Functionality ===

Test 1: RateLimiter interruptible sleep
waitForAvailability completed in 503ms
✅ SUCCESS: Interrupt worked! Wait was cut short.

Test 2: LLMClient interrupt during rate limit wait
Generate completed in 507ms
✅ SUCCESS: Interrupt worked during rate limit wait!
```

### Skills 功能测试
```
=== Skills Test ===
Loaded skills: [ 'test' ]
Parsed /test zison: { skillName: 'test', args: { name: 'zison' } }
Built prompt: Just say hello to zison
Prompt without template: input: test input
=== All Tests Passed ===
```

### 单元测试
```
Test Files  6 passed (6)
Tests       64 passed (64)
Duration    1.89s
```

### 类型检查
```
npx tsc --noEmit: 无错误
```

### 今日修复问题
1. **ESC中断不工作** - 根因: RateLimiter阻塞等待AbortController创建
   - 修复: AbortController在rate limiter之前创建, rate limiter增加interruptibleSleep
2. **Skills TypeError** - 根因: promptTemplate undefined
   - 修复: parseTemplateArgs和buildSkillPrompt增加null检查
3. **Permission 'y'残留** - readline与prompts raw mode冲突
   - 修复: pause/resume + setRawMode切换
4. **quit不工作** - 检查位置错误
   - 修复: 移到handleInput顶部
5. **Ctrl+C无法退出** - interruptPending阻止重复SIGINT
   - 修复: 3次连续SIGINT强制退出
6. **重复bypass消息** - index.ts和events.ts都打印
   - 修复: 只在events.ts打印

### 新增功能 (2026-05-16)

**`/init` 命令** (`src/cli/init.ts`)
- 分析代码库结构、检测项目类型
- 自动生成 AGENTS.md 文件
- 包含: 构建命令、测试命令、架构概述、模块列表、设计模式
- 选项: `--force` 强制覆盖, `--verbose` 详细输出

**动态 Skills 管理**
- `/skill-add <name> <template>` - 添加新 skill
- `/skill-remove <name>` - 删除 skill
- `/skill-edit <name> <template>` - 编辑 skill
- 实现: `saveSkill()`, `deleteSkill()` 函数 (src/skills/index.ts)

### Bug修复 (2026-05-16 续)

1. **输入指令重复输出** - 粘贴处理使用 `rl.emit('line')` 导致 readline 也处理原始数据
   - 修复: 使用 pasteHandler 回调直接调用 handleInput，不经过 readline emit

2. **权限请求后输入残留** - prompts 处理后 stdin 缓冲区有残留数据
   - 修复: 恢复时使用 `rl.write(null, { ctrl: true, name: 'u' })` 清空输入行

3. **压缩频繁触发** - 阈值 40 条消息容易快速达到
   - 修复: 提高阈值到 60 条（约 12-15 轮对话）

## 当前架构问题

### 1. 职责混乱

`src/index.ts` (1151行, 15%代码量) 承担至少6种职责：
- CLI入口
- 全局状态管理 (currentAgent, globalProviderConfig, globalIsProcessing, globalBypassMode...)
- 交互循环 (300+行)
- 命令处理 (8个命令处理器: run, set, use, list, skills, mcp...)
- 事件监听 (setupAgentEvents 80+行)
- 状态显示

违反单一职责原则。

### 2. Agent过重

`SpicaAgent` 承担核心业务逻辑+事件总线双重职责：
- LLM管理
- 工具执行
- 权限管理 (permissionQueue, bypassPermissions)
- Checkpoint
- 事件中心 (15+种事件: stream, tool_call, permission_request...)
- 项目配置
- Todo管理
- 上下文压缩

### 3. 模块边界模糊

`utils/` 目录成为"杂物间"：
- `colors.ts` - UI渲染，应该在ui层
- `checkpoint.ts` - Git操作，应该在tools层
- `errorRecovery.ts` - 错误处理，应该在core层
- `stableInput.ts`, `inputQueue.ts`, `fixedInputBox.ts` - 输入处理，应该在ui层
- `projectState.ts` - 状态管理，应该在core层或storage层
- `config.ts` 与 `settings.ts` - 配置管理重复

### 4. 缺少分层

当前架构扁平：
```
index.ts → agent.ts → tools/ → llm/ → utils/
```

应有分层架构：
```
Presentation (CLI/UI)
    ↓
Business (Agent/Tools)
    ↓
Infrastructure (LLM/MCP/Storage)
```

### 5. 状态管理混乱

全局变量散落在 `index.ts`：
```typescript
let currentAgent: SpicaAgent | null = null;
let globalProviderConfig: any = null;
let globalIsProcessing = false;
let globalBypassMode = false;
let connectionErrorShown = false;
let isStreamingOutput = false;
```

没有统一的状态管理层。

### 6. 事件系统耦合

Agent直接emit事件，UI直接监听：
```typescript
// agent.ts
this.emit('stream', { chunk });
this.emit('tool_call', { name, arguments });
this.emit('permission_request', { reason });

// index.ts
agent.on('stream', (data) => { ... });
agent.on('tool_call', (data) => { ... });
```

缺少独立的事件总线，Agent与UI强耦合。

## 改进方案

### 分层架构

**重构进展 (2026-05-16)**

Phase 1 进行中，已完成：
- ✅ 创建 `cli/ui/` 目录，移动UI相关文件
- ✅ 创建 `storage/` 目录，移动存储相关文件
- ✅ 创建 `core/RuntimeState.ts` - 统一状态管理
- ✅ 创建 `cli/events.ts` - Agent事件监听
- ✅ 创建 `cli/status.ts` - 状态显示
- ✅ 更新所有import路径
- ✅ 替换全局变量使用RuntimeState
- ✅ index.ts从1151行减少到953行

当前结构：
```
src/
├── cli/              # Presentation层 ✓
│   ├── events.ts     ✓ Agent事件监听 (175行)
│   ├── status.ts     ✓ 状态显示 (31行)
│   └── ui/           ✓ UI组件
│       ├── colors.ts      ✓ (212行)
│       ├── input.ts       ✓ stableInput (279行)
│       ├── queue.ts       ✓ inputQueue (124行)
│       ├── stringWidth.ts ✓ (148行)
│       ├── diff.ts        ✓ (146行)
│       └── fixedBox.ts    ✓ (195行)
│
├── core/             # Business层 ✓
│   ├── RuntimeState.ts    ✓ 运行时状态 (110行)
│   ├── errorRecovery.ts   ✓ 移动
│   └── ... (原有)
│
├── storage/          # 持久化层 ✓
│   ├── checkpoint.ts      ✓ 移动 (339行)
│   ├── projectState.ts    ✓ 移动 (117行)
│
├── index.ts (953行 - 待继续拆分)
```

待完成：
- [ ] 拆分交互循环到 `cli/interactive.ts`
- [ ] 移动命令处理器到 `cli/commands/`
- [ ] Agent拆分（事件总线独立）
- [ ] 合并config.ts和settings.ts

---

### 目标架构

```
src/
├── cli/              # Presentation层
│   ├── index.ts      # CLI入口 (只做命令注册)
│   ├── interactive.ts # 交互循环
│   ├── commands/     # 命令处理器
│   │   ├── run.ts
│   │   ├── set, use, list.ts
│   │   ├── skills.ts
│   │   └── mcp.ts
│   └── ui/           # UI组件 ✓
│       ├── status.ts ✓
│       ├── colors.ts ✓
│       └── input.ts  ✓
│
├── core/             # Business层
│   ├── Agent.ts      # 简化: 只负责运行循环
│   ├── EventBus.ts   # 独立事件总线
│   ├── RuntimeState.ts # 统一状态管理 ✓
│   ├── PermissionManager.ts # 权限独立
│   ├── ContextManager.ts  # 上下文独立
│   └── ErrorHandler.ts
│
├── tools/            # 工具层
│   ├── index.ts
│   ├── file.ts
│   ├── bash.ts
│   ├── git.ts        (checkpoint移入)
│   └── subAgent.ts
│
├── llm/              # Infrastructure层
│   ├── LLMClient.ts
│   ├── set, use, list/
│   └── TokenCounter.ts
│
├── storage/          # 持久化层 ✓
│   ├── config.ts     (settings合并)
│   ├── session.ts
│   ├── projectState.ts ✓
│   └── checkpoint.ts   ✓
│   ├── projectState.ts
│   └── checkpoint.ts
│
├── external/         # 外部协议
│   ├── mcp/
│   └── hooks/
│
└── prompts/          # Prompt管理
    └── system.ts
```

### 关键改进

1. **Agent瘦身**: 只做运行循环，事件总线独立出来
2. **index.ts瘦身**: 只做CLI入口，交互循环分离
3. **utils重组**: 按职责分配到各层
4. **状态统一**: StateManager管理所有运行时状态
5. **命令分离**: 每个命令独立文件
6. **事件解耦**: EventBus作为中介，Agent发布，UI订阅

### 重构步骤

1. **Phase 1: 拆分index.ts** (优先级最高)
   - 创建 `cli/` 目录
   - 移动交互循环到 `interactive.ts`
   - 移动命令处理器到 `commands/`
   - 移动UI组件到 `ui/`

2. **Phase 2: 拆分Agent**
   - 创建 `EventBus.ts` 独立事件系统
   - 创建 `PermissionManager.ts` 管理权限
   - 创建 `ContextManager.ts` 管理上下文压缩

3. **Phase 3: 重组utils**
   - UI相关移到 `cli/ui/`
   - Git相关移到 `tools/`
   - 状态相关移到 `storage/`
   - 错误处理移到 `core/`

4. **Phase 4: 统一状态管理**
   - 创建 `StateManager.ts` 替代全局变量
   - 所有状态通过StateManager访问

### 工作量评估

| Phase | 预估时间 | 优先级 |
|-------|---------|--------|
| Phase 1: 拆分index.ts | 2-3小时 | 高 |
| Phase 2: 拆分Agent | 1-2小时 | 中 |
| Phase 3: 重组utils | 1小时 | 中 |
| Phase 4: 状态管理 | 1-2小时 | 低 |
| **总计** | **5-8小时** | |

### 注意事项

1. **渐进重构**: 每次只改一个模块，确保功能正常
2. **测试覆盖**: 重构前确保现有测试通过
3. **向后兼容**: CLI命令接口不变
4. **文档更新**: CLAUDE.md同步更新

## 后续优化方向

1. **插件化工具**: 工具可动态加载
2. **配置验证**: 启动时验证配置完整性
3. **日志系统**: 结构化日志，支持调试
4. **性能监控**: 关键操作耗时统计
5. **错误恢复**: 更完善的错误恢复机制