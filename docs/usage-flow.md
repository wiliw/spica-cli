# spica-cli 使用流程

## 第一次使用（TUI 配置）

```bash
# 启动 spica
spica

# 自动进入 TUI 配置界面（沉浸式）
```

**TUI 配置流程：**

```
┌──────────────────────────╮
│ Provider Setup           │
╰──────────────────────────╯

Select provider (↑↓ Enter):

  ▸ openai    https://api.openai.com/v1
    anthropic https://api.anthropic.com/v1
    together  https://api.together.xyz/v1
    groq      https://api.groq.com/openai/v1
    local     http://localhost:8000/v1
    custom    

Esc: Cancel
```

**按 Enter 选择 provider，然后输入配置：**

```
┌──────────────────────────╮
│ Configure openai         │
╰──────────────────────────╯

Provider:    openai
API Key:     sk-xxx..._         (输入)
Base URL:    https://api.openai.com/v1  (自动填充)
Model:       gpt-4               (自动填充)

Enter: Input | Esc: Back
```

**完成后：**

```
✓ Provider configured! Press Enter to continue.
```

**自动进入主 TUI 界面：**

```
┌─────────────┬──────────────────────────────────┐
│ Workflow    │ [Todos | Messages | Output]     │
│             │                                  │
│ ▸ MVP       │ Progress: 0/6 [░░░░░░░] 0%      │
│   Cycle     │ ○ Gather requirements           │
│   Archive   │ ○ Recommend tech stack          │
│             │ ○ Design architecture           │
├─────────────┴──────────────────────────────────┤
│ spica | MVP | Model: gpt-4 | ↑↓ Nav | Q Exit  │
└─────────────────────────────────────────────────┘
```

---

## 后续使用（已配置）

```bash
# 直接启动 TUI（自动检测配置）
spica

# 跳过配置，直接进入主界面
```

---

## CLI 命令（可选）

```bash
# 查看配置的 providers
spica provider list

# 手动配置 provider（备用方式）
spica provider set openai sk-xxx...
spica provider set together xxx... -m llama-3-70b

# 设置默认 provider
spica provider default openai

# 直接执行命令（不进入 TUI）
spica mvp "build file classifier"
spica cycle "add drag-drop"
spica archive v1.0
```

---

## 切换 Provider（TUI 内）

**在主 TUI 界面按 P 键（未来功能）：**

```
┌─────────────┬──────────────────────────────────┐
│ Workflow    │ [Todos | Messages | Output]     │
│             │                                  │
│ ▸ MVP       │ Press P to switch provider      │
│   Cycle     │                                  │
│   Archive   │                                  │
├─────────────┴──────────────────────────────────┤
│ spica | MVP | gpt-4 | Press P to change       │
└─────────────────────────────────────────────────┘
```

**按 P 后弹出选择：**

```
Switch Provider:

  ▸ openai (current)
    together
    groq
    local

Enter: Select | Esc: Cancel
```

---

## 快速开始

**完整流程：**

1. `spica` → 启动 TUI
2. 第一次自动进入配置界面
3. 选择 provider（↑↓）
4. 输入 API key（Enter）
5. 自动填充 Base URL 和 Model
6. Enter 确认
7. 进入主界面
8. 开始三步走工作流

**沉浸式体验：一切都在 TUI 内完成！**