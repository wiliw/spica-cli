# ✅ spica-cli 测试指南

## 测试步骤

### 1. 配置 Provider

```bash
cd ~/development/spica/spica-cli

# 设置 provider
spica providers set openai YOUR_REAL_API_KEY

# 查看
spica providers
spica providers show openai
```

### 2. 启动交互模式

```bash
# 启动交互模式
spica

# 或非交互模式
spica --no-tui
```

### 3. 测试 CLI 命令

```bash
# 单次执行
spica run "build hello world go CLI" -p openai

# 查看帮助
spica --help

# 清空历史启动
spica --fresh
```

---

## 运行自动化测试

```bash
# 运行所有测试
npm run test:run

# 运行特定测试
npx vitest run tools
npx vitest run agent

# 类型检查
npx tsc --noEmit

# ESLint
npm run lint
```

---

## 验证结果

```bash
# Provider 配置验证
spica providers
# 输出：
# Configured Providers:
#   openai (default) ✓

# CLI 命令验证
spica --help
# 显示所有命令 ✓

# 交互模式验证
spica
# 显示交互式界面 ✓
```

---

## 项目状态

✅ TypeScript 编译通过
✅ 交互模式正常
✅ CLI 命令可用
✅ Provider 配置可用
✅ OpenAI API 兼容架构完成
✅ 269+ 测试通过

**需要真实 API key 才能测试完整 AI agent 功能。**
