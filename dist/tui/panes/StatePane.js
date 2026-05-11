import React from 'react';
import { Box, Text } from 'ink';
const WORKFLOWS = [
    { key: 'mvp', label: 'MVP', desc: 'Start new project' },
    { key: 'cycle', label: 'Cycle', desc: 'Quick iteration' },
    { key: 'archive', label: 'Archive', desc: 'Finalize version' },
];
export function StatePane({ currentState, onSelect, enabled }) {
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    React.useEffect(() => {
        const handleInput = (char) => {
            if (!enabled)
                return;
            if (char === 'j' || char === 'J') {
                setSelectedIndex(prev => (prev + 1) % WORKFLOWS.length);
            }
            else if (char === 'k' || char === 'K') {
                setSelectedIndex(prev => (prev - 1 + WORKFLOWS.length) % WORKFLOWS.length);
            }
        };
        process.stdin.on('data', (data) => {
            handleInput(data.toString());
        });
        return () => {
            process.stdin.removeAllListeners('data');
        };
    }, [enabled]);
    return (React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", padding: 1, width: 20 },
        React.createElement(Box, { marginBottom: 1 },
            React.createElement(Text, { bold: true, color: "cyan" }, "Workflow")),
        WORKFLOWS.map((workflow, index) => {
            const isSelected = index === selectedIndex;
            const isActive = currentState === workflow.key;
            return (React.createElement(Box, { key: workflow.key, marginBottom: 1, flexDirection: "column" },
                React.createElement(Box, null,
                    React.createElement(Box, { width: 2 },
                        React.createElement(Text, { color: isSelected ? 'cyan' : 'gray' }, isSelected ? '▸' : ' ')),
                    React.createElement(Box, null,
                        React.createElement(Text, { bold: isSelected || isActive, color: isActive ? 'green' : isSelected ? 'cyan' : 'white' }, workflow.label)),
                    isActive && (React.createElement(Box, { marginLeft: 1 },
                        React.createElement(Text, { color: "green" }, "\u25CF")))),
                isSelected && (React.createElement(Box, { paddingLeft: 2 },
                    React.createElement(Text, { dimColor: true }, workflow.desc)))));
        }),
        React.createElement(Box, { marginTop: 1 },
            React.createElement(Text, { dimColor: true }, "Enter to start"))));
}
//# sourceMappingURL=StatePane.js.map