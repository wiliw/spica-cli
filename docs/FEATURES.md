# Spica CLI 功能清单

## 一、工具系统（28个内置工具）

### 文件操作（11个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `file_read` | 读取文件 | path, offset, limit |
| `file_write` | 写入文件，自动语法检查 | path, content |
| `file_edit` | 单处编辑 | path, oldString, newString |
| `file_multi_edit` | 多处编辑 | path, edits[] |
| `file_replace` | 正则替换 | path, pattern, replacement |
| `file_insert` | 插入行 | path, line, content |
| `file_exists` | 检查存在 | path |
| `file_delete` | 删除文件/目录 | path |
| `file_copy` | 复制 | source, destination |
| `file_move` | 移动/重命名 | source, destination |
| `file_patch` | 应用补丁 | path, patch |

### 目录操作（2个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `directory_create` | 创建目录（支持嵌套） | path |
| `directory_list` | 列出目录 | path |

### 搜索操作（2个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `glob` | 文件模式匹配 | pattern, ignore, maxFiles |
| `grep` | 内容搜索 | pattern, path, include |

### Shell 操作（3个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `bash` | 执行命令 | command, timeout, detached |
| `git` | Git 操作 | action, args |
| `workspace` | 工作区管理 | path |

### Web 操作（3个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `web_search` | 网络搜索 | query, engine |
| `web_fetch` | 获取网页 | url, timeout |
| `gh` | GitHub CLI | action, args |

### 任务管理（4个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `todo_write` | 写入任务列表 | todos[] |
| `todo_read` | 读取任务列表 | - |
| `task` | 并行子agent（最多3个） | tasks[] |
| `skill` | 调用技能 | name |

### 代码质量（3个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `lint` | 代码检查 | fix, files |
| `test` | 运行测试 | filter, coverage |
| `format` | 格式化代码 | path |

### 其他（1个）
| 工具 | 功能 | 关键参数 |
|------|------|---------|
| `question` | 询问用户 | text |

---

## 二、CLI 命令（7个）

| 命令 | 功能 | 示例 |
|------|------|------|
| `spica` | 启动交互式会话 | `spica` |
| `spica run <request>` | 单次执行任务 | `spica run "fix bug"` |
| `spica set <name> <url> <apiKey> <model>` | 配置 provider | `spica set openai https://api.openai.com/v1 sk-xxx gpt-4` |
| `spica use <name>` | 切换 provider | `spica use openai` |
| `spica list` | 列出所有 providers | `spica list` |
| `spica show [name]` | 显示 provider 详情 | `spica show openai` |
| `spica remove [names...]` | 删除 provider | `spica remove openai` |

---

## 三、TUI 内部命令（16个）

| 命令 | 功能 |
|------|------|
| `/help`, `/h` | 显示帮助 |
| `/status` | 显示状态 |
| `/queue`, `/q` | 管理输入队列 |
| `/undo` | 撤回最后输入 |
| `/clear`, `/reset` | 清屏/重置 |
| `/checkpoint` | 文件快照管理 |
| `/skill` | 技能管理 |
| `/mcp` | MCP 服务器管理 |
| `/history` | 查看历史 |
| `/compact` | 厵缩历史 |
| `/init` | 初始化 AGENTS.md |
| `/new` | 新建会话 |
| `/sessions`, `/s` | 会话管理 |
| `/switch` | 切换会话 |
| `/rename` | 重命名会话 |
| `/delete` | 删除会话 |

---

## 四、Skills 系统（14个内置技能）

| Skill | 功能 |
|------|------|
| `brainstorming` | 生成创意方案 |
| `systematic-debugging` | 系统化调试 |
| `test-driven-development` | 测试驱动开发 |
| `writing-plans` | 编写计划 |
| `executing-plans` | 执行计划 |
| `verification-before-completion` | 完成前验证 |
| `dispatching-parallel-agents` | 并行子agent |
| `subagent-driven-development` | 子agent开发 |
| `requesting-code-review` | 请求代码审查 |
| `receiving-code-review` | 接收代码审查 |
| `using-git-worktrees` | Git worktree |
| `finishing-a-development-branch` | 完成开发分支 |
| `writing-skills` | 编写自定义技能 |
| `using-superpowers` | 技能系统指南 |

---

## 五、Hooks 系统

拦截工具调用，支持：
- **PreToolUse**: 工具执行前拦截
- **PostToolUse**: 工具执行后处理
- **动作**: none（允许）、warn（警告）、confirm（确认）、block（阻止）

---

## 六、MCP 系统

连接外部工具服务器：
- **Stdio 模式**: 通过命令启动进程
- **SSE 模式**: HTTP 连接
- 动态获取工具定义

---

## 七、存储系统

| 模块 | 功能 |
|------|------|
| `checkpointManager` | 文件快照（不污染 git） |
| `projectState` | 项目状态（todos、decisions） |
| `taskPersistence` | 任务持久化 |

---

## 八、特殊功能

| 功能 | 说明 |
|------|------|
| **输入队列** | 非阻塞输入、撤回、合并 |
| **自动压缩** | 上下文超过 70% 自动压缩 |
| **Checkpoint** | 自动创建备份点 |
| **ESC ESC 中断** | 随时中断任务 |
| **Ctrl+O 模式切换** | Verbose/Compact 显示 |
| **Tab 补全** | 命令和文件补全 |