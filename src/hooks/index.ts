// Hooks系统 - 拦截工具调用

import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

export interface HookMatcher {
  tool?: string;      // 工具名匹配（支持通配符 *）
  args?: Record<string, string>;  // 参数匹配（支持通配符）
}

export interface HookDefinition {
  matcher: HookMatcher;
  action: 'block' | 'confirm' | 'log' | 'warn';
  message: string;
}

export interface HooksConfig {
  hooks: {
    PreToolUse?: HookDefinition[];
    PostToolUse?: HookDefinition[];
  };
}

export interface HookResult {
  matched: boolean;
  action: 'block' | 'confirm' | 'log' | 'warn' | 'none';
  message: string;
}

// 默认hooks配置
const DEFAULT_HOOKS: HooksConfig = {
  hooks: {
    PreToolUse: [
      // 阻止危险bash命令
      {
        matcher: { tool: 'bash', args: { command: '*--force*' } },
        action: 'block',
        message: '禁止使用 --force 参数，可能造成不可恢复的更改',
      },
      {
        matcher: { tool: 'bash', args: { command: '*rm -rf /*' } },
        action: 'block',
        message: '禁止删除根目录',
      },
      // 确认敏感文件修改
      {
        matcher: { tool: 'file_*', args: { path: '*.env*' } },
        action: 'confirm',
        message: '确认修改环境配置文件？',
      },
      // 只有修改操作才需要确认package.json，读取不需要
      {
        matcher: { tool: 'file_write', args: { path: '*package.json' } },
        action: 'confirm',
        message: '确认修改 package.json？',
      },
      {
        matcher: { tool: 'file_edit', args: { path: '*package.json' } },
        action: 'confirm',
        message: '确认修改 package.json？',
      },
    ],
    PostToolUse: [
      // 记录文件操作
      {
        matcher: { tool: 'file_*' },
        action: 'log',
        message: '文件操作完成',
      },
    ],
  },
};

// 加载hooks配置
export function loadHooks(): HooksConfig {
  // 合成默认配置 + 用户配置
  let config = DEFAULT_HOOKS;

  // 加载全局hooks
  const globalPath = join(os.homedir(), '.spica', 'hooks.json');
  if (fs.existsSync(globalPath)) {
    try {
      const globalHooks = fs.readJsonSync(globalPath);
      config = mergeHooks(config, globalHooks);
    } catch (error) {
      // 忽略
    }
  }

  // 加载项目hooks
  const projectPath = join(process.cwd(), '.spica', 'hooks.json');
  if (fs.existsSync(projectPath)) {
    try {
      const projectHooks = fs.readJsonSync(projectPath);
      config = mergeHooks(config, projectHooks);
    } catch (error) {
      // 忽略
    }
  }

  return config;
}

// 合并hooks配置
function mergeHooks(base: HooksConfig, override: HooksConfig): HooksConfig {
  const result = { hooks: { ...base.hooks } };

  if (override.hooks.PreToolUse) {
    result.hooks.PreToolUse = [
      ...(base.hooks.PreToolUse || []),
      ...(override.hooks.PreToolUse || []),
    ];
  }

  if (override.hooks.PostToolUse) {
    result.hooks.PostToolUse = [
      ...(base.hooks.PostToolUse || []),
      ...(override.hooks.PostToolUse || []),
    ];
  }

  return result;
}

// 检查匹配
function matchesMatcher(toolName: string, args: Record<string, any>, matcher: HookMatcher): boolean {
  // 检查工具名匹配
  if (matcher.tool) {
    const toolPattern = matcher.tool || '';
    if (toolPattern.includes('*')) {
      const pattern = toolPattern.replace('*', '');
      if (!toolName.includes(pattern)) return false;
    } else {
      if (toolName !== toolPattern) return false;
    }
  }

  // 检查参数匹配
  if (matcher.args) {
    for (const [key, pattern] of Object.entries(matcher.args)) {
      const value = String(args[key] || '');
      const patternStr = String(pattern || '');
      if (patternStr.includes('*')) {
        const prefix = patternStr.replace('*', '');
        if (!value.includes(prefix)) return false;
      } else {
        if (value !== patternStr) return false;
      }
    }
  }

  return true;
}

// 执行PreToolUse hooks
export function runPreHooks(toolName: string, args: Record<string, any>): HookResult {
  const safeArgs = args || {};  // 保护 args 参数
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
export function runPostHooks(toolName: string, args: Record<string, any>, result: any): string | null {
  const safeArgs = args || {};  // 保护 args 参数
  const hooks = loadHooks();
  const postHooks = hooks.hooks.PostToolUse || [];

  for (const hook of postHooks) {
    if (matchesMatcher(toolName, safeArgs, hook.matcher)) {
      return hook.message;
    }
  }

  return null;
}