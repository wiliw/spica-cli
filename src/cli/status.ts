// 状态显示

import { LAIN_COLORS } from './ui/colors';
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
    parts.push(LAIN_COLORS.warning('processing'));
  }

  if (queueStatus.pending > 0) {
    parts.push(LAIN_COLORS.primary(`queue: ${queueStatus.pending}`));
  }

  const modeColors: Record<string, Function> = {
    plan: LAIN_COLORS.secondary,
    build: LAIN_COLORS.success,
    bypass: LAIN_COLORS.bypass,
  };
  const mode = state.getAgentMode();
  const modeColor = modeColors[mode] || LAIN_COLORS.success;
  parts.push(modeColor(mode));

  const statusLine = parts.join(' | ');
  console.log(LAIN_COLORS.muted(statusLine));
}