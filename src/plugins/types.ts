// Plugin 系统类型定义
// Plugin = 可动态注册的模块，提供 tool + hook 组合

import type { ToolDefinition } from '../tools/index';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  diff?: string;
  content?: string;
}

export interface HookMatcher {
  tool?: string;
  args?: Record<string, string>;
}

export interface HookResult {
  matched: boolean;
  action: 'block' | 'confirm' | 'log' | 'warn' | 'none';
  message: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main: string;
}

export interface PluginTool {
  definition: ToolDefinition;
  execute: (args: Record<string, any>, ctx: PluginContext) => Promise<ToolResult>;
}

export interface PluginHook {
  phase: 'pre' | 'post';
  matcher: HookMatcher;
  handler: (toolName: string, args: Record<string, any>, result: ToolResult | null, ctx: PluginContext) => HookResult;
}

export interface PluginModule {
  tools?: PluginTool[];
  hooks?: PluginHook[];
  onInit?: (ctx: PluginContext) => Promise<void>;
  onDestroy?: () => Promise<void>;
}

export interface PluginContext {
  workspace: string;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
  };
}

export interface PluginInstance {
  manifest: PluginManifest;
  module: PluginModule;
  dir: string;
}
