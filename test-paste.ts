// 测试粘贴序列检测
import * as readline from 'readline';

const ESC = '\x1b';

// 启用 Bracketed Paste Mode
process.stdout.write(`${ESC}[?2004h`);

let pasteBuffer = '';
let isInPaste = false;

process.stdin.on('data', (chunk: Buffer) => {
  const str = chunk.toString('utf8');
  
  // 显示收到的原始数据（用于调试）
  const debugStr = str
    .replace(/\x1b/g, '<ESC>')
    .replace(/\n/g, '<NL>')
    .replace(/\r/g, '<CR>');
  console.log(`[RAW]: "${debugStr}"`);
  
  // 检测粘贴开始
  if (str.includes(`${ESC}[200~`)) {
    console.log('[PASTE START]');
    isInPaste = true;
    pasteBuffer = '';
  }
  
  // 检测粘贴结束
  if (str.includes(`${ESC}[201~`)) {
    console.log('[PASTE END]');
    console.log(`[PASTE CONTENT]: "${pasteBuffer}"`);
    isInPaste = false;
    pasteBuffer = '';
    return;
  }
  
  // 累积粘贴内容
  if (isInPaste) {
    pasteBuffer += str;
  }
});

process.stdin.setRawMode(true);
console.log('Paste test mode. Press Ctrl+C to exit.');
