# spica-cli

AI coding agent with three-step workflow (MVP → Cycle → Archive).

**OpenAI-compatible：调用任何第三方模型**

---

## 快速开始

### 配置（三种方式）

**方式 1：环境变量（推荐，最安全）**

```bash
# 临时设置（不写入 ~/.bash_history）
export HISTCONTROL=ignoreboth
export OPENAI_API_KEY=your-key
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-4

./bin/spica mvp "build hello world CLI"

# 退出后清除（可选）
unset OPENAI_API_KEY
```

**安全提示：**
- ✓ 不写入 shell history（`HISTCONTROL=ignoreboth`）
- ✓ 不存储在文件中
- ✓ 仅当前 session 可见
- ⚠️ 进程列表临时可见（`ps aux`）

**方式 2：TUI 配置（session-only，不存储）**

```bash
./bin/spica
# 按 S 进入配置界面
# 输入 API Key、Base URL、Model
# ⚠️ 仅保存在内存中，退出后清除
# ⚠️ 不写入任何文件
```

**方式 3：配置文件（明文存储，不推荐）**

```bash
./bin/spica providers set custom YOUR_KEY \
  -b https://api.openai.com/v1 \
  -m gpt-4

./bin/spica mvp "build app"
```

**安全警告：**
- ⚠️ API key 明文存储在 `~/.spica/config.json`
- ⚠️ Root/备份可读
- ⚠️ 误 commit 到 git 的风险

---

## 支持的服务

所有 OpenAI-compatible API：

| 服务 | Base URL | 模型 |
|------|----------|------|
| Together AI | https://api.together.xyz/v1 | Llama, Mistral |
| Groq | https://api.groq.com/openai/v1 | Llama, Mixtral |
| 本地模型 | http://localhost:8000/v1 | llama.cpp, vLLM |
| Azure OpenAI | https://YOUR_RESOURCE.azure.com | GPT-4 |
| OpenAI | https://api.openai.com/v1 | GPT-4 |

---

## 三步走工作流

### MVP - 启动新项目

```bash
./bin/spica mvp "build file classifier CLI"

流程：
  ✓ Gather requirements
  ✓ Recommend tech stack
  ✓ Design architecture
  ✓ Implement core
  ✓ Create documents
  ✓ Demo result
```

### Cycle - 快速迭代

```bash
./bin/spica cycle "add drag-and-drop interface"

流程：
  ✓ Judge type (bug/simple/complex)
  ✓ Implement
  ✓ Test
  ✓ Update docs
  ✓ Demo
```

### Archive - 归档

```bash
./bin/spica archive v1.0

流程：
  ✓ Verify tests
  ✓ Update CHANGELOG
  ✓ Git commit + tag
  ✓ Archive documents
```

---

## 示例：完整流程

### 使用 Together AI

```bash
# 配置
export OPENAI_API_KEY=your-together-key
export OPENAI_BASE_URL=https://api.together.xyz/v1
export OPENAI_MODEL=meta-llama/Llama-3-70b-chat-hf

cd ~/development/spica/spica-cli

# Step 1: MVP
./bin/spica mvp "build hello world CLI"

# Step 2: Cycle
./bin/spica cycle "add color output"

# Step 3: Archive
./bin/spica archive v1.0
```

### 使用本地模型（完全隐私）

```bash
# 启动 llama.cpp
llama-server -m llama-3-8b.Q4_K_M.gguf --port 8000

# 配置
export OPENAI_API_KEY=dummy
export OPENAI_BASE_URL=http://localhost:8000/v1
export OPENAI_MODEL=llama-3-8b

./bin/spica mvp "build private app"
```

---

## TUI 界面

```bash
./bin/spica

启动全屏界面：
┌─────────────┬─────────────────────┐
│ Workflow    │ [Todos | Messages] │
│ ▸ MVP       │ Progress: 3/6      │
│   Cycle     │                     │
│   Archive   │                     │
└─────────────┴─────────────────────┘

↑↓ Navigate | Enter Start | S Settings | Q Quit
```

---

## CLI 命令

```bash
# 三步走
./bin/spica mvp "description"
./bin/spica cycle "request"
./bin/spica archive "version"

# 配置
./bin/spica providers set custom KEY -b URL -m MODEL
./bin/spica providers show custom
./bin/spica providers
```

---

## 核心特性

- ✅ **OpenAI-compatible** - 一个配置调用所有第三方模型
- ✅ **三步走工作流** - MVP → Cycle → Archive
- ✅ **自动执行** - Iron Laws 强制规则
- ✅ **完整能力** - file/bash/git/web/build/test
- ✅ **沉浸式 TUI** - 全屏界面，键盘操作
- ✅ **隐私优先** - 支持本地模型

---

## 文档

- [简化使用](docs/SIMPLE_USAGE.md) - OpenAI-compatible 配置
- [环境变量](docs/ENV_VARS.md) - 环境变量详细说明
- [安全说明](docs/SECURITY.md) - API key 存储安全
- [配置](docs/CONFIGURATION.md) - 详细配置指南

---

## 安装

```bash
cd ~/development/spica/spica-cli
npm install
./bin/spica --help
```

---

## License

MIT