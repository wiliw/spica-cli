import React from 'react';
import { Box, Text } from 'ink';
import { StatePane } from './panes/StatePane';
import { ContentPane } from './panes/ContentPane';
import { StatusBar } from './components/StatusBar';
import { useAgent } from './hooks/useAgent';
import { useKeyboardInput } from './hooks/useInput';
import { getProviderConfig } from '../utils/config';
import { ProviderSetupTUI } from './ProviderSetupTUI';
import { WelcomeScreen } from './screens/WelcomeScreen';
export function App() {
    const { state, startWorkflow } = useAgent();
    const [selectedWorkflow, setSelectedWorkflow] = React.useState(0);
    const [isExiting, setIsExiting] = React.useState(false);
    const [model, setModel] = React.useState('gpt-4');
    const [showSetup, setShowSetup] = React.useState(false);
    const [isConfigured, setIsConfigured] = React.useState(false);
    const [showWelcome, setShowWelcome] = React.useState(true);
    const [rawModeSupported, setRawModeSupported] = React.useState(true);
    const workflows = ['mvp', 'cycle', 'archive'];
    const [sessionConfig, setSessionConfig] = React.useState(null);
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
        getProviderConfig().then(config => {
            setModel(config.model || 'gpt-4');
            setIsConfigured(true);
            setShowWelcome(false);
        }).catch(() => {
            setIsConfigured(false);
            setShowWelcome(true);
        });
    }, []);
    useKeyboardInput({
        onUp: () => {
            if (!state.isRunning && !showSetup && rawModeSupported) {
                setSelectedWorkflow(prev => prev > 0 ? prev - 1 : workflows.length - 1);
            }
        },
        onDown: () => {
            if (!state.isRunning && !showSetup && rawModeSupported) {
                setSelectedWorkflow(prev => prev < workflows.length - 1 ? prev + 1 : 0);
            }
        },
        onEnter: async () => {
            if (!state.isRunning && !state.currentWorkflow && !showSetup && rawModeSupported) {
                const workflow = workflows[selectedWorkflow];
                if (workflow === 'mvp') {
                    await startWorkflow('mvp', 'test project');
                }
                else if (workflow === 'cycle') {
                    await startWorkflow('cycle', 'test feature');
                }
                else if (workflow === 'archive') {
                    await startWorkflow('archive', 'v1.0');
                }
            }
        },
        onQuit: () => {
            if (showSetup) {
                setShowSetup(false);
            }
            else {
                setIsExiting(true);
            }
        },
        onChar: (char) => {
            if ((char === 's' || char === 'c') && rawModeSupported) {
                setShowSetup(true);
            }
            if (char === 'h' && showWelcome) {
                setShowWelcome(false);
            }
        },
        enabled: !isExiting && rawModeSupported,
    });
    if (showWelcome && !isConfigured) {
        return (React.createElement(Box, { flexDirection: "column" },
            React.createElement(WelcomeScreen, null),
            React.createElement(Box, { marginTop: 1, justifyContent: "center" },
                React.createElement(Text, { dimColor: true }, "Press S to configure | Press H to skip")),
            !rawModeSupported && (React.createElement(Box, { marginTop: 1, justifyContent: "center" },
                React.createElement(Text, { color: "yellow" }, "Note: Raw mode not supported in this environment")))));
    }
    if (showSetup) {
        return (React.createElement(Box, { flexDirection: "column" },
            React.createElement(ProviderSetupTUI, { sessionOnly: true, onComplete: async (config) => {
                    setShowSetup(false);
                    if (config) {
                        setSessionConfig(config);
                        setModel(config.model || 'gpt-4');
                        setIsConfigured(true);
                        setShowWelcome(false);
                    }
                    else {
                        try {
                            const providerConfig = await getProviderConfig();
                            setModel(providerConfig.model || 'gpt-4');
                            setIsConfigured(true);
                            setShowWelcome(false);
                        }
                        catch (e) {
                            setShowWelcome(true);
                        }
                    }
                } })));
    }
    if (isExiting) {
        return (React.createElement(Box, { flexDirection: "column", justifyContent: "center", alignItems: "center", flexGrow: 1 },
            React.createElement(Box, { borderStyle: "double", borderColor: "cyan", padding: 2 },
                React.createElement(Text, { color: "cyan", bold: true }, "Goodbye! Thanks for using spica"))));
    }
    const workflowStatus = state.isRunning ? 'Running...' :
        state.currentWorkflow ? 'Active' : 'Ready';
    const workflowLabel = state.currentWorkflow ?
        state.currentWorkflow.toUpperCase() : undefined;
    return (React.createElement(Box, { flexDirection: "column", minHeight: process.stdout.rows || 24 },
        React.createElement(Box, { borderStyle: "double", borderColor: "cyan", paddingX: 2 },
            React.createElement(Text, { bold: true, color: "cyan" }, "spica - AI Coding Agent"),
            React.createElement(Box, { flexGrow: 1 }),
            React.createElement(Text, { dimColor: true }, "Three-Step Workflow: MVP - Cycle - Archive")),
        React.createElement(Box, { flexGrow: 1, flexDirection: "row", marginTop: 1 },
            React.createElement(Box, { width: 20, borderStyle: "single", borderColor: "gray" },
                React.createElement(StatePane, { currentState: state.currentWorkflow, onSelect: (wf) => {
                        const index = workflows.indexOf(wf);
                        setSelectedWorkflow(index);
                    }, enabled: !state.isRunning && rawModeSupported })),
            React.createElement(Box, { flexGrow: 1, marginLeft: 1, borderStyle: "single", borderColor: "gray" },
                React.createElement(ContentPane, { state: state }))),
        React.createElement(Box, { marginTop: 1 },
            React.createElement(StatusBar, { model: model, workflow: workflowLabel, status: workflowStatus, showSettingsHint: true })),
        state.error && (React.createElement(Box, { marginTop: 1, borderStyle: "round", borderColor: "red", padding: 1 },
            React.createElement(Text, { color: "red", bold: true }, "Error: "),
            React.createElement(Text, { color: "red" }, state.error))),
        React.createElement(Box, { justifyContent: "center", marginTop: 1 },
            React.createElement(Text, { dimColor: true }, rawModeSupported ? 'j/k Navigate | Enter Start | S Settings | Q Quit' : 'Configuration mode: use CLI commands'))));
}
//# sourceMappingURL=App.js.map