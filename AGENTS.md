# AGENTS.md - 推荐版

## Project
CLI 工具，AI 编程助手，支持多轮对话、25工具、技能系统、会话持久化

## Tech Stack
TypeScript + Node.js 18+，ESM 模块，ES2022，strict 模式

## Commands
```bash
npm run dev        # 开发模式
npm run build      # 构建
npm run test:run   # 测试（285 tests）
npx tsc --noEmit   # 类型检查
```

## Architecture
```
src/agent.ts          # 核心 Agent，管理 LLM、工具、权限
src/tools/            # 25 工具（文件、bash、git、web等）
src/skills/           # 技能系统
src/cli/ui/           # TUI 界面
src/llm/              # LLM 客户端（多 provider）
src/mcp/              # MCP 协议客户端
src/hooks/            # 工具拦截系统
```

## Tools (25)
| 类别 | 工具 |
|------|------|
| 文件 | file_read, file_write, file_edit, file_multi_edit, file_exists, file_delete, file_copy, file_move |
| 目录 | directory_create, directory_list |
| 搜索 | glob, grep |
| Shell | bash (支持 tty/detached/interactive 模式) |
| Git | git (status, diff, log, add, commit, branch, checkout, push, pull) |
| GitHub | gh (pr_view, pr_list, issue_list) |
| Web | web_search, web_fetch |
| 其他 | question, todo_write, todo_read, task, workspace, lint, test, skill |

## Code Style
- 无注释，简洁代码
- TypeScript strict
- 工具返回 `{ success, output?, error?, content? }`
- EventEmitter 事件驱动
- 权限检查（危险操作需确认）

## Key Files
- `src/index.ts` - CLI 入口
- `src/tools/index.ts` - 工具定义和执行
- `src/cli/ui/screenManager.ts` - TUI 核心

## Details
详细文档见:
- `docs/MANUAL.md` - 用户手册
- `docs/CONFIGURATION.md` - 配置指南
- `docs/ARCHITECTURE.md` - 架构详情

## Platform
Windows: 需安装 Git + VS Build Tools（node-pty）
macOS/Linux: 全功能支持