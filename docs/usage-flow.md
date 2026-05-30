# spica-cli 使用流程

## 第一次使用

```bash
# 配置 provider
spica providers set openai sk-xxx...

# 启动交互模式
spica
```

**交互模式功能：**

- 输入任务描述，AI 自动执行
- 支持多轮对话
- Tab 自动补全指令
- `/bypass` 自动批准模式
- `/strict` 权限请求模式
- `/status` 查看当前状态
- `/history` 查看历史消息
- `/compact` 压缩上下文

---

## 后续使用

```bash
# 直接启动（自动加载历史）
spica

# 清空历史启动
spica --fresh

# 使用其他 provider
spica -p together
```

---

## CLI 命令

```bash
# 单次执行
spica run "build file classifier"

# 指定 provider
spica run "build app" -p together

# 管理 providers
spica providers                  # 列出所有
spica providers set openai sk-xxx...  # 设置
spica providers default openai   # 设置默认

# 管理 skills
spica skills                     # 列出 skills

# 管理 MCP
spica mcp                        # 查看 MCP 状态
```

---

## 快速开始

**完整流程：**

1. `spica providers set openai sk-xxx...` → 配置 API
2. `spica` → 启动交互模式
3. 输入任务 → AI 自动执行
4. 继续对话 → 多轮交互
5. `quit` → 退出（自动保存历史）
