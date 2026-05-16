import fs from 'fs-extra';
import { execa } from 'execa';
import simpleGit from 'simple-git';
import { resolve, isAbsolute, dirname, join } from 'path';
import fastGlob from 'fast-glob';
import { SpicaAgent } from '../agent';
import { SubAgentTask, getSubAgentConfig, isToolAllowed, summarizeResult } from './subAgent';
import { computeDiff, formatDiff, generateEditDiff } from '../cli/ui/diff';
import { restoreCheckpoint, getLastCheckpoint, setCheckpointWorkspace } from '../core/errorRecovery';
import { getMCPManager } from '../mcp/client';

// WORKSPACE 可以通过 setWorkspace 函数更新
let WORKSPACE = process.cwd();

// 设置工作目录
export function setWorkspace(path: string): void {
  WORKSPACE = path;
  setCheckpointWorkspace(path);  // 同步到errorRecovery
}

// 获取当前工作目录
export function getWorkspace(): string {
  return WORKSPACE;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  diff?: string;
}

export const TOOLS_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'file_read',
    description: 'Read file. Required before file_write/edit.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        offset: { type: 'number', description: 'Start line (optional)' },
        limit: { type: 'number', description: 'Lines to read (optional)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_write',
    description: 'Write/create file. Overwrites existing.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'file_edit',
    description: 'Edit file by exact text replacement. Read first.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        oldString: { type: 'string', description: 'Text to replace (exact)' },
        newString: { type: 'string', description: 'New text' },
      },
      required: ['path', 'oldString', 'newString'],
    },
  },
  {
    name: 'file_multi_edit',
    description: 'Edit file with multiple replacements at once. More efficient than multiple file_edit calls. Read file first.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        edits: {
          type: 'array',
          description: 'List of edits to apply',
          items: {
            type: 'object',
            properties: {
              oldString: { type: 'string', description: 'Text to replace (exact)' },
              newString: { type: 'string', description: 'New text' },
            },
            required: ['oldString', 'newString'],
          },
        },
      },
      required: ['path', 'edits'],
    },
  },
  {
    name: 'file_exists',
    description: 'Check if path exists.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_delete',
    description: 'Delete file or directory.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_copy',
    description: 'Copy file/directory.',
    parameters: {
      type: 'object' as const,
      properties: {
        source: { type: 'string', description: 'Source' },
        destination: { type: 'string', description: 'Dest' },
      },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'file_move',
    description: 'Move/rename file/directory.',
    parameters: {
      type: 'object' as const,
      properties: {
        source: { type: 'string', description: 'Source' },
        destination: { type: 'string', description: 'Dest' },
      },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'directory_create',
    description: 'Create directory (with parents).',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'directory_list',
    description: 'List directory contents.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path (default: workspace)' },
      },
      required: [],
    },
  },
  {
    name: 'glob',
    description: 'Find files by pattern.',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Glob pattern' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search text in files.',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Search pattern' },
        path: { type: 'string', description: 'Directory (optional)' },
        include: { type: 'string', description: 'File pattern (optional)' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'bash',
    description: 'Run shell command. For build/test/package ops.',
    parameters: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Command' },
        timeout: { type: 'number', description: 'Timeout (default 120)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git',
    description: 'Git operations. Actions: status, diff, log, add, commit, branch, checkout, push, pull, reset, stash. Use for version control.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'diff', 'log', 'add', 'commit', 'branch', 'checkout', 'push', 'pull', 'reset', 'stash'],
          description: 'Git action to perform'
        },
        args: {
          type: 'object',
          properties: {
            files: { type: 'string', description: 'Files for add/reset (default: all)' },
            message: { type: 'string', description: 'Commit message' },
            branch: { type: 'string', description: 'Branch name for checkout/branch' },
            limit: { type: 'number', description: 'Log count limit' },
            mode: { type: 'string', description: 'Reset mode: soft/mixed/hard' },
          },
          description: 'Action-specific arguments'
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'workspace',
    description: 'Get/switch workspace.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'New path (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'checkpoint_restore',
    description: 'Restore git checkpoint.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'web_search',
    description: 'Search web.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Query' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 15)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch URL content.',
    parameters: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 15)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'question',
    description: 'Ask user for clarification.',
    parameters: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Question' },
      },
      required: ['text'],
    },
  },
  {
    name: 'gh',
    description: 'GitHub CLI operations. Actions: pr_view, pr_list, pr_create, issue_list, issue_view, issue_create, repo_view, run_list, run_view. Use for GitHub interactions.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['pr_view', 'pr_list', 'pr_create', 'issue_list', 'issue_view', 'issue_create', 'repo_view', 'run_list', 'run_view'],
          description: 'GitHub action'
        },
        args: {
          type: 'object',
          properties: {
            number: { type: 'number', description: 'PR/Issue number' },
            state: { type: 'string', description: 'State filter: open/closed/all' },
            limit: { type: 'number', description: 'Result limit' },
            label: { type: 'string', description: 'Label filter' },
            title: { type: 'string', description: 'PR/Issue title (for create)' },
            body: { type: 'string', description: 'PR/Issue body (for create)' },
            base: { type: 'string', description: 'Base branch (for PR create)' },
            head: { type: 'string', description: 'Head branch (for PR create)' },
          },
          description: 'Action-specific arguments'
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'todo_write',
    description: 'Write task todos.',
    parameters: {
      type: 'object' as const,
      properties: {
        todos: {
          type: 'array',
          description: 'Todo list',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            },
          },
        },
      },
      required: ['todos'],
    },
  },
  {
    name: 'task',
    description: 'Run parallel subagents (max 3).',
    parameters: {
      type: 'object' as const,
      properties: {
        tasks: {
          type: 'array',
          description: 'Tasks',
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Short desc' },
              prompt: { type: 'string', description: 'Full prompt' },
            },
            required: ['description', 'prompt'],
          },
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'lint',
    description: 'Run linter. Auto-detects.',
    parameters: {
      type: 'object' as const,
      properties: {
        fix: { type: 'boolean', description: 'Auto-fix (optional)' },
        files: { type: 'string', description: 'Files (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'test',
    description: 'Run tests. Auto-detects.',
    parameters: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', description: 'Pattern (optional)' },
        coverage: { type: 'boolean', description: 'Coverage (optional)' },
      },
      required: [],
    },
  },
];

// 获取所有工具定义（内置 + MCP动态工具）
export function getAllToolDefinitions(): ToolDefinition[] {
  const mcpTools = getMCPManager().getToolDefinitions();
  // MCP工具转换为ToolDefinition格式
  const mcpConverted: ToolDefinition[] = mcpTools.map(t => ({
    name: t.name,
    description: `[MCP] ${t.description}`,
    parameters: t.inputSchema,
  }));
  return [...TOOLS_DEFINITIONS, ...mcpConverted];
}

export interface ToolEventCallback {
  (event: string, data: any): void;
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  eventCallback?: ToolEventCallback
): Promise<ToolResult> {
  // 保护 args 参数，确保不为 undefined
  const safeArgs = args || {};

  try {
    switch (name) {
      case 'workspace':
        if (safeArgs.path) {
          const newPath = resolve(safeArgs.path);
          if (!await fs.pathExists(newPath)) {
            return { success: false, error: `Path does not exist: ${newPath}` };
          }
          WORKSPACE = newPath;
          setCheckpointWorkspace(newPath);  // 同步到errorRecovery
          return { success: true, output: `Workspace: ${WORKSPACE}` };
        }
        return { success: true, output: `Workspace: ${WORKSPACE}` };

      case 'checkpoint_restore': {
        const lastCp = await getLastCheckpoint(WORKSPACE);
        if (!lastCp) {
          return { success: false, error: 'No checkpoint available to restore' };
        }
        const result = await restoreCheckpoint(lastCp.id);
        return {
          success: result.success,
          output: result.success ? `Restored to checkpoint: ${lastCp.id.slice(0, 7)}` : result.message,
        };
      }

      case 'file_read': {
        const readPath = resolvePath(safeArgs.path);
        const content = await fs.readFile(readPath, 'utf-8');
        const lines = content.split('\n');
        const lineCount = lines.length;

        // 简化输出：只显示文件路径和基本信息
        if (safeArgs.offset || safeArgs.limit) {
          const start = safeArgs.offset ? safeArgs.offset - 1 : 0;
          const end = safeArgs.limit ? start + safeArgs.limit : lines.length;
          const selectedLines = lines.slice(start, end);
          return {
            success: true,
            output: `[${readPath}:${start + 1}-${end}] (${selectedLines.length} lines)\n${selectedLines.join('\n')}`
          };
        }

        return {
          success: true,
          output: `[${readPath}] (${lineCount} lines)\n${content}`
        };
      }

      case 'file_write': {
        const writePath = resolvePath(safeArgs.path);
        await fs.ensureDir(dirname(writePath));

        // 读取旧内容（如果存在）生成实际diff
        let diff = '';
        try {
          const oldContent = await fs.readFile(writePath, 'utf-8');
          if (oldContent !== safeArgs.content) {
            const diffLines = computeDiff(oldContent, safeArgs.content);
            diff = formatDiff(diffLines, 3);
          }
        } catch {
          diff = `Created new file: ${safeArgs.content.split('\n').length} lines`;
        }

        await fs.writeFile(writePath, safeArgs.content, 'utf-8');
        return { success: true, output: `Wrote ${writePath}`, diff };
      }

      case 'file_edit': {
        const editPath = resolvePath(safeArgs.path);
        const fileContent = await fs.readFile(editPath, 'utf-8');

        const oldStr = String(safeArgs.oldString || '');
        const newStr = String(safeArgs.newString || '');

        if (!fileContent.includes(oldStr)) {
          return { success: false, error: `Text not found in file. Read the file to get exact text.` };
        }

        const newContent = fileContent.replace(oldStr, newStr);
        const diff = generateEditDiff(oldStr, newStr);

        await fs.writeFile(editPath, newContent, 'utf-8');
        return { success: true, output: `Edited ${editPath}`, diff };
      }

      case 'file_multi_edit': {
        const editPath = resolvePath(safeArgs.path);
        const fileContent = await fs.readFile(editPath, 'utf-8');
        const edits = safeArgs.edits || [];

        let newContent = fileContent;
        const diffs: string[] = [];
        let editCount = 0;

        for (const edit of edits) {
          const oldStr = String(edit.oldString || '');
          const newStr = String(edit.newString || '');

          if (!newContent.includes(oldStr)) {
            return { success: false, error: `Text not found: "${oldStr.slice(0, 30)}..."` };
          }

          newContent = newContent.replace(oldStr, newStr);
          diffs.push(generateEditDiff(oldStr, newStr));
          editCount++;
        }

        await fs.writeFile(editPath, newContent, 'utf-8');
        return {
          success: true,
          output: `Edited ${editPath} (${editCount} changes)`,
          diff: diffs.join('\n---\n'),
        };
      }

      case 'file_exists': {
        const existsPath = resolvePath(safeArgs.path);
        const exists = await fs.pathExists(existsPath);
        return { success: true, output: exists ? 'exists' : 'not found' };
      }

      case 'file_delete': {
        const deletePath = resolvePath(safeArgs.path);
        await fs.remove(deletePath);
        return { success: true, output: `Deleted ${deletePath}` };
      }

      case 'file_copy': {
        const srcPath = resolvePath(safeArgs.source);
        const dstPath = resolvePath(safeArgs.destination);
        await fs.copy(srcPath, dstPath);
        return { success: true, output: `Copied ${srcPath} → ${dstPath}` };
      }

      case 'file_move': {
        const moveSrc = resolvePath(safeArgs.source);
        const moveDst = resolvePath(safeArgs.destination);
        await fs.move(moveSrc, moveDst);
        return { success: true, output: `Moved ${moveSrc} → ${moveDst}` };
      }

      case 'directory_create': {
        const dirPath = resolvePath(safeArgs.path);
        await fs.ensureDir(dirPath);
        return { success: true, output: `Created directory ${dirPath}` };
      }

      case 'directory_list': {
        const listPath = safeArgs.path ? resolvePath(safeArgs.path) : WORKSPACE;
        const items = await fs.readdir(listPath);
        return { success: true, output: items.join('\n') };
      }

      case 'glob': {
        const files = await fastGlob(safeArgs.pattern, {
          cwd: WORKSPACE,
          absolute: true,
          ignore: ['node_modules', '.git', 'dist', 'build', '*.lock'],
        });
        return { 
          success: true, 
          output: files.length > 0 
            ? `Found ${files.length} files:\n${files.slice(0, 100).join('\n')}`
            : 'No files found'
        };
      }

      case 'grep': {
        const grepPath = safeArgs.path ? resolvePath(safeArgs.path) : WORKSPACE;
        const includePattern = safeArgs.include ? `--include="${safeArgs.include}"` : '';
        
        const grepResult = await execa(`grep -r ${includePattern} "${safeArgs.pattern}" ${grepPath} | head -100`, {
          shell: true,
          cwd: WORKSPACE,
          reject: false,
        });
        
        return { 
          success: true, 
          output: grepResult.stdout || 'No matches found'
        };
      }

      case 'bash': {
        const command = String(safeArgs.command || '');
        if (!command) {
          return { success: false, error: 'Command is required' };
        }
        const timeout = safeArgs.timeout ? safeArgs.timeout * 1000 : 120000;
        try {
          const bashResult = await execa(command, {
            shell: true,
            cwd: WORKSPACE,
            timeout: timeout,
            reject: false,
          });
          // 合并stdout和stderr显示完整输出
          const output = (bashResult.stdout + '\n' + bashResult.stderr).trim();
          return {
            success: bashResult.exitCode === 0,
            output: bashResult.exitCode === 0 ? output : undefined,
            error: bashResult.exitCode !== 0 ? output : undefined,
          };
        } catch (bashError: any) {
          return { success: false, error: bashError.message };
        }
      }

      case 'git': {
        const git = simpleGit(WORKSPACE);
        const action = safeArgs.action as string;
        const args = safeArgs.args || {};

        switch (action) {
          case 'status': {
            const status = await git.status();
            return { success: true, output: status.files.map(f => `${f.index} ${f.path}`).join('\n') || 'clean' };
          }
          case 'diff': {
            const diff = await git.diff();
            return { success: true, output: diff || 'No changes' };
          }
          case 'log': {
            const log = await git.log({ maxCount: args.limit || 10 });
            return { success: true, output: log.all.map(c => `${c.hash.substring(0,7)} ${c.message}`).join('\n') };
          }
          case 'add': {
            await git.add(args.files || '.');
            return { success: true, output: 'Files added' };
          }
          case 'commit': {
            if (!args.message) return { success: false, error: 'Message required' };
            await git.commit(args.message);
            return { success: true, output: `Committed: ${args.message}` };
          }
          case 'branch': {
            if (args.branch) {
              await git.branch(args.branch);
              return { success: true, output: `Created branch: ${args.branch}` };
            }
            const branches = await git.branchLocal();
            return { success: true, output: branches.all.join('\n') };
          }
          case 'checkout': {
            const branchName = String(args.branch || '');
            if (!branchName) return { success: false, error: 'Branch required' };
            const branches = await git.branchLocal();
            if (branches.all.includes(branchName)) {
              await git.checkout(branchName);
              return { success: true, output: `Switched to ${branchName}` };
            }
            await git.checkoutLocalBranch(branchName);
            return { success: true, output: `Created and switched to ${branchName}` };
          }
          case 'push': {
            await git.push();
            return { success: true, output: 'Pushed' };
          }
          case 'pull': {
            await git.pull();
            return { success: true, output: 'Pulled' };
          }
          case 'reset': {
            const mode = args.mode || 'mixed';
            await git.reset(mode);
            return { success: true, output: `Reset (${mode})` };
          }
          case 'stash': {
            await git.stash();
            return { success: true, output: 'Stashed' };
          }
          default:
            return { success: false, error: `Unknown git action: ${action}` };
        }
      }

      case 'web_search': {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(safeArgs.query)}`;
        const searchResult = await execa(`curl -s "${searchUrl}"`, { shell: true, timeout: (safeArgs.timeout || 15) * 1000 });
        return { success: true, output: searchResult.stdout.substring(0, 5000) };
      }

      case 'web_fetch': {
        const fetchResult = await execa(`curl -sL "${safeArgs.url}"`, { 
          shell: true, 
          timeout: (safeArgs.timeout || 15) * 1000,
        });
        return { success: true, output: fetchResult.stdout.substring(0, 10000) };
      }

      case 'question': {
        return {
          success: true,
          output: `QUESTION: ${safeArgs.text}\nWaiting for user response...`
        };
      }

      case 'gh': {
        const action = safeArgs.action as string;
        const args = safeArgs.args || {};
        const timeout = (args.timeout || 15) * 1000;

        switch (action) {
          case 'pr_view': {
            const ghResult = await execa(`gh pr view ${args.number || ''}`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'pr_list': {
            const state = args.state || 'open';
            const limit = args.limit || 20;
            const ghResult = await execa(`gh pr list --state ${state} --limit ${limit}`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No PRs found' };
          }
          case 'pr_create': {
            const title = args.title || '';
            const body = args.body || '';
            const base = args.base || 'main';
            const head = args.head || '';
            if (!title) return { success: false, error: 'Title required' };
            const ghResult = await execa(`gh pr create --title "${title}" --body "${body}" --base ${base} ${head ? `--head ${head}` : ''}`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'issue_list': {
            const state = args.state || 'open';
            const limit = args.limit || 20;
            const label = args.label ? `--label "${args.label}"` : '';
            const ghResult = await execa(`gh issue list --state ${state} --limit ${limit} ${label}`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No issues found' };
          }
          case 'issue_view': {
            const ghResult = await execa(`gh issue view ${args.number || ''}`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'issue_create': {
            const title = args.title || '';
            const body = args.body || '';
            if (!title) return { success: false, error: 'Title required' };
            const ghResult = await execa(`gh issue create --title "${title}" --body "${body}"`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'repo_view': {
            const ghResult = await execa(`gh repo view`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'Not in a GitHub repository' };
          }
          case 'run_list': {
            const limit = args.limit || 10;
            const ghResult = await execa(`gh run list --limit ${limit}`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No workflow runs found' };
          }
          case 'run_view': {
            const ghResult = await execa(`gh run view ${args.number || ''}`, { shell: true, cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          default:
            return { success: false, error: `Unknown gh action: ${action}` };
        }
      }

      case 'todo_write': {
        const todos = safeArgs.todos || [];
        const total = todos.length;
        const completed = todos.filter((t: any) => t.status === 'completed').length;
        const inProgress = todos.filter((t: any) => t.status === 'in_progress').length;
        const pending = todos.filter((t: any) => t.status === 'pending').length;

        const statusLabels: Record<string, string> = {
          'completed': '[done]',
          'in_progress': '[active]',
          'pending': '[pending]',
        };

        const lines = [`Progress: ${completed}/${total} done, ${inProgress} active, ${pending} pending`];
        todos.forEach((t: any, i: number) => {
          const label = statusLabels[t.status] || '[pending]';
          lines.push(`  ${i+1}. ${label} ${t.content}`);
        });

        return { success: true, output: lines.join('\n') };
      }

      case 'task': {
        const tasks = safeArgs.tasks as SubAgentTask[];

        // 限制最多3个并行任务
        if (tasks.length > 3) {
          return {
            success: false,
            error: '最多支持3个并行任务。请将任务拆分为多次调用。'
          };
        }

        const results = await Promise.all(tasks.map(async (task, i) => {
          const subTaskId = `sub-${i}-${Date.now()}`;
          const config = getSubAgentConfig(task.type);

          // 发送子agent启动事件
          if (eventCallback) {
            eventCallback('sub_agent_start', {
              id: subTaskId,
              type: task.type,
              description: task.description || task.prompt.slice(0, 50),
            });
          }

          const taskAgent = new SpicaAgent(undefined, WORKSPACE);

          // 转发子agent事件到主agent
          taskAgent.on('tool_call', (data: any) => {
            if (eventCallback) {
              eventCallback('sub_agent_tool_call', { id: subTaskId, ...data });
            }
          });

          taskAgent.on('tool_result', (data: any) => {
            if (eventCallback) {
              eventCallback('sub_agent_tool_result', { id: subTaskId, ...data });
            }
          });

          // 设置timeout
          const timeoutPromise = new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), config.timeout);
          });

          try {
            await taskAgent.init();

            // 如果有工具限制，设置工具白名单（需要在agent添加支持）
            // taskAgent.setToolWhitelist(config.allowedTools);

            const resultPromise = taskAgent.runLoop(task.prompt);
            const result = await Promise.race([resultPromise, timeoutPromise]);

            const summary = summarizeResult(result);

            if (eventCallback) {
              eventCallback('sub_agent_done', { id: subTaskId, summary });
            }

            return `✓ ${task.description || task.prompt.slice(0, 30)}: ${summary}`;
          } catch (err: any) {
            if (eventCallback) {
              eventCallback('sub_agent_error', { id: subTaskId, error: err.message });
            }
            return `✗ ${task.description || task.prompt.slice(0, 30)}: ${err.message}`;
          }
        }));

        return { success: true, output: results.join('\n') };
      }

      case 'lint': {
        const projectType = await detectProjectType(WORKSPACE);
        const fixFlag = safeArgs.fix ? '--fix' : '';
        const files = safeArgs.files || '.';

        const lintCmd = projectType === 'typescript'
          ? `npx tsc --noEmit 2>&1; npx eslint ${files} ${fixFlag}`
          : projectType === 'javascript'
          ? `npx eslint ${files} ${fixFlag}`
          : projectType === 'go'
          ? `golangci-lint run ${fixFlag}`
          : projectType === 'python'
          ? `pylint ${files} 2>&1`
          : projectType === 'rust'
          ? `cargo clippy --all-targets 2>&1`
          : null;

        if (!lintCmd) {
          return { success: false, error: `No linter configured for project type: ${projectType}` };
        }

        const lintResult = await execa(lintCmd, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 60000,
          reject: false,
        });

        const output = lintResult.stdout + '\n' + lintResult.stderr;
        const issues = output.split('\n').filter(l =>
          l.includes('error') || l.includes('warning') || l.includes('Error') || l.includes('Warning')
        );

        return {
          success: lintResult.exitCode === 0,
          output: issues.length > 0
            ? `Found ${issues.length} issues:\n${issues.slice(0, 20).join('\n')}`
            : 'No lint issues found',
        };
      }

      case 'test': {
        const projectType = await detectProjectType(WORKSPACE);
        const filter = safeArgs.filter || '';
        const coverage = safeArgs.coverage ? '--coverage' : '';

        const testCmd = projectType === 'typescript'
          ? `npx vitest run ${filter ? `--grep "${filter}"` : ''} ${coverage}`
          : projectType === 'javascript'
          ? `npm test ${filter ? `-- --grep "${filter}"` : ''}`
          : projectType === 'go'
          ? `go test ./... ${filter ? `-run "${filter}"` : ''} ${coverage ? '-cover' : ''}`
          : projectType === 'python'
          ? `pytest ${filter ? `-k "${filter}"` : ''} ${coverage ? '--cov' : ''}`
          : projectType === 'rust'
          ? `cargo test ${filter}`
          : null;

        if (!testCmd) {
          return { success: false, error: `No test runner configured for project type: ${projectType}` };
        }

        const testResult = await execa(testCmd, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 120000,
          reject: false,
        });

        const output = testResult.stdout + '\n' + testResult.stderr;

        // Parse summary
        const passedMatch = output.match(/(\d+) passed/i);
        const failedMatch = output.match(/(\d+) failed/i);

        let summary = '';
        if (passedMatch || failedMatch) {
          const passed = passedMatch ? passedMatch[1] : '0';
          const failed = failedMatch ? failedMatch[1] : '0';
          summary = `Tests: ${passed} passed, ${failed} failed\n`;
        }

        return {
          success: testResult.exitCode === 0,
          output: summary + output.slice(-500),
        };
      }

      default:
        // 检查是否是MCP工具（格式：servername/toolname）
        if (name.includes('/')) {
          const mcpManager = getMCPManager();
          if (mcpManager.hasTool(name)) {
            return await mcpManager.callTool(name, safeArgs);
          }
        }
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function resolvePath(path: string): string {
  return isAbsolute(path) ? path : resolve(WORKSPACE, path);
}

async function detectProjectType(workspace: string): Promise<string> {
  if (await fs.pathExists(join(workspace, 'package.json'))) {
    const pkg = await fs.readJson(join(workspace, 'package.json'));
    if (pkg.devDependencies?.typescript) return 'typescript';
    return 'javascript';
  }
  if (await fs.pathExists(join(workspace, 'go.mod'))) return 'go';
  if (await fs.pathExists(join(workspace, 'requirements.txt'))) return 'python';
  if (await fs.pathExists(join(workspace, 'Cargo.toml'))) return 'rust';
  return 'unknown';
}