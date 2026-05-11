import React from 'react';
import { Box, Text, Newline } from 'ink';
export function WelcomeScreen() {
    return (React.createElement(Box, { flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 2 },
        React.createElement(Box, { borderStyle: "double", borderColor: "cyan", padding: 2 },
            React.createElement(Box, { flexDirection: "column", alignItems: "center" },
                React.createElement(Text, { bold: true, color: "cyan" }, "spica"),
                React.createElement(Newline, null),
                React.createElement(Text, { dimColor: true }, "AI coding agent with three-step workflow"),
                React.createElement(Newline, null),
                React.createElement(Text, { color: "green" }, "MVP \u2192 Cycle \u2192 Archive"))),
        React.createElement(Newline, null),
        React.createElement(Box, { borderStyle: "round", borderColor: "yellow", padding: 1 },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { bold: true }, "Quick Start:"),
                React.createElement(Newline, null),
                React.createElement(Text, null, "  \u2191\u2193  Navigate workflows"),
                React.createElement(Text, null, "  Enter  Start selected workflow"),
                React.createElement(Text, null, "  S/C   Open settings"),
                React.createElement(Text, null, "  Q     Quit"),
                React.createElement(Newline, null),
                React.createElement(Text, { dimColor: true }, "First time? Press S to configure your AI provider")))));
}
//# sourceMappingURL=WelcomeScreen.js.map