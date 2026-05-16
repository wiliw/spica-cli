// Diff显示 - 格式化文件变更对比 (Lain配色)

import chalk from 'chalk';

// Lain配色
const DIFF_ADD = chalk.hex('#00FA9A');   // 春绿 - 新增
const DIFF_REMOVE = chalk.hex('#FF6B6B'); // 淡红 - 删除
const DIFF_CONTEXT = chalk.hex('#696969'); // 暗灰 - 上下文

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLine?: number;
  newLine?: number;
}

// 计算简单diff
export function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: DiffLine[] = [];

  // 简单的行对比（非算法级diff）
  const maxLen = Math.max(oldLines.length, newLines.length);

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldIdx >= oldLines.length) {
      // 只有新内容
      diff.push({ type: 'add', content: newLine, newLine: newIdx + 1 });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      // 只有旧内容（被删除）
      diff.push({ type: 'remove', content: oldLine, oldLine: oldIdx + 1 });
      oldIdx++;
    } else if (oldLine === newLine) {
      // 相同
      diff.push({ type: 'context', content: oldLine, oldLine: oldIdx + 1, newLine: newIdx + 1 });
      oldIdx++;
      newIdx++;
    } else {
      // 不同 - 先检查是否是新增
      const nextOldMatch = oldLines.slice(oldIdx + 1).indexOf(newLine);
      const nextNewMatch = newLines.slice(newIdx + 1).indexOf(oldLine);

      if (nextOldMatch !== -1 && (nextNewMatch === -1 || nextOldMatch <= nextNewMatch)) {
        // 旧内容有删除
        diff.push({ type: 'remove', content: oldLine, oldLine: oldIdx + 1 });
        oldIdx++;
      } else if (nextNewMatch !== -1) {
        // 新内容有新增
        diff.push({ type: 'add', content: newLine, newLine: newIdx + 1 });
        newIdx++;
      } else {
        // 替换
        diff.push({ type: 'remove', content: oldLine, oldLine: oldIdx + 1 });
        diff.push({ type: 'add', content: newLine, newLine: newIdx + 1 });
        oldIdx++;
        newIdx++;
      }
    }
  }

  return diff;
}

// 格式化diff输出（unified diff风格，带Lain配色和行号）
export function formatDiff(diff: DiffLine[], contextLines: number = 3): string {
  const output: string[] = [];

  // 找出所有变更块，每个块之间用context分隔
  let blocks: { start: number; lines: DiffLine[] }[] = [];
  let currentBlock: DiffLine[] = [];
  let blockStart = 0;

  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];

    if (line.type !== 'context') {
      // 变更行 - 开始新块或继续当前块
      if (currentBlock.length === 0) {
        // 找块开始位置（往前找contextLines个context行）
        blockStart = i;
        for (let j = Math.max(0, i - contextLines); j < i; j++) {
          if (diff[j].type === 'context') {
            blockStart = j;
            break;
          }
        }
      }
      currentBlock.push(line);
    } else if (currentBlock.length > 0) {
      // 变更后的context - 添加contextLines个作为块的结尾
      currentBlock.push(line);
      if (currentBlock.filter(l => l.type === 'context').length >= contextLines) {
        // 块结束
        blocks.push({ start: blockStart, lines: currentBlock });
        currentBlock = [];
      }
    }
  }

  // 处理最后一个块
  if (currentBlock.length > 0) {
    blocks.push({ start: blockStart, lines: currentBlock });
  }

  // 输出每个块
  for (const block of blocks) {
    // 计算行号范围
    const firstOldLine = block.lines.find(l => l.oldLine)?.oldLine || 1;
    const firstNewLine = block.lines.find(l => l.newLine)?.newLine || 1;
    const oldLines = block.lines.filter(l => l.type !== 'add').length;
    const newLines = block.lines.filter(l => l.type !== 'remove').length;

    // 输出@@头（unified diff格式）
    output.push(DIFF_CONTEXT(`@@ -${firstOldLine},${oldLines} +${firstNewLine},${newLines} @@`));

    // 输出块内行
    for (const gLine of block.lines) {
      if (gLine.type === 'add') {
        output.push(DIFF_ADD(`+${gLine.content}`));
      } else if (gLine.type === 'remove') {
        output.push(DIFF_REMOVE(`-${gLine.content}`));
      } else {
        output.push(DIFF_CONTEXT(` ${gLine.content}`));
      }
    }
  }

  return output.join('\n');
}

// 显示摘要diff（只显示变更）
export function formatDiffSummary(diff: DiffLine[]): string {
  const adds = diff.filter(d => d.type === 'add');
  const removes = diff.filter(d => d.type === 'remove');

  let summary = '';
  if (removes.length > 0) {
    summary += DIFF_REMOVE(`${removes.length} lines removed`);
  }
  if (adds.length > 0) {
    if (summary) summary += ', ';
    summary += DIFF_ADD(`${adds.length} lines added`);
  }

  return summary;
}

// 从oldString/newString生成diff（用于file_edit）
export function generateEditDiff(oldString: string, newString: string): string {
  const diff = computeDiff(oldString, newString);
  return formatDiff(diff, 2);
}