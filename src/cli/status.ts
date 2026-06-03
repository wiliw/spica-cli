// 状态显示

import { COLORS } from './ui/colors';
import { getInputQueue } from './ui/queue';
import { getRuntimeState } from '../core/RuntimeState';

export function displayStatusLine(): void {
  const state = getRuntimeState();
  const queue = getInputQueue();
  const queueStatus = queue.getStatus();

  const parts: string[] = [];

  if (state.model) {
    parts.push(state.model);
  }

  if (state.isProcessing()) {
    parts.push(COLORS.warning('processing'));
  }

  if (queueStatus.pending > 0) {
    parts.push(COLORS.primary(`queue: ${queueStatus.pending}`));
  }

  const statusLine = parts.join(' | ');
  console.log(COLORS.muted(statusLine));
}