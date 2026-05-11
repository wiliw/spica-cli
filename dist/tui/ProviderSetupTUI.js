import React from 'react';
import { render, Box, Text, useInput } from 'ink';
export function ProviderSetupTUI({ onComplete, sessionOnly = false }) {
    const [step, setStep] = React.useState(0);
    const [provider, setProvider] = React.useState('');
    const [apiKey, setApiKey] = React.useState('');
    const [baseUrl, setBaseUrl] = React.useState('');
    const [model, setModel] = React.useState('');
    const [editing, setEditing] = React.useState(false);
    const [inputBuffer, setInputBuffer] = React.useState('');
    const [rawModeSupported, setRawModeSupported] = React.useState(true);
    const providers = ['openai', 'custom'];
    const builtinBaseUrls = {
        openai: 'https://api.openai.com/v1',
        custom: '',
    };
    const defaultModels = {
        openai: 'gpt-4',
        custom: 'gpt-4',
    };
    React.useEffect(() => {
        if (process.stdin.isTTY) {
            try {
                if (!process.stdin.isRaw) {
                    process.stdin.setRawMode(true);
                    process.stdin.setRawMode(false);
                }
                setRawModeSupported(true);
            }
            catch (error) {
                setRawModeSupported(false);
            }
        }
        else {
            setRawModeSupported(false);
        }
        if (providers[0] && !provider) {
            setProvider(providers[0]);
        }
    }, []);
    useInput((input, key) => {
        if (!rawModeSupported)
            return;
        if (editing) {
            if (key.return) {
                handleInputSubmit();
                setEditing(false);
                setInputBuffer('');
            }
            else if (key.escape) {
                setEditing(false);
                setInputBuffer('');
            }
            else if (key.backspace || key.delete) {
                setInputBuffer(prev => prev.slice(0, -1));
            }
            else {
                setInputBuffer(prev => prev + input);
            }
        }
        else {
            if ((key.upArrow || input === 'k') && step === 0) {
                setProvider(prev => {
                    const idx = providers.indexOf(prev);
                    return providers[Math.max(0, idx - 1)];
                });
            }
            else if ((key.downArrow || input === 'j') && step === 0) {
                setProvider(prev => {
                    const idx = providers.indexOf(prev);
                    return providers[Math.min(providers.length - 1, idx + 1)];
                });
            }
            else if (key.return) {
                if (step === 0 && provider) {
                    setBaseUrl(builtinBaseUrls[provider]);
                    setModel(defaultModels[provider]);
                    setStep(1);
                }
                else if (step < 3) {
                    setEditing(true);
                }
                else if (step === 4) {
                    saveConfig();
                }
                else {
                    onComplete();
                }
            }
            else if (key.escape) {
                if (step > 0)
                    setStep(step - 1);
            }
        }
    });
    const handleInputSubmit = () => {
        if (step === 1) {
            setApiKey(inputBuffer);
            setStep(2);
        }
        else if (step === 2) {
            setBaseUrl(inputBuffer || builtinBaseUrls[provider]);
            setStep(3);
        }
        else if (step === 3) {
            setModel(inputBuffer || defaultModels[provider]);
            setStep(4);
        }
    };
    const saveConfig = async () => {
        if (sessionOnly) {
            onComplete({
                provider,
                apiKey,
                baseUrl,
                model,
            });
        }
        else {
            const { setProviderConfig } = await import('../utils/config');
            try {
                await setProviderConfig(provider, apiKey, baseUrl, model);
                onComplete();
            }
            catch (error) {
                console.error('Failed to save config:', error);
            }
        }
    };
    if (!rawModeSupported) {
        return (React.createElement(Box, { flexDirection: "column", padding: 1 },
            React.createElement(Box, { borderStyle: "round", borderColor: "cyan" },
                React.createElement(Text, { bold: true, color: "cyan" }, "Provider Setup (Command Line)")),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, null, "Raw mode not supported. Use CLI instead:")),
            React.createElement(Box, { marginTop: 1, flexDirection: "column" },
                React.createElement(Text, null, "spica providers set openai YOUR_API_KEY"),
                React.createElement(Text, null, "spica providers default openai")),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, "Press any key to exit setup"))));
    }
    if (step === 0) {
        return (React.createElement(Box, { flexDirection: "column", padding: 1 },
            React.createElement(Box, { borderStyle: "round", borderColor: "cyan" },
                React.createElement(Text, { bold: true, color: "cyan" }, "Provider Setup")),
            sessionOnly && (React.createElement(Box, { marginTop: 1, borderStyle: "round", borderColor: "yellow", padding: 1 },
                React.createElement(Box, { flexDirection: "column" },
                    React.createElement(Text, { color: "yellow", bold: true }, "\u26A0\uFE0F Session-Only Mode"),
                    React.createElement(Text, { dimColor: true }, "API key will NOT be saved to file"),
                    React.createElement(Text, { dimColor: true }, "Only available in current session")))),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, null, "Select provider (k/\u2191 or j/\u2193):")),
            React.createElement(Box, { marginTop: 1, flexDirection: "column" }, providers.map(p => (React.createElement(Box, { key: p },
                React.createElement(Box, { width: 2 },
                    React.createElement(Text, { color: provider === p ? 'cyan' : 'gray' }, provider === p ? '>' : ' ')),
                React.createElement(Text, { bold: provider === p }, p),
                React.createElement(Box, { width: 4 }),
                React.createElement(Text, { dimColor: true }, builtinBaseUrls[p]))))),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, "k/\u2191: Up | j/\u2193: Down | Enter: Select | Esc: Cancel"))));
    }
    return (React.createElement(Box, { flexDirection: "column", padding: 1 },
        React.createElement(Box, { borderStyle: "round", borderColor: "cyan" },
            React.createElement(Text, { bold: true, color: "cyan" },
                "Configure ",
                provider)),
        React.createElement(Box, { marginTop: 1, flexDirection: "column" },
            React.createElement(Box, { marginBottom: 1 },
                React.createElement(Box, { width: 12 },
                    React.createElement(Text, null, "Provider:")),
                React.createElement(Text, { color: "green" }, provider)),
            React.createElement(Box, { marginBottom: 1 },
                React.createElement(Box, { width: 12 },
                    React.createElement(Text, { bold: step === 1 }, "API Key:")),
                step === 1 && editing ? (React.createElement(Text, { color: "yellow" },
                    inputBuffer,
                    "_")) : (React.createElement(Text, { color: apiKey ? 'green' : 'red' }, apiKey || '(press Enter to input)'))),
            React.createElement(Box, { marginBottom: 1 },
                React.createElement(Box, { width: 12 },
                    React.createElement(Text, { bold: step === 2 }, "Base URL:")),
                step === 2 && editing ? (React.createElement(Text, { color: "yellow" },
                    inputBuffer,
                    "_")) : (React.createElement(Text, { color: baseUrl ? 'green' : 'red' }, baseUrl || '(press Enter to input)'))),
            React.createElement(Box, { marginBottom: 1 },
                React.createElement(Box, { width: 12 },
                    React.createElement(Text, { bold: step === 3 }, "Model:")),
                step === 3 && editing ? (React.createElement(Text, { color: "yellow" },
                    inputBuffer,
                    "_")) : (React.createElement(Text, { color: model ? 'green' : 'red' }, model || '(press Enter to input)')))),
        step < 4 && (React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Enter: Input | Esc: Back"))),
        step === 4 && (React.createElement(Box, { marginTop: 1, flexDirection: "column" },
            React.createElement(Box, { borderStyle: "round", borderColor: "green", padding: 1 },
                React.createElement(Text, { bold: true, color: "green" }, "\u2713 Provider configured!")),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, sessionOnly
                    ? 'API key in memory only (not saved to file)'
                    : 'API key saved to ~/.spica/config.json')),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { bold: true, color: "cyan" }, "Press Enter to continue"))))));
}
export async function runProviderSetupTUI() {
    return new Promise((resolve) => {
        const { unmount } = render(React.createElement(ProviderSetupTUI, { onComplete: () => {
                unmount();
                resolve();
            } }));
    });
}
//# sourceMappingURL=ProviderSetupTUI.js.map