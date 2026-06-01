// Plugin 管理器 — 加载、卸载、执行插件
// 插件目录: ~/.spica/plugins/ 或 .spica/plugins/

import fs from 'fs-extra';
import { join, basename } from 'path';
import { EventEmitter } from 'events';
import type {
  PluginManifest, PluginModule, PluginInstance,
  PluginTool, PluginHook, PluginContext,
  ToolResult, HookResult,
} from './types';
import type { ToolDefinition } from '../tools/index';

export class PluginManager extends EventEmitter {
  private plugins: Map<string, PluginInstance> = new Map();

  // 从目录加载所有插件
  async loadFromDir(dir: string): Promise<number> {
    if (!await fs.pathExists(dir)) return 0;

    const entries = await fs.readdir(dir, { withFileTypes: true });
    let loaded = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginDir = join(dir, entry.name);
      const result = await this.load(pluginDir);
      if (result) loaded++;
    }

    return loaded;
  }

  // 加载单个插件
  async load(pluginDir: string): Promise<boolean> {
    try {
      // 读取 plugin.json
      const manifestPath = join(pluginDir, 'plugin.json');
      if (!await fs.pathExists(manifestPath)) {
        return false;
      }

      const manifest: PluginManifest = await fs.readJson(manifestPath);
      if (!manifest.name || !manifest.main) {
        return false;
      }

      // 加载入口模块
      const entryPath = join(pluginDir, manifest.main);
      if (!await fs.pathExists(entryPath)) {
        return false;
      }

      const mod = await import(entryPath);
      const pluginModule: PluginModule = mod.default || mod;

      const instance: PluginInstance = {
        manifest,
        module: pluginModule,
        dir: pluginDir,
      };

      this.plugins.set(manifest.name, instance);

      // 调用 onInit
      if (pluginModule.onInit) {
        const ctx = this.createContext(manifest.name);
        await pluginModule.onInit(ctx);
      }

      this.emit('plugin_loaded', { name: manifest.name });
      return true;
    } catch (err: any) {
      this.emit('plugin_error', { dir: pluginDir, error: err.message });
      return false;
    }
  }

  // 卸载插件
  async unload(name: string): Promise<void> {
    const instance = this.plugins.get(name);
    if (!instance) return;

    if (instance.module.onDestroy) {
      await instance.module.onDestroy();
    }

    this.plugins.delete(name);
    this.emit('plugin_unloaded', { name });
  }

  // 获取所有插件注册的工具定义
  getToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const [name, instance] of this.plugins) {
      if (instance.module.tools) {
        for (const tool of instance.module.tools) {
          defs.push({
            ...tool.definition,
            description: `[Plugin:${name}] ${tool.definition.description}`,
          });
        }
      }
    }
    return defs;
  }

  // 获取所有插件注册的 hooks
  getHooks(): PluginHook[] {
    const hooks: PluginHook[] = [];
    for (const instance of this.plugins.values()) {
      if (instance.module.hooks) {
        hooks.push(...instance.module.hooks);
      }
    }
    return hooks;
  }

  // 执行插件工具
  async executeTool(name: string, args: Record<string, any>, workspace: string): Promise<ToolResult> {
    // 查找工具所属的插件
    for (const [pluginName, instance] of this.plugins) {
      if (!instance.module.tools) continue;
      for (const tool of instance.module.tools) {
        if (tool.definition.name === name) {
          const ctx = this.createContext(pluginName, workspace);
          try {
            return await tool.execute(args, ctx);
          } catch (err: any) {
            return { success: false, error: `Plugin tool error: ${err.message}` };
          }
        }
      }
    }
    return { success: false, error: `Plugin tool not found: ${name}` };
  }

  // 执行 pre-tool hooks
  runPreHooks(toolName: string, args: Record<string, any>): HookResult | null {
    for (const instance of this.plugins.values()) {
      if (!instance.module.hooks) continue;
      for (const hook of instance.module.hooks) {
        if (hook.phase !== 'pre') continue;
        if (this.matchHook(hook, toolName)) {
          const ctx = this.createContext(instance.manifest.name);
          return hook.handler(toolName, args, null, ctx);
        }
      }
    }
    return null;
  }

  // 检查是否有某个工具
  hasTool(name: string): boolean {
    for (const instance of this.plugins.values()) {
      if (!instance.module.tools) continue;
      for (const tool of instance.module.tools) {
        if (tool.definition.name === name) return true;
      }
    }
    return false;
  }

  // 列出已加载插件
  list(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(i => i.manifest);
  }

  // 插件数量
  count(): number {
    return this.plugins.size;
  }

  // 创建插件上下文
  private createContext(pluginName: string, workspace?: string): PluginContext {
    return {
      workspace: workspace || process.cwd(),
      logger: {
        info: (msg: string) => console.log(`[Plugin:${pluginName}] ${msg}`),
        warn: (msg: string) => console.warn(`[Plugin:${pluginName}] WARN: ${msg}`),
        error: (msg: string) => console.error(`[Plugin:${pluginName}] ERROR: ${msg}`),
      },
      fs: {
        readFile: (path: string) => fs.readFile(path, 'utf-8'),
        writeFile: (path: string, content: string) => fs.writeFile(path, content, 'utf-8'),
        exists: (path: string) => fs.pathExists(path),
      },
    };
  }

  // 匹配 hook
  private matchHook(hook: PluginHook, toolName: string): boolean {
    if (!hook.matcher.tool) return true;
    const pattern = hook.matcher.tool;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(toolName);
    }
    return pattern === toolName;
  }
}

// 全局单例
let instance: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!instance) instance = new PluginManager();
  return instance;
}
