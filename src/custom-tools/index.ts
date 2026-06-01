// Custom Tools 系统 — 加载 .spica/tools/*.js 作为可调用工具
// 用户在项目中创建 .spica/tools/xxx.js，导出 definition 和 execute 即可

import fs from 'fs-extra';
import { join, basename } from 'path';
import fastGlob from 'fast-glob';
import type { ToolDefinition } from '../tools/index';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  diff?: string;
  content?: string;
}

export interface CustomToolModule {
  definition: ToolDefinition;
  execute: (args: Record<string, any>, workspace: string) => Promise<ToolResult>;
}

class CustomToolManager {
  private tools: Map<string, CustomToolModule> = new Map();
  private loaded = false;

  // 从目录加载自定义工具
  async loadFromDir(dir: string): Promise<number> {
    if (!await fs.pathExists(dir)) return 0;

    const files = await fastGlob('*.{js,mjs}', { cwd: dir, absolute: true, onlyFiles: true });
    let loaded = 0;

    for (const file of files) {
      try {
        const mod = await this.loadModule(file);
        if (mod) {
          this.tools.set(mod.definition.name, mod);
          loaded++;
        }
      } catch (err: any) {
        console.error(`[CustomTool] Failed to load ${basename(file)}: ${err.message}`);
      }
    }

    this.loaded = true;
    return loaded;
  }

  // 动态加载单个模块
  private async loadModule(filePath: string): Promise<CustomToolModule | null> {
    const mod = await import(filePath);

    // 支持两种格式：
    // 1. export const definition = {...}; export async function execute(...) {...}
    // 2. export default { definition, execute }
    const toolDef = mod.definition || mod.default?.definition;
    const toolExec = mod.execute || mod.default?.execute;

    if (!toolDef || !toolExec) {
      console.warn(`[CustomTool] ${basename(filePath)}: must export 'definition' and 'execute'`);
      return null;
    }

    if (!toolDef.name || !toolDef.description || !toolDef.parameters) {
      console.warn(`[CustomTool] ${basename(filePath)}: 'definition' must have name, description, parameters`);
      return null;
    }

    return { definition: toolDef, execute: toolExec };
  }

  // 获取所有自定义工具的定义
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  // 执行自定义工具
  async execute(name: string, args: Record<string, any>, workspace: string): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Custom tool not found: ${name}` };
    }

    try {
      const result = await tool.execute(args, workspace);
      return result;
    } catch (err: any) {
      return { success: false, error: `Custom tool error: ${err.message}` };
    }
  }

  // 检查是否有某个自定义工具
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  // 工具数量
  count(): number {
    return this.tools.size;
  }

  // 是否已加载
  isLoaded(): boolean {
    return this.loaded;
  }

  // 重新加载（清空后重新加载）
  async reload(dir: string): Promise<number> {
    this.tools.clear();
    this.loaded = false;
    return await this.loadFromDir(dir);
  }
}

// 全局单例
let instance: CustomToolManager | null = null;

export function getCustomToolManager(): CustomToolManager {
  if (!instance) instance = new CustomToolManager();
  return instance;
}
