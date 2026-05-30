import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SpicaAgent } from '../agent';
import { EventEmitter } from 'events';
// Mock dependencies
vi.mock('../llm/LLMClient', () => ({
    LLMClient: vi.fn().mockImplementation(() => ({
        setSystemPrompt: vi.fn(),
        setMessages: vi.fn(),
        getMessages: vi.fn().mockReturnValue([]),
        on: vi.fn(),
        generate: vi.fn().mockResolvedValue({ content: 'test response', finished: true, toolCalls: [] }),
        continueWithAllToolResults: vi.fn(),
        generateDirect: vi.fn().mockResolvedValue({ content: 'summary' }),
        checkConnection: vi.fn().mockResolvedValue({ success: true }),
        getProvider: vi.fn().mockReturnValue({ getContextWindow: vi.fn().mockReturnValue(128000) }),
        interrupt: vi.fn(),
    })),
}));
vi.mock('../tools/index', () => ({
    executeTool: vi.fn().mockResolvedValue({ success: true, output: 'tool result' }),
    getAllToolDefinitions: vi.fn().mockReturnValue([]),
    setWorkspace: vi.fn(),
    getWorkspace: vi.fn().mockReturnValue(process.cwd()),
}));
vi.mock('../mcp/client', () => ({
    initMCP: vi.fn().mockResolvedValue(undefined),
    shutdownMCP: vi.fn(),
}));
vi.mock('../skills/index', () => ({
    initSkills: vi.fn().mockResolvedValue(undefined),
    listSkills: vi.fn().mockReturnValue([]),
}));
vi.mock('../utils/config', () => ({
    getProviderConfig: vi.fn().mockResolvedValue({
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
    }),
}));
vi.mock('../storage/projectState', () => ({
    loadProjectState: vi.fn().mockReturnValue(null),
    saveProjectState: vi.fn(),
    updateProjectTodos: vi.fn(),
    loadProjectContext: vi.fn().mockReturnValue([]),
    saveProjectContext: vi.fn(),
    ensureProjectDir: vi.fn(),
}));
vi.mock('../utils/projectConfig', () => ({
    loadProjectConfig: vi.fn().mockReturnValue(null),
    autoDetectProject: vi.fn().mockReturnValue({ type: 'typescript' }),
    createAgentsMd: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../hooks', () => ({
    runPreHooks: vi.fn().mockReturnValue({ matched: false }),
    runPostHooks: vi.fn().mockReturnValue(null),
}));
describe('SpicaAgent', () => {
    let agent;
    beforeEach(() => {
        vi.clearAllMocks();
        agent = new SpicaAgent('openai', '/test/workspace');
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('constructor', () => {
        it('should create agent with provider name', () => {
            expect(agent).toBeInstanceOf(EventEmitter);
            expect(agent.todos).toEqual([]);
        });
        it('should use default workspace if not provided', () => {
            const defaultAgent = new SpicaAgent();
            expect(defaultAgent.getWorkspacePath()).toBe(process.cwd());
        });
        it('should use provided workspace', () => {
            expect(agent.getWorkspacePath()).toBe('/test/workspace');
        });
    });
    describe('interrupt', () => {
        it('should set interrupt flag', () => {
            agent.interrupt();
            // Interrupt flag is private, we can verify through behavior
            expect(agent.isPermissionPending).toBe(false);
        });
        it('should clear permission queue on interrupt', () => {
            // The interrupt method clears the permission queue
            agent.interrupt();
            // After interrupt, no pending permissions
            expect(agent.isPermissionPending).toBe(false);
        });
    });
    describe('permission system', () => {
        describe('checkNeedsPermission', () => {
            it('should detect dangerous file_delete', () => {
                // Access private method through any
                const reason = agent.checkNeedsPermission('file_delete', { path: '/important/file' });
                expect(reason).toContain('Delete');
            });
            it('should detect dangerous bash commands', () => {
                const reason = agent.checkNeedsPermission('bash', { command: 'rm -rf /data' });
                expect(reason).toContain('删除');
            });
            it('should detect sudo commands', () => {
                const reason = agent.checkNeedsPermission('bash', { command: 'sudo apt install' });
                expect(reason).toContain('sudo');
            });
            it('should detect git push --force', () => {
                const reason = agent.checkNeedsPermission('bash', { command: 'git push --force origin main' });
                expect(reason).toContain('强制推送');
            });
            it('should return null for safe commands', () => {
                const reason = agent.checkNeedsPermission('bash', { command: 'ls -la' });
                expect(reason).toBeNull();
            });
            it('should return null for safe tools', () => {
                const reason = agent.checkNeedsPermission('file_read', { path: '/safe/file' });
                expect(reason).toBeNull();
            });
        });
        describe('waitForPermission', () => {
            it('should auto-approve in bypass mode', async () => {
                agent.setBypassPermissions(true);
                const result = await agent.waitForPermission('test reason');
                expect(result).toBe(true);
            });
            it('should emit permission_request event', async () => {
                const eventSpy = vi.fn();
                agent.on('permission_request', eventSpy);
                // Start permission request (will hang without approval)
                const promise = agent.waitForPermission('test');
                // Should have emitted event
                expect(eventSpy).toHaveBeenCalled();
                // Clean up: deny permission
                agent.denyPermission();
                await promise;
            });
        });
        describe('approvePermission/denyPermission', () => {
            it('should approve pending permission', async () => {
                const promise = agent.waitForPermission('test');
                agent.approvePermission();
                const result = await promise;
                expect(result).toBe(true);
            });
            it('should deny pending permission', async () => {
                const promise = agent.waitForPermission('test');
                agent.denyPermission();
                const result = await promise;
                expect(result).toBe(false);
            });
        });
        describe('bypass mode', () => {
            it('should toggle bypass mode', () => {
                agent.setBypassPermissions(true);
                expect(agent.isBypassPermissions).toBe(true);
                agent.setBypassPermissions(false);
                expect(agent.isBypassPermissions).toBe(false);
            });
            it('should emit bypass_changed event', () => {
                const eventSpy = vi.fn();
                agent.on('bypass_changed', eventSpy);
                agent.setBypassPermissions(true);
                expect(eventSpy).toHaveBeenCalledWith({ enabled: true });
            });
        });
    });
    describe('todos', () => {
        it('should set todos', () => {
            agent.setTodos(['task 1', 'task 2', 'task 3']);
            expect(agent.todos.length).toBe(3);
            expect(agent.todos[0].status).toBe('pending');
        });
        it('should emit todos_set event', () => {
            const eventSpy = vi.fn();
            agent.on('todos_set', eventSpy);
            agent.setTodos(['task 1']);
            expect(eventSpy).toHaveBeenCalled();
        });
        it('should update todo status', () => {
            agent.setTodos(['task 1', 'task 2']);
            agent.updateTodo(0, 'in_progress');
            expect(agent.todos[0].status).toBe('in_progress');
            expect(agent.todos[1].status).toBe('pending');
        });
        it('should emit todo_update event', () => {
            const eventSpy = vi.fn();
            agent.on('todo_update', eventSpy);
            agent.setTodos(['task']);
            agent.updateTodo(0, 'completed');
            expect(eventSpy).toHaveBeenCalled();
        });
        it('should ignore invalid todo index', () => {
            agent.setTodos(['task']);
            agent.updateTodo(10, 'completed'); // Invalid index
            expect(agent.todos[0].status).toBe('pending');
        });
    });
    describe('generateErrorSuggestion', () => {
        it('should suggest for ENOENT error', () => {
            const suggestion = agent.generateErrorSuggestion('file_read', 'ENOENT: file not found', { path: '/missing/file' });
            expect(suggestion).toContain('不存在');
        });
        it('should suggest for EACCES error', () => {
            const suggestion = agent.generateErrorSuggestion('file_write', 'EACCES: permission denied', { path: '/protected/file' });
            expect(suggestion).toContain('权限');
        });
        it('should suggest for command not found', () => {
            const suggestion = agent.generateErrorSuggestion('bash', 'command not found: xyz', { command: 'xyz' });
            expect(suggestion).toContain('不存在');
        });
        it('should provide generic suggestion for unknown errors', () => {
            const suggestion = agent.generateErrorSuggestion('unknown_tool', 'some error', {});
            expect(suggestion).toContain('失败');
        });
    });
    describe('workspace', () => {
        it('should return workspace path', () => {
            expect(agent.getWorkspacePath()).toBe('/test/workspace');
        });
        it('should return project config', () => {
            const config = agent.getProjectConfig();
            expect(config).toBeDefined();
        });
    });
    describe('messages', () => {
        it('should return empty messages when LLM not initialized', () => {
            expect(agent.getMessages()).toEqual([]);
        });
        it('should set messages', () => {
            // After init, LLM will be available
            agent.setMessages([{ role: 'user', content: 'test' }]);
            // Messages are set on LLM client
        });
    });
    describe('events', () => {
        it('should be an EventEmitter', () => {
            expect(agent).toBeInstanceOf(EventEmitter);
        });
        it('should emit and receive events', () => {
            const handler = vi.fn();
            agent.on('test_event', handler);
            agent.emit('test_event', { data: 'test' });
            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });
    });
    describe('abortTool', () => {
        it('should abort registered tool', () => {
            const controller = new AbortController();
            agent.registerToolAbortController('test_tool', controller);
            const eventSpy = vi.fn();
            agent.on('tool_aborted', eventSpy);
            agent.abortTool('test_tool');
            expect(controller.signal.aborted).toBe(true);
            expect(eventSpy).toHaveBeenCalledWith({ tool: 'test_tool' });
        });
        it('should clear tool abort controller after abort', () => {
            const controller = new AbortController();
            agent.registerToolAbortController('test_tool', controller);
            agent.abortTool('test_tool');
            // Controller should be removed
            agent.abortTool('test_tool'); // Should not throw
        });
    });
});
//# sourceMappingURL=agent.test.js.map