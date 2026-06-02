#!/bin/bash
# 理解性能自动化测试脚本
# 测试不同 AGENTS.md 版本对 AI 理解性能的影响

set -e

# 配置
PROJECT_DIR="/home/zison/development/spica/spica-cli"
RESULTS_DIR="$PROJECT_DIR/tests/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$RESULTS_DIR/test_$TIMESTAMP.json"

# 测试任务列表
TASKS=(
  "这个项目的核心架构是什么？"
  "agent.ts 的主要职责是什么？"
  "bash 工具有哪些模式？"
  "如何启动开发模式？如何运行测试？"
  "找出所有与 skills 相关的文件"
  "file_edit 和 file_multi_edit 有什么区别？"
  "git 工具支持哪些操作？"
  "项目的代码风格是什么？"
)

# 创建结果目录
mkdir -p "$RESULTS_DIR"

echo "=== 理解性能测试 ==="
echo "时间: $TIMESTAMP"
echo "结果文件: $RESULT_FILE"
echo ""

# 初始化 JSON 结果
echo '{"tests": []}' > "$RESULT_FILE"

# 执行测试
for i in "${!TASKS[@]}"; do
  task="${TASKS[$i]}"
  echo "[$((i+1))/${#TASKS[@]}] 任务: $task"

  # 记录开始时间
  start_time=$(date +%s%N)

  # 执行任务（记录输出）
  output=$(timeout 60 spica run "$task" 2>&1 || echo "TIMEOUT/ERROR")

  # 记录结束时间
  end_time=$(date +%s%N)

  # 计算耗时（毫秒）
  duration_ms=$(( (end_time - start_time) / 1000000 ))

  # 提取 token 使用量（从输出中）
  tokens=$(echo "$output" | grep -oP '\d+\.\d+k/\d+\.0k ctx' | tail -1 || echo "N/A")
  elapsed=$(echo "$output" | grep -oP '\d+\.\d+s' | tail -1 || echo "N/A")

  # 显示结果
  echo "  耗时: $duration_ms ms"
  echo "  Token: $tokens"
  echo "  Elapsed: $elapsed"
  echo ""

  # 保存结果到 JSON
  jq --arg task "$task" \
     --arg duration "$duration_ms" \
     --arg tokens "$tokens" \
     --arg elapsed "$elapsed" \
     --arg output "$output" \
     '.tests += [{task: $task, duration_ms: $duration, tokens: $tokens, elapsed: $elapsed}]' \
     "$RESULT_FILE" > tmp.json && mv tmp.json "$RESULT_FILE"
done

echo "=== 测试完成 ==="
echo "结果保存在: $RESULT_FILE"

# 生成摘要
echo ""
echo "=== 测试摘要 ==="
total_duration=$(jq '[.tests[].duration_ms | tonumber] | add' "$RESULT_FILE")
avg_duration=$(jq '[.tests[].duration_ms | tonumber] | add / length' "$RESULT_FILE")

echo "总耗时: $total_duration ms"
echo "平均耗时: $avg_duration ms"
echo ""
echo "详细结果请查看: $RESULT_FILE"