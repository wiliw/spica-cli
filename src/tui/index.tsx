import React from 'react';
import { render } from 'ink';
import { App } from './App';

export async function runTUI(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.log('\nTUI mode requires a TTY terminal.\nUse CLI commands instead:\n');
    console.log('  spica run "your request"  - Execute coding task');
    console.log('  spica providers            - Manage providers\n');
    return;
  }
  
  try {
    if (!process.stdin.isRaw) {
      process.stdin.setRawMode(true);
    }
  } catch (error) {
    console.log('\nRaw mode not supported in this environment.\nUse CLI commands instead:\n');
    console.log('  spica run "your request"  - Execute coding task');
    console.log('  spica providers            - Manage providers\n');
    return;
  }
  
  render(<App />, {
    exitOnCtrlC: false,
  });
  
  return new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      resolve();
    });
  });
}