export class TodoManager {
    todos = [];
    addTodo(content) {
        this.todos.push({ content, status: 'pending' });
    }
    getTodos() {
        return [...this.todos];
    }
    startTodo(index) {
        if (index >= 0 && index < this.todos.length) {
            this.todos[index].status = 'in_progress';
        }
    }
    completeTodo(index) {
        if (index >= 0 && index < this.todos.length) {
            this.todos[index].status = 'completed';
        }
    }
    getCurrentTodo() {
        return this.todos.find(t => t.status === 'in_progress') || null;
    }
    clear() {
        this.todos = [];
    }
    updateTodoStatus(content, status) {
        const todo = this.todos.find(t => t.content === content);
        if (todo) {
            todo.status = status;
        }
    }
    getProgress() {
        if (this.todos.length === 0)
            return 0;
        const completed = this.todos.filter(t => t.status === 'completed').length;
        return (completed / this.todos.length) * 100;
    }
    serialize() {
        return JSON.stringify(this.todos);
    }
    static deserialize(data) {
        const manager = new TodoManager();
        manager.todos = JSON.parse(data);
        return manager;
    }
}
//# sourceMappingURL=TodoManager.js.map