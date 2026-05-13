// MCP (Model Context Protocol) Client
// 连接外部工具服务器，动态获取工具

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import { join } from 'path';
import os from 'os';

export interface MCPServerConfig {
  name: string;           // 服务器名称
  command?: string;       // stdio模式：启动命令
  args?: string[];        // stdio模式：命令参数
  url?: string;           // SSE模式：服务器URL
  env?: Record<string, string>;  // 环境变量
  disabled?: boolean;     // 是否禁用
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPConfig {
  servers: MCPServerConfig[];
}

// MCP配置路径
const MCP_CONFIG_PATH = join(os.homedir(), '.spica', 'mcp.json');

export class MCPManager extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, { serverName: string; tool: MCPTool }> = new Map();
  private processes: Map<string, ChildProcess> = new Map();

  constructor() {
    super();
  }

  // 加载配置
  async loadConfig(): Promise<MCPConfig> {
    if (await fs.pathExists(MCP_CONFIG_PATH)) {
      return await fs.readJson(MCP_CONFIG_PATH);
    }
    return { servers: [] };
  }

  // 连接所有配置的MCP服务器
  async connectAll(): Promise<void> {
    const config = await this.loadConfig();

    for (const server of config.servers) {
      if (server.disabled) continue;

      try {
        await this.connectServer(server);
        this.emit('server_connected', { name: server.name });
      } catch (error: any) {
        this.emit('server_error', { name: server.name, error: error.message });
      }
    }
  }

  // 连接单个服务器
  async connectServer(config: MCPServerConfig): Promise<void> {
    let transport: any;

    if (config.command) {
      // Stdio模式 - 启动本地进程
      const process = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.processes.set(config.name, process);

      transport = new StdioClientTransport({
        reader: process.stdout,
        writer: process.stdin,
      });

      // 监听stderr日志
      process.stderr?.on('data', (data) => {
        this.emit('server_log', { name: config.name, log: data.toString() });
      });

    } else if (config.url) {
      // SSE模式 - HTTP连接
      transport = new SSEClientTransport(new URL(config.url));

    } else {
      throw new Error(`MCP server ${config.name} needs either command or url`);
    }

    const client = new Client(
      { name: 'spica-mcp-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(config.name, client);

    // 获取工具列表
    const toolsResult = await client.listTools();
    if (toolsResult.tools) {
      for (const tool of toolsResult.tools) {
        // 工具名加上服务器前缀避免冲突
        const fullName = `${config.name}/${tool.name}`;
        this.tools.set(fullName, {
          serverName: config.name,
          tool: {
            name: fullName,
            description: tool.description || '',
            inputSchema: tool.inputSchema as any,
          },
        });
      }
    }
  }

  // 获取所有MCP工具定义
  getToolDefinitions(): MCPTool[] {
    return Array.from(this.tools.values()).map(t => t.tool);
  }

  // 调用MCP工具
  async callTool(fullName: string, args: Record<string, any>): Promise<{ success: boolean; output: string; error?: string }> {
    // 解析服务器名和工具名
    const [serverName, toolName] = fullName.split('/');
    if (!serverName || !toolName) {
      return { success: false, error: `Invalid tool name format: ${fullName}` };
    }

    const client = this.clients.get(serverName);
    if (!client) {
      return { success: false, error: `MCP server ${serverName} not connected` };
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      // 处理结果
      if (result.content) {
        const textContent = result.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
        return { success: !result.isError, output: textContent };
      }

      return { success: true, output: 'Tool executed successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // 断开所有连接
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
      } catch {
        // 忽略关闭错误
      }
    }
    this.clients.clear();
    this.tools.clear();

    // 关闭进程
    for (const [name, process] of this.processes) {
      process.kill();
    }
    this.processes.clear();
  }

  // 列出已连接的服务器
  listConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  // 列出可用工具
  listAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // 检查工具是否存在
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

// 全局MCP管理器实例
let mcpManager: MCPManager | null = null;

export function getMCPManager(): MCPManager {
  if (!mcpManager) {
    mcpManager = new MCPManager();
  }
  return mcpManager;
}

// 初始化MCP（在agent启动时调用）
export async function initMCP(): Promise<void> {
  const manager = getMCPManager();
  await manager.connectAll();
}

// 关闭MCP（在退出时调用）
export async function shutdownMCP(): Promise<void> {
  if (mcpManager) {
    await mcpManager.disconnectAll();
    mcpManager = null;
  }
}

// 示例配置生成
export function generateExampleConfig(): MCPConfig {
  return {
    servers: [
      // 文件系统服务器（stdio模式）
      {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@anthropic-ai/mcp-server-filesystem', '/home/user/project'],
      },
      // PostgreSQL服务器
      {
        name: 'postgres',
        command: 'npx',
        args: ['-y', '@anthropic-ai/mcp-server-postgres'],
        env: {
          POSTGRES_URL: 'postgres://localhost/mydb',
        },
      },
      // HTTP服务器（SSE模式）
      {
        name: 'custom-api',
        url: 'http://localhost:3000/mcp',
      },
    ],
  };
}

// 保存示例配置到文件
export async function saveExampleConfig(): Promise<void> {
  const config = generateExampleConfig();
  await fs.ensureDir(join(os.homedir(), '.spica'));
  await fs.writeJson(MCP_CONFIG_PATH, config, { spaces: 2 });
  console.log(`MCP config saved to ${MCP_CONFIG_PATH}`);
}