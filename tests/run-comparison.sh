#!/bin/bash
# AGENTS.md 版本对比测试
# 测试完整版 vs 精简版的理解性能差异

set -e

PROJECT_DIR="/home/zison/development/spica/spica-cli"
RESULTS_DIR="$PROJECT_DIR/tests/results"
AGENTS_FILE="$PROJECT_DIR/AGENTS.md"
AGENTS_SIMPLE="$PROJECT_DIR/tests/AGENTS_simple.md"
AGENTS_BACKUP="$PROJECT_DIR/AGENTS_original.md"

# 测试任务 - 覆盖不同理解维度（精简版，快速测试）
TASKS=(
  "项目用什么语言？一句话回答"
  "bash 工具支持哪些模式"
  "测试命令是什么"
)

mkdir -p "$RESULTS_DIR"

echo "=== AGENTS.md 对比测试 ==="
echo "测试时间: $(date)"
echo ""

# 备份原始 AGENTS.md
cp "$AGENTS_FILE" "$AGENTS_BACKUP"

# 函数：运行测试并记录结果
run_test() {
  local version="$1"
  local results_file="$2"

  echo "[$version 版本] 开始测试..."

  for i in "${!TASKS[@]}"; do
    task="${TASKS[$i]}"
    echo "  任务 $((i+1)): $task"

    # 运行 spica 并捕获输出
    start_time=$(date +%s)
    output=$(timeout 30 spica run "$task" 2>&1 || echo "TIMEOUT/ERROR")
    end_time=$(date +%s)

    duration=$((end_time - start_time))

    # 提取统计信息
    tokens=$(echo "$output" | grep -oE '[0-9]+\.[0-9]+k/[0-9]+\.[0-9]+k' | tail -1 || echo "N/A")
    elapsed=$(echo "$output" | grep -oE '[0-9]+\.[0-9]+s' | tail -1 || echo "N/A")

    # 简化输出（取最后500字符作为回答摘要）
    answer_summary=$(echo "$output" | tail -c 500)

    echo "    耗时: ${duration}s, Token: $tokens, Elapsed: $elapsed"

    # 写入结果
    echo "{\"version\": \"$version\", \"task\": \"$task\", \"duration\": $duration, \"tokens\": \"$tokens\", \"elapsed\": \"$elapsed\"}" >> "$results_file"
  done

  echo ""
}

# 测试完整版
RESULTS_FULL="$RESULTS_DIR/full_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$RESULTS_FULL"
run_test "完整版(182行)" "$RESULTS_FULL"

# 切换到精简版
echo "切换到精简版 AGENTS.md..."
cp "$AGENTS_SIMPLE" "$AGENTS_FILE"

# 测试精简版
RESULTS_SIMPLE="$RESULTS_DIR/simple_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$RESULTS_SIMPLE"
run_test "精简版(35行)" "$RESULTS_SIMPLE"

# 恢复原始版本
cp "$AGENTS_BACKUP" "$AGENTS_FILE"
rm "$AGENTS_BACKUP"

echo "=== 测试完成 ==="
echo ""
echo "完整版结果: $RESULTS_FULL"
echo "精简版结果: $RESULTS_SIMPLE"

# 生成对比摘要
echo ""
echo "=== 对比摘要 ==="
echo "完整版:"
jq -s 'add | {total_duration: (map(.duration) | add), avg_duration: (map(.duration) | add / length)}' "$RESULTS_FULL" 2>/dev/null || cat "$RESULTS_FULL"

echo ""
echo "精简版:"
jq -s 'add | {total_duration: (map(.duration) | add), avg_duration: (map(.duration) | add / length)}' "$RESULTS_SIMPLE" 2>/dev/null || cat "$RESULTS_SIMPLE"