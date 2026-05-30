#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs-extra';
import chalk from 'chalk';
import path from 'path';
const TODO_FILE = path.join(process.env.HOME || '.', '.todo.json');
// 加载todos
async function loadTodos() {
    try {
        if (await fs.pathExists(TODO_FILE)) {
            return await fs.readJson(TODO_FILE);
        }
        return [];
    }
    catch (error) {
        return [];
    }
}
// 保存todos
async function saveTodos(todos) {
    await fs.writeJson(TODO_FILE, todos, { spaces: 2 });
}
// 获取下一个ID
function getNextId(todos) {
    if (todos.length === 0)
        return 1;
    return Math.max(...todos.map(t => t.id)) + 1;
}
const program = new Command();
program
    .name('todo')
    .description('一个简单的待办事项CLI工具')
    .version('1.0.0');
// 添加任务
program
    .command('add <task>')
    .description('添加一个新任务')
    .action(async (task) => {
    try {
        const todos = await loadTodos();
        const newTodo = {
            id: getNextId(todos),
            task,
            completed: false,
            createdAt: new Date().toISOString()
        };
        todos.push(newTodo);
        await saveTodos(todos);
        console.log(chalk.green('✓'), `任务已添加: "${task}" (ID: ${newTodo.id})`);
    }
    catch (error) {
        console.error(chalk.red('✗ 添加任务失败'), error);
    }
});
// 列出任务
program
    .command('list')
    .alias('ls')
    .description('列出所有任务')
    .option('-a, --all', '显示所有任务（包括已完成）')
    .action(async (options) => {
    try {
        const todos = await loadTodos();
        if (todos.length === 0) {
            console.log(chalk.yellow('暂无任务'));
            return;
        }
        console.log(chalk.bold('\n待办事项:'));
        console.log(chalk.gray('─'.repeat(50)));
        const filteredTodos = options.all ? todos : todos.filter(t => !t.completed);
        if (filteredTodos.length === 0 && !options.all) {
            console.log(chalk.green('🎉 所有任务都已完成！'));
            console.log(chalk.gray('使用 --all 查看已完成任务'));
            return;
        }
        filteredTodos.forEach(todo => {
            const status = todo.completed
                ? chalk.green('✓')
                : chalk.yellow('○');
            const taskText = todo.completed
                ? chalk.dim(todo.task)
                : todo.task;
            console.log(`  ${status} ${chalk.gray(`[${todo.id}]`)} ${taskText}`);
        });
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.dim(`共 ${filteredTodos.length} 个任务`));
    }
    catch (error) {
        console.error(chalk.red('✗ 列出任务失败'), error);
    }
});
// 删除任务
program
    .command('delete <id>')
    .alias('del')
    .alias('rm')
    .description('删除指定ID的任务')
    .action(async (id) => {
    try {
        const todos = await loadTodos();
        const numId = parseInt(id);
        if (isNaN(numId)) {
            console.error(chalk.red('✗ 请提供有效的任务ID'));
            return;
        }
        const index = todos.findIndex(t => t.id === numId);
        if (index === -1) {
            console.error(chalk.red('✗ 未找到该任务ID'));
            return;
        }
        const deleted = todos.splice(index, 1)[0];
        await saveTodos(todos);
        console.log(chalk.green('✓'), `已删除任务: "${deleted.task}"`);
    }
    catch (error) {
        console.error(chalk.red('✗ 删除任务失败'), error);
    }
});
// 完成任务
program
    .command('complete <id>')
    .alias('done')
    .description('标记任务为已完成')
    .action(async (id) => {
    try {
        const todos = await loadTodos();
        const numId = parseInt(id);
        if (isNaN(numId)) {
            console.error(chalk.red('✗ 请提供有效的任务ID'));
            return;
        }
        const todo = todos.find(t => t.id === numId);
        if (!todo) {
            console.error(chalk.red('✗ 未找到该任务ID'));
            return;
        }
        if (todo.completed) {
            console.log(chalk.yellow('⚠ 该任务已经完成'));
            return;
        }
        todo.completed = true;
        await saveTodos(todos);
        console.log(chalk.green('✓'), `已完成任务: "${todo.task}"`);
    }
    catch (error) {
        console.error(chalk.red('✗ 标记任务失败'), error);
    }
});
// 清除已完成任务
program
    .command('clear')
    .description('清除所有已完成的任务')
    .action(async () => {
    try {
        const todos = await loadTodos();
        const completed = todos.filter(t => t.completed);
        if (completed.length === 0) {
            console.log(chalk.yellow('没有已完成的任务需要清除'));
            return;
        }
        const remaining = todos.filter(t => !t.completed);
        await saveTodos(remaining);
        console.log(chalk.green('✓'), `已清除 ${completed.length} 个完成任务`);
    }
    catch (error) {
        console.error(chalk.red('✗ 清除任务失败'), error);
    }
});
program.parse();
//# sourceMappingURL=todo.js.map