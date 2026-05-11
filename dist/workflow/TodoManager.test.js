import { describe, it, expect } from 'vitest';
import { TodoManager } from './TodoManager';
describe('TodoManager', () => {
    it('should create todos with pending status', () => {
        const manager = new TodoManager();
        manager.addTodo('Task 1');
        manager.addTodo('Task 2');
        const todos = manager.getTodos();
        expect(todos).toHaveLength(2);
        expect(todos[0].content).toBe('Task 1');
        expect(todos[0].status).toBe('pending');
    });
    it('should start todo (pending -> in_progress)', () => {
        const manager = new TodoManager();
        manager.addTodo('Task 1');
        manager.startTodo(0);
        expect(manager.getTodos()[0].status).toBe('in_progress');
    });
    it('should complete todo (in_progress -> completed)', () => {
        const manager = new TodoManager();
        manager.addTodo('Task 1');
        manager.startTodo(0);
        manager.completeTodo(0);
        expect(manager.getTodos()[0].status).toBe('completed');
    });
    it('should get current todo', () => {
        const manager = new TodoManager();
        manager.addTodo('Task 1');
        manager.addTodo('Task 2');
        manager.startTodo(0);
        const current = manager.getCurrentTodo();
        expect(current?.content).toBe('Task 1');
        expect(current?.status).toBe('in_progress');
    });
    it('should get progress percentage', () => {
        const manager = new TodoManager();
        manager.addTodo('Task 1');
        manager.addTodo('Task 2');
        manager.addTodo('Task 3');
        expect(manager.getProgress()).toBe(0);
        manager.startTodo(0);
        manager.completeTodo(0);
        expect(manager.getProgress()).toBeCloseTo(33.33);
        manager.startTodo(1);
        manager.completeTodo(1);
        expect(manager.getProgress()).toBeCloseTo(66.67);
        manager.startTodo(2);
        manager.completeTodo(2);
        expect(manager.getProgress()).toBe(100);
    });
    it('should serialize and deserialize todos', () => {
        const manager = new TodoManager();
        manager.addTodo('Task 1');
        manager.addTodo('Task 2');
        manager.startTodo(0);
        manager.completeTodo(0);
        const serialized = manager.serialize();
        const newManager = TodoManager.deserialize(serialized);
        expect(newManager.getTodos()).toEqual(manager.getTodos());
    });
});
//# sourceMappingURL=TodoManager.test.js.map