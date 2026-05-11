import React from 'react';
import { Box, Text } from 'ink';
export function MessageList({ messages }) {
    if (messages.length === 0) {
        return (React.createElement(Box, { paddingX: 1 },
            React.createElement(Text, { dimColor: true }, "No messages yet")));
    }
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1 }, messages.map((msg, index) => {
        const roleColor = msg.role === 'user' ? 'cyan' :
            msg.role === 'assistant' ? 'green' : 'gray';
        const roleLabel = msg.role === 'user' ? 'You' :
            msg.role === 'assistant' ? 'AI' : 'System';
        return (React.createElement(Box, { key: `${msg.role}-${index}-${msg.timestamp.getTime()}`, flexDirection: "column", marginBottom: 1 },
            React.createElement(Box, null,
                React.createElement(Box, { width: 10 },
                    React.createElement(Text, { color: roleColor, bold: true },
                        roleLabel,
                        ":")),
                React.createElement(Box, { flexGrow: 1 },
                    React.createElement(Text, { dimColor: true }, msg.timestamp.toLocaleTimeString()))),
            React.createElement(Box, { paddingLeft: 2 },
                React.createElement(Text, null, msg.content.split('\n').map((line, i) => (React.createElement(React.Fragment, { key: `${index}-line-${i}` },
                    i > 0 && '\n',
                    line)))))));
    })));
}
//# sourceMappingURL=MessageList.js.map