// Hooks系统 - 拦截工具调用
import fs from 'fs-extra';
import { join } from 'path';
import { GLOBAL_DIR, loadProjectHooks, } from '../utils/settings';
// 加载 hooks 配置（全局 + 项目追加）
export function loadHooks(workspacePath) {
    const ws = workspacePath || process.cwd();
    // 加载全局 hooks
    const globalSettings = loadGlobalSettingsSync();
    let hooks = globalSettings.hooks || { PreToolUse: [], PostToolUse: [] };
    // 加载项目 hooks（追加）
    const projectHooks = loadProjectHooks(ws);
    if (projectHooks) {
        hooks = {
            PreToolUse: [
                ...(hooks.PreToolUse || []),
                ...(projectHooks.PreToolUse || []),
            ],
            PostToolUse: [
                ...(hooks.PostToolUse || []),
                ...(projectHooks.PostToolUse || []),
            ],
        };
    }
    return { hooks };
}
// 同步加载全局 settings
function loadGlobalSettingsSync() {
    const globalPath = join(GLOBAL_DIR, 'settings.json');
    if (fs.existsSync(globalPath)) {
        try {
            return fs.readJsonSync(globalPath);
        }
        catch {
            return {};
        }
    }
    return {};
}
// 检查匹配
function matchesMatcher(toolName, args, matcher) {
    // 检查工具名匹配
    if (matcher.tool) {
        const toolPattern = matcher.tool || '';
        if (toolPattern.includes('*')) {
            const pattern = toolPattern.replace('*', '');
            if (!toolName.includes(pattern))
                return false;
        }
        else {
            if (toolName !== toolPattern)
                return false;
        }
    }
    // 检查参数匹配
    if (matcher.args) {
        for (const [key, pattern] of Object.entries(matcher.args)) {
            const value = String(args[key] || '');
            const patternStr = String(pattern || '');
            if (patternStr.includes('*')) {
                const prefix = patternStr.replace('*', '');
                if (!value.includes(prefix))
                    return false;
            }
            else {
                if (value !== patternStr)
                    return false;
            }
        }
    }
    return true;
}
// 执行PreToolUse hooks
export function runPreHooks(toolName, args) {
    const safeArgs = args || {}; // 保护 args 参数
    const hooks = loadHooks();
    const preHooks = hooks.hooks.PreToolUse || [];
    for (const hook of preHooks) {
        if (matchesMatcher(toolName, safeArgs, hook.matcher)) {
            return {
                matched: true,
                action: hook.action,
                message: hook.message,
            };
        }
    }
    return { matched: false, action: 'none', message: '' };
}
// 执行PostToolUse hooks（返回日志消息）
export function runPostHooks(toolName, args, result) {
    const safeArgs = args || {}; // 保护 args 参数
    const hooks = loadHooks();
    const postHooks = hooks.hooks.PostToolUse || [];
    for (const hook of postHooks) {
        if (matchesMatcher(toolName, safeArgs, hook.matcher)) {
            return hook.message;
        }
    }
    return null;
}
//# sourceMappingURL=index.js.map