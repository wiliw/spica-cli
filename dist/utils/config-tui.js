import React from 'react';
import { render, Box, Text, useInput } from 'ink';
export function ConfigTUI({ config, onSave, onExit }) {
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const [editing, setEditing] = React.useState(false);
    const [inputValue, setInputValue] = React.useState('');
    const items = [
        { key: 'openai.apiKey', label: 'API Key', value: config.openai?.apiKey },
        { key: 'openai.model', label: 'Model', value: config.openai?.model || 'gpt-4' },
        { key: 'openai.baseUrl', label: 'Base URL', value: config.openai?.baseUrl },
    ];
    useInput((input, key) => {
        if (editing) {
            if (key.return) {
                onSave(items[selectedIndex].key, inputValue);
                setEditing(false);
                setInputValue('');
            }
            else if (key.escape) {
                setEditing(false);
                setInputValue('');
            }
            else if (key.backspace || key.delete) {
                setInputValue(prev => prev.slice(0, -1));
            }
            else {
                setInputValue(prev => prev + input);
            }
        }
        else {
            if (key.upArrow) {
                setSelectedIndex(prev => Math.max(0, prev - 1));
            }
            else if (key.downArrow) {
                setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
            }
            else if (key.return || input === 'e') {
                setInputValue(items[selectedIndex].value || '');
                setEditing(true);
            }
            else if (key.escape || input === 'q') {
                onExit();
            }
        }
    });
    return (React.createElement(Box, { flexDirection: "column", padding: 1 },
        React.createElement(Box, { borderStyle: "round", borderColor: "cyan" },
            React.createElement(Text, { bold: true, color: "cyan" }, "spica config")),
        React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "\u2191\u2193 Navigate | Enter/E Edit | Esc/Q Exit")),
        React.createElement(Box, { marginTop: 1, flexDirection: "column" }, items.map((item, index) => (React.createElement(Box, { key: `config-${index}`, marginBottom: 1 },
            React.createElement(Box, { width: 2 },
                React.createElement(Text, { color: index === selectedIndex ? 'cyan' : 'gray' }, index === selectedIndex ? '▸' : ' ')),
            React.createElement(Box, { width: 12 },
                React.createElement(Text, { bold: index === selectedIndex },
                    item.label,
                    ":")),
            React.createElement(Box, { flexGrow: 1 }, editing && index === selectedIndex ? (React.createElement(Text, { color: "yellow" },
                inputValue,
                "_")) : (React.createElement(Text, { color: item.value ? 'green' : 'red' }, item.value || '(not set)'))))))),
        editing && (React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Enter to save | Esc to cancel")))));
}
export async function runConfigTUI() {
    const { loadConfig, setConfigValue } = await import('./config');
    const config = await loadConfig();
    return new Promise((resolve) => {
        const { unmount } = render(React.createElement(ConfigTUI, { config: config, onSave: async (key, value) => {
                await setConfigValue(key, value);
            }, onExit: () => {
                unmount();
                resolve();
            } }));
    });
}
//# sourceMappingURL=config-tui.js.map