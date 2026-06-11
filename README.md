# spica - AI coding agent CLI

```
              _)
   __|  __ \   |   __|   _` |
 \__ \  |   |  |  (     (   |
 ____/  .__/  _| \___| \__,_|
       _|
```

帮你写代码、改代码、跑命令。交互式和单任务模式都行。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/wiliw/spica-cli?style=social)](https://github.com/wiliw/spica-cli/stargazers)

[English](README.md) | [中文](README_CN.md)

安装:
```bash
git clone https://github.com/wiliw/spica-cli
cd spica-cli
npm install && npm run build && npm link
```

使用:
```bash
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica use deepseek
spica                              # 交互模式
spica run "fix the bug"            # 单次任务
```

## 特性

**33 个内置工具**：file、shell、git、web search、grep、glob 等。MCP 扩展更多。

**工具批处理**：一个 turn 内一次性批量调用工具。reads 并行读完 → writes 并行写完（同文件冲突检测）→ neutrals 收尾。结果一次性返回 LLM，减少 70% 的 round-trip。

**tiktoken 精确计数**：用 tiktoken 精确算 token，60% 阈值触发压缩。不是估算，是对着模型实际 tokenizer 算。

**上下文压缩**：双阶段。Phase 1 规则截断（即时生效，tokens 立刻降下来）→ Phase 2 后台 LLM 摘要（不阻塞主流程，摘要好了下次注入）。

**工具输出截断**：大结果截断到 8K，不做无意义的上下文消耗。

**自动缓存**：消息前缀稳定化，让 OpenAI prompt cache 能命中。

**checkpoint**：文件快照，不污染 git 历史。自动创建 + 可恢复 + 自动清理。

**Learnings 系统**：你纠正 AI 一次，写入 `.spica/learnings/`，以后每次 session 启动自动加载到 system prompt。

**会话管理**：自动恢复上次对话。`/archive` 归档+摘要。`/history` 只读浏览。`/clear` 归档而不是删除。

**14 个内置 skill**：brainstorming、TDD、debugging、code review、verification 等。AI 自己判断什么时候用。

**中断机制**：ESC ESC 随时中断。tool 结果不丢失，消息序列不损坏。

**子代理**：`task` 工具分派 3 个子代理并行工作。独立任务互不干扰。

**Windows 兼容**：PowerShell 回退、路径兼容、跨平台 bin 脚本。

**TUI**：思考动画、流式输出、compact 模式、终端 resize 处理。

## 工具

**文件**: `file_read` `file_write` `file_edit` `file_multi_edit` `file_replace` `file_insert` `file_delete` `file_copy` `file_move` `file_exists` `file_patch`

**目录与搜索**: `directory_create` `directory_list` `glob` `grep`

**Shell & Git**: `bash` `monitor` `task_stop` `git` `workspace`

**代码质量**: `code_health` `test_quality_check` `lint` `test` `format`

**Web**: `web_search` `web_fetch` `gh`

**任务**: `todo_write` `todo_read` `task` `skill` `question`

## 交互命令

| 命令 | |
|------|-----|
| `/help` | 命令列表 |
| `/archive` | 归档当前会话+摘要，开始新的 |
| `/history` | 浏览历史会话（只读） |
| `/summary` | 当前会话进度摘要 |
| `/compact` | 压缩上下文 |
| `/checkpoint` | checkpoint 管理 |
| `/skill` | skill 管理 |
| `/mcp` | MCP 管理 |
| `/status` | 会话状态 |

## 配置

```
~/.spica/settings.json    # 全局配置
<project>/.spica/         # 项目 session
```

## 开发

```bash
npm run dev      # 开发模式
npm run build    # 构建
npm test         # 测试
npm run lint     # lint
```

## 文档

- [MANUAL.md](docs/MANUAL.md)
- [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## License

MIT
