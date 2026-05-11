import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ChatMessage } from '../llm/providers/BaseProvider';

const HISTORY_FILE = path.join(os.homedir(), '.spica', 'history.json');
const MAX_HISTORY = 50;

export function ensureHistoryDir() {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadHistory(): ChatMessage[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
  return [];
}

export function saveHistory(history: ChatMessage[]): void {
  try {
    ensureHistoryDir();
    const trimmed = history.slice(-MAX_HISTORY);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

export function clearHistory(): void {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}