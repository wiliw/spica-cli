# spica-cli

```
              _)              
   __|  __ \   |   __|   _` | 
 \__ \  |   |  |  (     (   | 
 ____/  .__/  _| \___| \__,_| 
       _|                     
```

一个在终端中使用 LLM 编程的工具。支持任意 OpenAI-compatible API。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/zison/spica-cli?style=social)](https://github.com/zison/spica-cli/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/zison/spica-cli)](https://github.com/zison/spica-cli/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/zison/spica-cli)](https://github.com/zison/spica-cli/commits)
[![Code Size](https://img.shields.io/github/languages/code-size/zison/spica-cli)](https://github.com/zison/spica-cli)

[English](README.md) | **中文**

## 安装

> **注意：** spica-cli 尚未发布到 npm，目前需要从源码安装。

从源码构建：

```bash
git clone https://github.com/zison/spica-cli
cd spica-cli
npm install
npm run build
npm link
```

这会将 `spica` 命令全局注册到 PATH 中。也可以手动将 `bin/` 目录加入 PATH。

## 使用

```bash
# 配置提供商
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat

# 切换提供商
spica use deepseek

# 启动交互模式
spica

# 执行单任务
spica run "修复 src/index.ts 中的 bug"
```

## 功能

- **33 个内置工具**：文件读写编辑、bash、grep、glob、git、web fetch 等
- **工具冲突检测**：自动处理并发文件操作
- **自动重试**：命令超时时后台重试
- **语法验证**：自动检查 TS/JS/Python/Go/Rust/Shell
- **代码质量分析**：圈复杂度、嵌套深度、函数长度
- **测试质量检查**：检测过度 mock、只测正常路径等问题
- **MCP 支持**：通过 Model Context Protocol 扩展外部工具
- **上下文压缩**：减少长对话的 token 使用

## 工具

### 文件操作
`file_read` `file_write` `file_edit` `file_multi_edit` `file_replace` `file_insert` `file_delete` `file_copy` `file_move` `file_exists` `file_patch`

### 目录与搜索
`directory_create` `directory_list` `glob` `grep`

### Shell & Git
`bash` `monitor` `task_stop` `git` `workspace`

### 代码质量
`code_health` `test_quality_check` `lint` `test` `format`

### Web
`web_search` `web_fetch` `gh`

### 任务管理
`todo_write` `todo_read` `task` `skill` `question`

## 交互命令

| 命令 | 描述 |
|---------|-------------|
| `/help` | 显示可用命令 |
| `/archive` | 归档当前并开始新会话 |
| `/history` | 浏览归档聊天（只读） |
| `/summary` | 总结当前会话 |
| `/compact` | 压缩上下文 |
| `/queue` | 显示输入队列 |
| `/checkpoint` | 管理检查点 |
| `/skill` | 管理技能 |
| `/mcp` | 管理 MCP 服务器 |
| `/status` | 显示会话状态 |
| `/init` | 生成 AGENTS.md |

## 配置

```
~/.spica/settings.json    # 全局配置
<project>/.spica/         # 项目会话
```

## 开发

```bash
npm run dev      # 开发模式
npm run build    # 构建 CLI
npm test         # 运行测试
npm run lint     # 代码检查
```

## 文档

- [MANUAL.md](docs/MANUAL.md) - 用户手册
- [CONFIGURATION.md](docs/CONFIGURATION.md) - 配置指南

## 许可证

MIT