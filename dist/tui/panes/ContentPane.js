import React from 'react';
import { Box, Text } from 'ink';
import { TodoPane } from './TodoPane';
import { MessagePane } from './MessagePane';
import { OutputPane } from './OutputPane';
export function ContentPane({ state }) {
    const [activeView, setActiveView] = React.useState('todos');
    if (!state.currentWorkflow) {
        return (React.createElement(Box, { flexGrow: 1, flexDirection: "column", borderStyle: "round", borderColor: "gray", padding: 1 },
            React.createElement(Box, { justifyContent: "center", alignItems: "center", flexGrow: 1 },
                React.createElement(Text, { dimColor: true }, "Select a workflow to begin"))));
    }
    const views = [
        { key: 'todos', label: 'Todos', count: state.todos.length },
        { key: 'messages', label: 'Messages', count: state.messages.length },
        { key: 'output', label: 'Output' },
    ];
    return (React.createElement(Box, { flexGrow: 1, flexDirection: "column", borderStyle: "round", borderColor: "cyan" },
        React.createElement(Box, { borderStyle: "round", borderColor: "gray" }, views.map((view) => {
            const isActive = activeView === view.key;
            return (React.createElement(Box, { key: view.key, paddingX: 2, borderStyle: isActive ? 'single' : undefined, borderColor: isActive ? 'cyan' : undefined },
                React.createElement(Text, { bold: isActive, color: isActive ? 'cyan' : 'gray' },
                    view.label,
                    view.count !== undefined && ` (${view.count})`)));
        })),
        React.createElement(Box, { flexGrow: 1, flexDirection: "column", padding: 1 },
            activeView === 'todos' && React.createElement(TodoPane, { todos: state.todos }),
            activeView === 'messages' && React.createElement(MessagePane, { messages: state.messages }),
            activeView === 'output' && React.createElement(OutputPane, { lines: state.output })),
        React.createElement(Box, { marginTop: 1, paddingLeft: 1 },
            React.createElement(Text, { dimColor: true },
                "Tab: Switch view | ",
                activeView === 'todos' && 'Todos view',
                activeView === 'messages' && 'Messages view',
                activeView === 'output' && 'Output view'))));
}
//# sourceMappingURL=ContentPane.js.map