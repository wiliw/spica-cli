# spica-cli 当前状态

## 功能实现

**核心功能：**
- ✅ 交互模式 + 单次执行 (`spica run`)
- ✅ OpenAI API 兼容 (Function Calling + Streaming)
- ✅ 24 种工具 (文件/Shell/Git/GitHub/Web/搜索等)
- ✅ Skills 系统 (14 个 superpowers)
- ✅ MCP 协议 (外部工具服务器)
- ✅ Hooks 系统 (安全拦截)
- ✅ 会话持久化和智能压缩
- ✅ 输入队列 (处理时不阻塞)

**CLI 命令：**

```bash
spica              # 交互模式
spica run "task"   # 单次执行
spica --fresh      # 清空历史
spica -p together  # 指定 provider
spica providers    # 管理 API providers
spica skills       # 管理 skills
spica mcp          # 管理 MCP
```

## 项目结构

```
spica-cli/
├── package.json
├── README.md
├── bin/spica
├── src/
│   ├── index.ts (CLI)
│   ├── agent.ts (核心)
│   ├── llm/ (LLM 客户端)
│   ├── tools/ (工具实现)
│   ├── cli/ (CLI/UI)
│   │   ├── events.ts
│   │   ├── status.ts
│   │   ├── init.ts
│   │   └── ui/ (screenManager, colors, queue, input)
│   ├── core/ (EventBus, RuntimeState, ...)
│   ├── storage/ (checkpoint, projectState)
│   ├── mcp/ (MCP 客户端)
│   ├── skills/ (Skills 系统)
│   ├── hooks/ (Hooks 系统)
│   ├── prompts/ (系统提示)
│   └── utils/ (config, settings, session)
├── docs/
└── node_modules/
```

## 使用方式

**1. 配置：**
```bash
spica providers set openai sk-xxx...
```

**2. 交互模式：**
```bash
spica
```

**3. 单次执行：**
```bash
spica run "build file classifier"
```

## 项目状态

✅ TypeScript 编译通过
✅ 269+ 测试通过
✅ 生产可用
