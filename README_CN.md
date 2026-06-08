# spica-cli

```
              _)              
   __|  __ \   |   __|   _` | 
 \__ \  |   |  |  (     (   | 
 ____/  .__/  _| \___| \__,_| 
       _|                     
```

一个基于 OpenAI API 的命令行编程助手，支持并行工具执行、自动重试和代码质量分析。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/zison/spica-cli?style=social)](https://github.com/zison/spica-cli/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/zison/spica-cli)](https://github.com/zison/spica-cli/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/zison/spica-cli)](https://github.com/zison/spica-cli/commits)
[![Code Size](https://img.shields.io/github/languages/code-size/zison/spica-cli)](https://github.com/zison/spica-cli)

[English](README.md) | **中文**

---

## 主要功能

- **工具冲突检测**：多个工具操作同一资源时自动顺序执行
- **自动重试**：命令超时时后台重试
- **语法检查**：保存 TS/JS/Python 文件时自动验证语法
- **代码质量分析**：基于 McCabe 复杂度等指标
- **MCP 支持**：可扩展外部工具
- **上下文压缩**：智能压缩对话历史节省 token

---

## 快速开始

```bash
# 安装
npm install

# 构建
npm run build

# 配置提供商
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica use deepseek

# 运行
spica              # 交互模式
spica run "任务"   # 单任务模式
```

---

## 主要特性

### 🔧 智能工具编排
- **冲突自动检测**：检测文件/资源冲突，按正确顺序执行（并行 vs 顺序）
- **自动重试机制**：Bash/Test 命令超时时自动在分离模式重试
- **中断恢复**：优雅的中断处理，状态保存

### 📊 代码质量分析
基于 Martin Fowler 的"AI 编码可维护性传感器"和学术研究：

| 工具 | 目的 | 阈值 |
|------|---------|------------|
| `code_health` | 检测复杂度、嵌套、长度问题 | 评分 ≥ 9.5 |
| `test_quality_check` | 检测测试反模式 | 评分 ≥ 7.0 |

### 🛡️ 安全特性
- **语法自动检查**：TS/JS/Python/Go/Rust/Shell 语法验证
- **Shell 注入检测**：阻止危险命令模式
- **权限模式**：严格/绕过模式

---

## 命令

| 命令 | 描述 |
|---------|-------------|
| `spica` | 启动交互 TUI 模式 |
| `spica run <请求>` | 执行单任务 |
| `spica set <名称> <URL> <密钥> <模型>` | 添加 LLM 提供商 |
| `spica use <名称>` | 切换活跃提供商 |
| `spica list` | 列出所有提供商 |

---

## 开发

```bash
npm run dev      # 开发模式
npm run build    # 构建 CLI
npm test         # 运行测试
npm run lint     # 运行检查
```

---

## 文档

- [MANUAL.md](docs/MANUAL.md) - 完整用户手册
- [CONFIGURATION.md](docs/CONFIGURATION.md) - 配置指南

---

## 许可证

MIT