import React from 'react';
import { Box, Text } from 'ink';
export function TodoList({ todos }) {
    if (todos.length === 0) {
        return (React.createElement(Box, { paddingX: 1 },
            React.createElement(Text, { dimColor: true }, "No todos yet")));
    }
    return (React.createElement(Box, { flexDirection: "column", paddingX: 1 }, todos.map((todo, index) => {
        const icon = todo.status === 'completed' ? '✓' :
            todo.status === 'in_progress' ? '→' : '○';
        const color = todo.status === 'completed' ? 'green' :
            todo.status === 'in_progress' ? 'cyan' : 'gray';
        return (React.createElement(Box, { key: `${todo.content}-${index}`, marginBottom: 0 },
            React.createElement(Box, { width: 4 },
                React.createElement(Text, { color: color }, icon)),
            React.createElement(Box, { flexGrow: 1 },
                React.createElement(Text, { color: color, bold: todo.status === 'in_progress', strikethrough: todo.status === 'completed' }, todo.content))));
    })));
}
//# sourceMappingURL=TodoList.js.map