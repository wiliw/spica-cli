#!/bin/bash
# AGENTS.md 完整版 vs 推荐版对比测试

set -e

PROJECT_DIR="/home/zison/development/spica/spica-cli"
RESULTS_DIR="$PROJECT_DIR/tests/results"
AGENTS_FILE="$PROJECT_DIR/AGENTS.md"
AGENTS_RECOMMENDED="$PROJECT_DIR/tests/AGENTS_recommended.md"
AGENTS_BACKUP="$PROJECT_DIR/AGENTS_full_backup.md"

TASKS=(
  "项目用什么语言？一句话回答"
  "bash 工具支持哪些模式"
  "测试命令是什么"
)

mkdir -p "$RESULTS_DIR"

echo "=== AGENTS.md 完整版 vs 推荐版对比测试 ==="
echo "测试时间: $(date)"
echo ""

# 备份完整版
cp "$AGENTS_FILE" "$AGENTS_BACKUP"
wc -l "$AGENTS_FILE"

# 测试完整版
RESULTS_FULL="$RESULTS_DIR/recommended_full_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$RESULTS_FULL"

echo "[完整版-182行] 开始测试..."
for i in "${!TASKS[@]}"; do
  task="${TASKS[$i]}"
  echo "  任务 $((i+1)): $task"
  start_time=$(date +%s)
  output=$(timeout 30 spica run "$task" 2>&1 || echo "TIMEOUT/ERROR")
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  echo "    耗时: ${duration}s"
  echo "{\"version\": \"完整版-182行\", \"task\": \"$task\", \"duration\": $duration}" >> "$RESULTS_FULL"
done
echo ""

# 切换到推荐版
echo "切换到推荐版 AGENTS.md..."
cp "$AGENTS_RECOMMENDED" "$AGENTS_FILE"
wc -l "$AGENTS_FILE"

# 测试推荐版
RESULTS_RECOMMENDED="$RESULTS_DIR/recommended_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$RESULTS_RECOMMENDED"

echo "[推荐版-59行] 开始测试..."
for i in "${!TASKS[@]}"; do
  task="${TASKS[$i]}"
  echo "  任务 $((i+1)): $task"
  start_time=$(date +%s)
  output=$(timeout 30 spica run "$task" 2>&1 || echo "TIMEOUT/ERROR")
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  echo "    耗时: ${duration}s"
  echo "{\"version\": \"推荐版-59行\", \"task\": \"$task\", \"duration\": $duration}" >> "$RESULTS_RECOMMENDED"
done
echo ""

# 恢复完整版
cp "$AGENTS_BACKUP" "$AGENTS_FILE"
rm "$AGENTS_BACKUP"

echo "=== 测试完成 ==="
echo ""
echo "完整版结果: $RESULTS_FULL"
echo "推荐版结果: $RESULTS_RECOMMENDED"
echo ""

# 计算总耗时
full_total=$(grep -oE '"duration": [0-9]+' "$RESULTS_FULL" | grep -oE '[0-9]+' | awk '{s+=$1} END {print s}')
rec_total=$(grep -oE '"duration": [0-9]+' "$RESULTS_RECOMMENDED" | grep -oE '[0-9]+' | awk '{s+=$1} END {print s}')

echo "=== 对比摘要 ==="
echo "完整版-182行 总耗时: $full_total 秒"
echo "推荐版-59行 总耗时: $rec_total 秒"

if [ -n "$full_total" ] && [ -n "$rec_total" ] && [ "$full_total" -gt 0 ]; then
  diff=$((full_total - rec_total))
  pct=$((diff * 100 / full_total))
  if [ "$diff" -gt 0 ]; then
    echo "推荐版快 $diff 秒 ($pct%)"
  else
    echo "完整版快 $((-diff)) 秒 ($((-pct))%)"
  fi
fi