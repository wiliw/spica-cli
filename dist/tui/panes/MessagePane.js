import React from 'react';
import { Box, Text } from 'ink';
import { MessageList } from '../components/MessageList';
export function MessagePane({ messages }) {
    return (React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
        React.createElement(Box, { marginBottom: 1 },
            React.createElement(Text, { bold: true }, "Conversation History")),
        React.createElement(Box, { flexGrow: 1, borderStyle: "round", borderColor: "gray" },
            React.createElement(MessageList, { messages: messages }))));
}
//# sourceMappingURL=MessagePane.js.map