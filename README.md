# spica-cli

AI coding agent with full-screen TUI. 简洁高效的编程助手。

**OpenAI-compatible：调用任何第三方模型**

---

## 快速开始

```bash
# 安装
npm install
npm link

# 配置环境变量（推荐）
export OPENAI_API_KEY=your-key
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-4

# 启动TUI
spica

# CLI模式
spica run "列出当前目录的文件"
```

---

## TUI 界面

```
┌──────────────────────┬──────────────────────────────────────┐
│ Rounds 1/3 [AUTO]    │ Thinking                             │
│ == FOCUS: Round 1 == │ 现在让我分析项目结构...               │
│ Q: 列出文件          │                                      │
│ A: 文件列表如下      │                                      │
│                      ├──────────────────────────────────────┤
│                      │ Toolcalled (5)                       │
│                      │ [OK] bash: ls -la                    │
│                      │ → [OK] file_read: README.md          │
│                      │ ‖ [OK] file_read: package.json       │
├──────────────────────┴──────────────────────────────────────┤
│ ⠏ Step 3: file_read                                          │  ← 工作状态
├─────────────────────────────────────────────────────────────┤
│ Input (quit to exit)                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 新特性

### 1. 工作状态指示条
运行时显示当前步骤和工具：
```
│ ⠏ Step 3: file_read [Queue: 2]                               │
```

### 2. 错误恢复建议
工具失败时自动显示修复建议：
```
┌─────────────────────────────────┐
│ ⚠ file_read failed              │
│ 文件不存在: /path               │
│ 💡 使用glob搜索正确路径          │
└─────────────────────────────────┘
```

### 3. Diff预览
文件编辑后显示摘要（3秒消失）：
```
┌─────────────────────────────────┐
│ 📝 src/agent.ts (+5/-2)         │
│ + import { compressHistory }    │
│ - const oldCode = ...           │
└─────────────────────────────────┘
```

### 4. 工具依赖分析
显示工具执行关系：
- `→` 串行执行（不同工具类型）
- `‖` 并行执行（同类型连续）

### 5. 多任务队列
输入框显示排队任务数，支持连续提交。

### 6. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+H` | 显示快捷键帮助 |
| `Ctrl+E` | 导出会话为markdown |
| `Ctrl+P` | Provider设置 |
| `Tab` | 命令补全 |
| `↑/↓` | 滚动内容/切换回合 |
| `G` | 跳到最新回合 |
| `ESC` | 中断任务 |

### 7. 上下文压缩
超过20条消息自动压缩，生成历史摘要。

### 8. Tab命令补全
补全常用命令：read, write, edit, bash, glob, grep等。

---

## 支持的服务

所有 OpenAI-compatible API：

| 服务 | Base URL | 模型 |
|------|----------|------|
| Together AI | https://api.together.xyz/v1 | Llama, Mistral |
| Groq | https://api.groq.com/openai/v1 | Llama, Mixtral |
| 本地模型 | http://localhost:8000/v1 | llama.cpp, vLLM |
| OpenAI | https://api.openai.com/v1 | GPT-4 |

---

## 核心特性

- ✅ **全屏TUI** - 60/40黄金分割布局
- ✅ **工作进度显示** - Step + tool_name + spinner
- ✅ **错误恢复** - 自动建议修复方案
- ✅ **结果预览** - 文件编辑diff摘要
- ✅ **多任务队列** - 连续提交自动排队
- ✅ **上下文压缩** - 长对话自动优化
- ✅ **命令补全** - Tab补全常用命令
- ✅ **会话导出** - 导出为markdown
- ✅ **26种工具** - file/bash/git/web/glob/grep/todo/task
- ✅ **隐私优先** - 支持本地模型

---

## 文档

- [TUI需求文档](docs/TUI-REQUIREMENTS.md) - 需求和实现状态
- [TUI架构](docs/tui-architecture.md) - 技术架构详解
- [环境变量](docs/ENV_VARS.md) - 环境变量配置
- [安全说明](docs/SECURITY.md) - API key安全

---

## License

MIT