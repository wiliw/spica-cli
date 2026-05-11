import React from 'react';
import { Box, Text } from 'ink';
import { TodoList } from '../components/TodoList';
export function TodoPane({ todos }) {
    const completed = todos.filter(t => t.status === 'completed').length;
    const total = todos.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
        React.createElement(Box, { marginBottom: 1 },
            React.createElement(Text, { bold: true }, "Progress: "),
            React.createElement(Text, { color: "cyan" },
                completed,
                "/",
                total),
            React.createElement(Box, { marginLeft: 2 },
                React.createElement(Text, { color: "green" }, '█'.repeat(Math.floor(progress / 10))),
                React.createElement(Text, { dimColor: true }, '░'.repeat(10 - Math.floor(progress / 10)))),
            React.createElement(Box, { marginLeft: 1 },
                React.createElement(Text, { bold: true, color: "yellow" },
                    progress,
                    "%"))),
        React.createElement(Box, { flexGrow: 1, borderStyle: "round", borderColor: "gray" },
            React.createElement(TodoList, { todos: todos }))));
}
//# sourceMappingURL=TodoPane.js.map