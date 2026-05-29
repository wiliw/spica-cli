# Spica-CLI改进计划

## 任务1：添加ESLint配置（独立任务）

**目标**：配置基础ESLint规则，提升代码质量

**文件修改**：
- 创建 `.eslintrc.json`
- 更新 `package.json` scripts
- 可选：添加prettier配置

**实施步骤**：
1. 安装ESLint依赖：`npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin`
2. 创建 `.eslintrc.json` 配置文件
3. 添加 `"lint": "eslint src/**/*.ts"` 到 package.json scripts
4. 测试：`npm run lint`

---

## 任务2：激活subagent工具白名单（独立任务）

**目标**：限制subagent的工具访问权限，防止context pollution

**文件修改**：
- `src/tools/index.ts:1295` 取消注释工具白名单

**实施步骤**：
1. 在 `src/tools/index.ts` line 1295取消注释：`taskAgent.setToolWhitelist(config.allowedTools);`
2. 确保 `setToolWhitelist` 方法在 `agent.ts` 中实现
3. 测试：运行 `src/__tests__/tools.test.ts` 验证task tool行为

---

## 任务3：改进context window管理策略（需要分析）

**目标**：添加智能预警和优先级管理

**文件修改**：
- `src/agent.ts` 添加预警机制
- `src/llm/TokenCounter.ts` 增强功能

**改进方向**：
1. **预警机制**：50%时提示，60%时警告，70%时自动压缩
2. **优先级管理**：关键决策消息保留，工具输出可压缩
3. **智能派发建议**：>60%时建议使用subagent

**实施步骤**：
1. 在 `agent.ts runLoop` 中添加多级预警
2. 扩展 `TokenCounter` 添加消息优先级分类
3. 添加派发建议机制

---

## 任务4：添加subagent status报告机制（需要扩展）

**目标**：让subagent报告执行状态（DONE/BLOCKED等）

**文件修改**：
- `src/tools/subAgent.ts` 扩展接口
- `src/tools/index.ts` task tool处理status

**实施步骤**：
1. 扩展 `SubAgentResult` 接口
2. 修改task tool返回格式解析
3. 添加status处理逻辑（BLOCKED时提示用户）

---

## 并行执行策略

使用task tool dispatch多个subagent并行处理：
- Subagent 1: ESLint配置（explore类型，只读分析后创建配置）
- Subagent 2: 白名单激活（fix类型，简单修改）
- Subagent 3: Context管理分析（explore类型，分析后提出方案）
- Subagent 4: Status机制设计（build类型，完整实现）

**预期结果**：同时完成4个改进任务，避免主session dumbzone