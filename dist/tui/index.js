import React from 'react';
import { render } from 'ink';
import { App } from './App';
export async function runTUI() {
    if (!process.stdin.isTTY) {
        console.log('\nTUI mode requires a TTY terminal.\nUse CLI commands instead:\n');
        console.log('  spica mvp <description>    - Start MVP workflow');
        console.log('  spica cycle <request>      - Quick iteration cycle');
        console.log('  spica archive [version]    - Archive and finalize');
        console.log('  spica providers            - Manage providers\n');
        return;
    }
    try {
        if (!process.stdin.isRaw) {
            process.stdin.setRawMode(true);
        }
    }
    catch (error) {
        console.log('\nRaw mode not supported in this environment.\nUse CLI commands instead:\n');
        console.log('  spica mvp <description>    - Start MVP workflow');
        console.log('  spica cycle <request>      - Quick iteration cycle');
        console.log('  spica archive [version]    - Archive and finalize');
        console.log('  spica providers            - Manage providers\n');
        return;
    }
    render(React.createElement(App, null), {
        exitOnCtrlC: false,
    });
    return new Promise((resolve) => {
        process.on('SIGINT', () => {
            resolve();
        });
    });
}
//# sourceMappingURL=index.js.map