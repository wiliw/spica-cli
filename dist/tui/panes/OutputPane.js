import React from 'react';
import { Box, Text } from 'ink';
export function OutputPane({ lines }) {
    const scrollRef = React.useRef(0);
    const visibleLines = 20;
    const maxScroll = Math.max(0, lines.length - visibleLines);
    const displayLines = lines.slice(scrollRef.current, scrollRef.current + visibleLines);
    return (React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
        React.createElement(Box, { marginBottom: 1 },
            React.createElement(Text, { bold: true }, "Real-time Output"),
            React.createElement(Box, { marginLeft: 2 },
                React.createElement(Text, { dimColor: true },
                    "(",
                    lines.length,
                    " lines)"))),
        React.createElement(Box, { flexGrow: 1, borderStyle: "round", borderColor: "gray", padding: 1, flexDirection: "column" }, displayLines.length === 0 ? (React.createElement(Box, { flexGrow: 1, justifyContent: "center", alignItems: "center" },
            React.createElement(Text, { dimColor: true }, "Waiting for output..."))) : (displayLines.map((line, index) => (React.createElement(Box, { key: index },
            React.createElement(Text, { dimColor: true },
                '>',
                " "),
            React.createElement(Text, null, line))))))));
}
//# sourceMappingURL=OutputPane.js.map