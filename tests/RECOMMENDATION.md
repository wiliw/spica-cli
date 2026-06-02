# AGENTS.md 最终推荐方案

## 核心发现
测试对比显示：
- 精简版（35行）节省 ~60% 文档长度
- 响应时间差异不大（都在 15-30秒范围）
- Token 消耗精简版略低（减少上下文加载）

## 推荐结构：分层式 AGENTS.md

```markdown
# AGENTS.md (~50行)

## Project
- 类型、语言、运行环境
- 核心依赖

## Commands
- dev / build / test

## Architecture
- 核心模块路径（不超过10个）
- 主数据流

## Code Style
- 关键约定（3-5条）

## Details Link
详细文档见: docs/ARCHITECTURE.md
```

## 详细文档分离
将详细内容移到单独文件：
- `docs/ARCHITECTURE.md` - 架构详情
- `docs/TOOLS.md` - 工具文档
- `docs/TESTING.md` - 测试指南
- `docs/PLATFORM.md` - 平台兼容性

## 优势
1. **Token 效率**: AGENTS.md 精简，减少每次对话的上下文加载
2. **按需查询**: AI 可用 `file_read` 按需获取详细文档
3. **维护简单**: 核心信息集中，详细信息独立维护
4. **灵活性**: 不同任务可选择加载不同详细文档

## 使用建议
- **简单任务**: 只用 AGENTS.md（50行）
- **复杂任务**: AGENTS.md + 按需读取详细文档
- **新功能开发**: AGENTS.md + ARCHITECTURE.md + TOOLS.md
- **调试**: AGENTS.md + TESTING.md