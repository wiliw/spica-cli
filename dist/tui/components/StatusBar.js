import React from 'react';
import { Box, Text } from 'ink';
export function StatusBar({ model, workflow, status, showSettingsHint }) {
    return (React.createElement(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1 },
        React.createElement(Box, { width: 15 },
            React.createElement(Text, { bold: true, color: "cyan" }, "spica")),
        workflow && (React.createElement(Box, { width: 15 },
            React.createElement(Text, { dimColor: true }, "Workflow: "),
            React.createElement(Text, { bold: true, color: "yellow" }, workflow))),
        React.createElement(Box, { width: 15 },
            React.createElement(Text, { dimColor: true }, "Model: "),
            React.createElement(Text, { color: "green" }, model)),
        React.createElement(Box, { flexGrow: 1 },
            React.createElement(Text, { dimColor: true }, status)),
        showSettingsHint && (React.createElement(Box, { width: 25 },
            React.createElement(Text, { dimColor: true }, "Nav | Enter Start | S Settings | Q Quit")))));
}
//# sourceMappingURL=StatusBar.js.map