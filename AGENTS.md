# AGENTS.md - 精简版

## Project
CLI 工具，AI 编程助手，支持多轮对话、25 工具、技能系统

## Tech Stack
TypeScript + Node.js 18+
ESM 模块，ES2022，strict 模式

## Commands
```bash
npm run dev        # 开发模式
npm run build      # 构建
npm run test:run   # 测试（285 tests）
```

## Architecture
- `src/agent.ts`: 核心 Agent，管理 LLM、工具、权限
- `src/tools/`: 25 工具（文件、bash、git、web 等）
- `src/skills/`: 技能系统
- `src/cli/ui/`: TUI 界面

## Code Style
- 无注释，简洁代码
- TypeScript strict
- 工具返回 `{ success, output?, error? }`

## Key Patterns
- EventEmitter 事件驱动
- 权限检查（危险操作需确认）
- 上下文压缩（>60% 时触发）

## Platform
Windows: 需安装 Git + VS Build Tools（node-pty）
macOS/Linux: 全功能支持