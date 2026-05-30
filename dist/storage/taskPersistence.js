// Task persistence - save and restore task progress across sessions
import fs from 'fs-extra';
import { join } from 'path';
const TASKS_FILE = '.spica/tasks.json';
// Load persisted tasks
export function loadPersistedTasks(workspacePath) {
    try {
        const tasksPath = join(workspacePath, TASKS_FILE);
        if (fs.existsSync(tasksPath)) {
            const state = fs.readJsonSync(tasksPath);
            return state.tasks.filter(t => t.status !== 'deleted');
        }
    }
    catch (error) {
        // Failed to load - return empty
    }
    return [];
}
// Save tasks to file
export function savePersistedTasks(workspacePath, tasks) {
    try {
        const spicaDir = join(workspacePath, '.spica');
        fs.ensureDirSync(spicaDir);
        const state = {
            tasks: tasks.filter(t => t.status !== 'deleted'),
            lastUpdated: new Date().toISOString(),
        };
        fs.writeJsonSync(join(spicaDir, 'tasks.json'), state, { spaces: 2 });
    }
    catch (error) {
        // Failed to save - non-critical
    }
}
// Add or update a task
export function updatePersistedTask(workspacePath, task) {
    const tasks = loadPersistedTasks(workspacePath);
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    task.updatedAt = new Date().toISOString();
    if (existingIndex >= 0) {
        tasks[existingIndex] = { ...tasks[existingIndex], ...task };
    }
    else {
        task.createdAt = task.createdAt || new Date().toISOString();
        tasks.push(task);
    }
    savePersistedTasks(workspacePath, tasks);
}
// Delete a task
export function deletePersistedTask(workspacePath, taskId) {
    const tasks = loadPersistedTasks(workspacePath);
    const filtered = tasks.filter(t => t.id !== taskId);
    savePersistedTasks(workspacePath, filtered);
}
// Clear all tasks
export function clearPersistedTasks(workspacePath) {
    try {
        const tasksPath = join(workspacePath, TASKS_FILE);
        if (fs.existsSync(tasksPath)) {
            fs.removeSync(tasksPath);
        }
    }
    catch (error) { }
}
// Get task statistics
export function getTaskStats(workspacePath) {
    const tasks = loadPersistedTasks(workspacePath);
    return {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
    };
}
//# sourceMappingURL=taskPersistence.js.map