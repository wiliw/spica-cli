# spica - AI coding agent CLI

```
              _)
   __|  __ \   |   __|   _` |
 \__ \  |   |  |  (     (   |
 ____/  .__/  _| \___| \__,_|
       _|
```

一个在终端里用的 AI coding agent。帮你写代码、改代码、跑命令，交互和单次都行。很大程度上聊天记录就是开发者的资产，绝大部分时候你不会想回去翻历史 session，不然会有很大的问题——checkpoint 混乱、代码进度和聊天进度不统一。所以我认为在设计阶段就应该把这些都考虑到。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/wiliw/spica-cli?style=social)](https://github.com/wiliw/spica-cli/stargazers)

[English](README.md) | [中文](README_CN.md)

安装：
```bash
git clone https://github.com/wiliw/spica-cli
cd spica-cli
npm install && npm run build && npm link
```

用起来：
```bash
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica use deepseek
spica                              # 交互模式
spica run "fix the bug"            # 单次任务
```

## 设计上做了什么

spica 不是一个简单的 LLM wrapper，它在设计上做了很多 coding agent 应该做但绝大部分同类没做的事。

**工具批处理**：以前一个 coding agent 的典型行为是读一个文件→调用一次 LLM、再读一个→再调用一次——这期间的 context 来回发送浪费了大量 token。spica 的做法是一个 turn 内把所有需要的工具一次性全部列出来，按类型分阶段执行：reads 全部并行读完 → writes 并行写完（同文件的冲突检测顺序执行，不同文件并行）→ neutrals 收尾。所有 tool results 收集完后一次性返回给 LLM，一个 turn 最多省掉 70% 的上下文浪费。

**tiktoken 精确计数**：不是那种 "大概估算 4 char = 1 token" 的做法——那对中文、代码等根本不准确。spica 用 tiktoken 对着模型实际使用的 tokenizer 算，该多少就是多少。基于这个精确数值，60% context window 触发压缩。

**上下文压缩是两阶段的**：Phase 1 规则截断——即时生效，tokens 立刻降下来，不阻塞主流程。Phase 2 后台 LLM 摘要——把前面被截断的内容生成一个摘要，注入到后续对话里。LLM 失败也没事，Phase 1 已经保底了。它不是那种"停下来，等 LLM 把整个上下文总结完再继续"的笨方案。

**工具结果截断到 8K**：一个大 grep 输出几万行，全塞进 context 除了浪费 token 没有任何意义。截断到 8K 够了，这是经过斟酌的长度——太短丢信息，太长浪费。LLM 需要更多内容可以通过 `offset`/`limit` 再读。

**OpenAI 自动缓存**：消息前缀稳定化，让 prompt cache 能命中。很多人不知道这对成本意味着什么——cache 命中率高了之后，每个 turn 的 input token 消耗可以降一半以上。

**checkpoint 不污染 git**：不是那种每操作一次就 commit 一次让你 git log 变成一坨屎的方案。spica 的 checkpoint 是文件快照，存在 `.spica/snapshots/` 里，跟 git 完全无关。自动创建 + 可恢复 + 自动清理（只保留最近 20 个）。

**Learnings 系统**：你纠正 AI 一次，它不会忘。写入 `.spica/learnings/`，以后每次 session 启动自动加载到 system prompt。这是 coding agent 的记忆——不是 context 记忆，是经验记忆。

**会话管理**：`/clear` 不会删你的聊天记录——它归档+摘要后开新的。`/archive` 也是一样。`/history` 只读浏览。绝大部分时候你不会回去，但需要的时候它在那。

**14 个内置 skill**：brainstorming、TDD、debugging、code review、verification 什么的都有。重要的是 AI 自己判断什么时候该用什么 skill——不是硬编码的 if-else，也不是每句话都强制触发，而是 AI 看着场景自己决定。你可能需要斟酌：如果觉得某个 skill 触发得不合适，你可以直接说"不要再调用了"，AI 应该听你的。

**中断不丢数据**：ESC ESC 中断。interrupt 之后 tool results 不丢失，消息序列不损坏——不然中断完回来 LLM 报 "tool_call 后面没有 tool result" 的 API 错误，那就尴尬了。

**子代理**：task 工具可以分派 3 个子代理并行干活。独立任务互不干扰，各自有自己的工作区。

**Windows 兼容**：PowerShell 回退、路径兼容、跨平台 bin 脚本。不在 Windows 上跑的人不会注意到这些，但如果你在 Windows 上跑，它能正常工作。

**TUI**：思考动画、流式输出、compact mode（只显示工具摘要不显示大结果）、终端 resize 处理。compact mode 是个很实用的模式——大部分时候你不需要看到 grep 输出了几千行，你只需要知道它已经返回了多少结果。

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
