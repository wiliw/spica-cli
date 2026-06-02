#!/bin/bash
# 分析测试结果并更新报告

RESULTS_DIR="/home/zison/development/spica/spica-cli/tests/results"
REPORT_FILE="/home/zison/development/spica/spica-cli/tests/COMPARISON_REPORT.md"

# 找到最新的结果文件
FULL_RESULT=$(ls -t "$RESULTS_DIR"/full_*.json 2>/dev/null | head -1)
SIMPLE_RESULT=$(ls -t "$RESULTS_DIR"/simple_*.json 2>/dev/null | head -1)

if [ -z "$FULL_RESULT" ] || [ -z "$SIMPLE_RESULT" ]; then
  echo "未找到测试结果文件"
  exit 1
fi

echo "分析结果:"
echo "完整版: $FULL_RESULT"
echo "精简版: $SIMPLE_RESULT"

# 解析JSON结果（简化处理，因为jq可能不可用）
echo ""
echo "=== 数据提取 ==="

# 提取完整版数据
echo "完整版结果:"
cat "$FULL_RESULT"

echo ""
echo "精简版结果:"
cat "$SIMPLE_RESULT"

# 计算总耗时
full_total=$(grep -oE '"duration": [0-9]+' "$FULL_RESULT" | grep -oE '[0-9]+' | awk '{s+=$1} END {print s}')
simple_total=$(grep -oE '"duration": [0-9]+' "$SIMPLE_RESULT" | grep -oE '[0-9]+' | awk '{s+=$1} END {print s}')

echo ""
echo "=== 汇总 ==="
echo "完整版总耗时: $full_total 秒"
echo "精简版总耗时: $simple_total 秒"

if [ -n "$full_total" ] && [ -n "$simple_total" ]; then
  diff=$((full_total - simple_total))
  pct=$((diff * 100 / full_total))
  echo "差异: $diff 秒 ($pct%)"
fi