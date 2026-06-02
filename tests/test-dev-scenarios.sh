#!/bin/bash
# 实际开发场景对比测试
# 在 playground/test-area 进行各种开发任务

set -e

PROJECT_DIR="/home/zison/development/spica/spica-cli"
TEST_AREA="$PROJECT_DIR/playground/test-area"
RESULTS_DIR="$PROJECT_DIR/tests/results"
AGENTS_FILE="$PROJECT_DIR/AGENTS.md"
AGENTS_FULL="$PROJECT_DIR/tests/AGENTS_full.md"
AGENTS_SIMPLE="$PROJECT_DIR/tests/AGENTS_simple.md"
AGENTS_BACKUP="$PROJECT_DIR/AGENTS_dev_backup.md"

mkdir -p "$TEST_AREA"
mkdir -p "$RESULTS_DIR"

# 清空测试区域
rm -rf "$TEST_AREA"/*

echo "=== 实际开发场景对比测试 ==="
echo "测试时间: $(date)"
echo ""

# 备份当前AGENTS.md
cp "$AGENTS_FILE" "$AGENTS_BACKUP"

# 测试任务列表（实际开发场景）
declare -A TASKS
TASKS["添加工具"]="在 playground/test-area 创建一个简单的 logger.ts 工具，功能是输出日志到文件，符合项目代码风格"
TASKS["架构理解"]="解释 src/agent.ts 的主要工作流程，用中文简要说明"
TASKS["代码风格"]="在 playground/test-area 创建 utils.ts，包含一个 formatDate 函数，使用项目风格"
TASKS["Bug修复"]="playground/test-area/bug.ts 有一个bug：数组越界。修复它"
TASKS["测试编写"]="为 playground/test-area/logger.ts 写一个 vitest 测试文件"

# 函数：运行开发任务测试
run_dev_test() {
  local version="$1"
  local results_file="$2"

  echo "[$version] 开始测试..."

  # 清空测试区域
  rm -rf "$TEST_AREA"/*

  # 先创建bug文件（用于Bug修复任务）
  cat > "$TEST_AREA/bug.ts" << 'EOF'
function getFirstItem(arr: any[]) {
  return arr[0].name; // bug: 没有检查数组是否为空
}
EOF

  for task_name in "${!TASKS[@]}"; do
    task="${TASKS[$task_name]}"
    echo "  任务: $task_name"

    start_time=$(date +%s)
    output=$(timeout 90 spica run "$task" 2>&1 || echo "TIMEOUT/ERROR")
    end_time=$(date +%s)
    duration=$((end_time - start_time))

    # 检查结果质量
    quality="未知"
    if [[ "$task_name" == "添加工具" ]]; then
      if [[ -f "$TEST_AREA/logger.ts" ]]; then
        lines=$(wc -l < "$TEST_AREA/logger.ts")
        # 检查是否有注释（项目风格：无注释）
        comments=$(grep -c "//" "$TEST_AREA/logger.ts" || echo "0")
        if [[ "$comments" -eq 0 ]] && [[ "$lines" -gt 5 ]]; then
          quality="良好-符合风格"
        else
          quality="一般-有注释或代码过短"
        fi
      else
        quality="失败-未创建文件"
      fi
    elif [[ "$task_name" == "架构理解" ]]; then
      # 检查回答长度（应该有实质内容）
      answer_len=$(echo "$output" | wc -c)
      if [[ "$answer_len" -gt 500 ]]; then
        quality="良好-有详细回答"
      else
        quality="一般-回答过短"
      fi
    elif [[ "$task_name" == "代码风格" ]]; then
      if [[ -f "$TEST_AREA/utils.ts" ]]; then
        comments=$(grep -c "//" "$TEST_AREA/utils.ts" || echo "0")
        if [[ "$comments" -eq 0 ]]; then
          quality="良好-符合风格"
        else
          quality="一般-有注释"
        fi
      else
        quality="失败-未创建文件"
      fi
    elif [[ "$task_name" == "Bug修复" ]]; then
      if [[ -f "$TEST_AREA/bug.ts" ]]; then
        # 检查是否添加了空数组检查
        if grep -q "length" "$TEST_AREA/bug.ts" || grep -q "empty" "$TEST_AREA/bug.ts" || grep -q "!arr" "$TEST_AREA/bug.ts"; then
          quality="良好-已修复"
        else
          quality="失败-未修复"
        fi
      else
        quality="失败-文件丢失"
      fi
    elif [[ "$task_name" == "测试编写" ]]; then
      if [[ -f "$TEST_AREA/logger.test.ts" ]]; then
        quality="良好-已创建测试"
      else
        quality="失败-未创建测试"
      fi
    fi

    echo "    耗时: ${duration}s, 质量: $quality"
    echo "{\"version\": \"$version\", \"task\": \"$task_name\", \"duration\": $duration, \"quality\": \"$quality\"}" >> "$results_file"

    # 清空测试区域（除了bug.ts）
    rm -rf "$TEST_AREA"/*
  done

  echo ""
}

# 测试完整版
cp "$AGENTS_FULL" "$AGENTS_FILE"
RESULTS_FULL="$RESULTS_DIR/dev_full_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$RESULTS_FULL"
run_dev_test "完整版-161行" "$RESULTS_FULL"

# 测试精简版
cp "$AGENTS_SIMPLE" "$AGENTS_FILE"
RESULTS_SIMPLE="$RESULTS_DIR/dev_simple_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$RESULTS_SIMPLE"
run_dev_test "精简版-35行" "$RESULTS_SIMPLE"

# 恢复备份
cp "$AGENTS_BACKUP" "$AGENTS_FILE"
rm "$AGENTS_BACKUP"

echo "=== 测试完成 ==="
echo ""
echo "完整版结果: $RESULTS_FULL"
echo "精简版结果: $RESULTS_SIMPLE"

# 分析结果
echo ""
echo "=== 开发能力对比 ==="
echo "完整版:"
cat "$RESULTS_FULL" | grep -o '"quality": "[^"]*"' | sort | uniq -c
echo ""
echo "精简版:"
cat "$RESULTS_SIMPLE" | grep -o '"quality": "[^"]*"' | sort | uniq -c