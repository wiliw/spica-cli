import fs from 'fs-extra';
import { execa } from 'execa';
import simpleGit from 'simple-git';
import { resolve, isAbsolute, dirname, join } from 'path';
import fastGlob from 'fast-glob';
import { SpicaAgent } from '../agent';
import { SubAgentTask, getSubAgentConfig, isToolAllowed, summarizeResult } from './subAgent';
import { computeDiff, formatDiff, generateEditDiff } from '../utils/diffDisplay';

let WORKSPACE = process.cwd();

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
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
    description: 'Read file content. ALWAYS use before file_write or file_edit to understand context.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path (absolute or relative to workspace)' },
        offset: { type: 'number', description: 'Start reading from line number (optional)' },
        limit: { type: 'number', description: 'Number of lines to read (optional)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_write',
    description: 'Write content to a file. Creates file if not exists, overwrites if exists.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'file_edit',
    description: 'Edit file by replacing exact text match. MUST read file first to get exact text.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        oldString: { type: 'string', description: 'Exact text to replace (must match exactly)' },
        newString: { type: 'string', description: 'New text' },
      },
      required: ['path', 'oldString', 'newString'],
    },
  },
  {
    name: 'file_exists',
    description: 'Check if file or directory exists',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path to check' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_delete',
    description: 'Delete file or directory. Use carefully.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path to delete' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_copy',
    description: 'Copy file or directory',
    parameters: {
      type: 'object' as const,
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' },
      },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'file_move',
    description: 'Move/rename file or directory',
    parameters: {
      type: 'object' as const,
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' },
      },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'directory_create',
    description: 'Create directory (and parent directories if needed)',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path to create' },
      },
      required: ['path'],
    },
  },
  {
    name: 'directory_list',
    description: 'List contents of directory',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path (optional, defaults to workspace)' },
      },
      required: [],
    },
  },
  {
    name: 'glob',
    description: 'Find files matching pattern. Use to discover files in codebase.',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search for text pattern in files. Use to find code, functions, imports.',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Search pattern (regex supported)' },
        path: { type: 'string', description: 'Directory to search (optional)' },
        include: { type: 'string', description: 'File pattern to include (e.g., "*.ts")' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'bash',
    description: 'Execute bash command. For file operations, prefer file_* tools. Use for: package managers, build tools, git, system commands.',
    parameters: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds (optional, default 120)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Show git working tree status',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_diff',
    description: 'Show git diff (staged and unstaged changes)',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_log',
    description: 'Show recent git commits',
    parameters: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of commits to show (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'git_add',
    description: 'Add files to git staging area',
    parameters: {
      type: 'object' as const,
      properties: {
        files: { type: 'string', description: 'Files to add (default: all)' },
      },
      required: [],
    },
  },
  {
    name: 'git_commit',
    description: 'Commit staged changes with message',
    parameters: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Commit message' },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_branch',
    description: 'List branches or create new branch',
    parameters: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'New branch name (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'git_checkout',
    description: 'Switch to branch or restore files',
    parameters: {
      type: 'object' as const,
      properties: {
        branch: { type: 'string', description: 'Branch name' },
      },
      required: ['branch'],
    },
  },
  {
    name: 'workspace',
    description: 'Get current workspace or switch to different project. Use when user wants to work on another project.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'New workspace path (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for information. Use for: documentation, tutorials, error solutions.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch content from URL. Use for: API docs, GitHub repos, tutorials.',
    parameters: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'question',
    description: 'Ask user a question when you need clarification or decision.',
    parameters: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Question to ask' },
      },
      required: ['text'],
    },
  },
  {
    name: 'gh_pr_view',
    description: 'View GitHub PR details. Use to see PR info, files changed, reviews.',
    parameters: {
      type: 'object' as const,
      properties: {
        number: { type: 'number', description: 'PR number' },
        json: { type: 'boolean', description: 'Output as JSON (optional)' },
      },
      required: ['number'],
    },
  },
  {
    name: 'gh_issue_list',
    description: 'List GitHub issues in the repository.',
    parameters: {
      type: 'object' as const,
      properties: {
        state: { type: 'string', description: 'Issue state: open/closed/all (optional)' },
        limit: { type: 'number', description: 'Max issues to show (optional)' },
        label: { type: 'string', description: 'Filter by label (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'gh_issue_view',
    description: 'View GitHub issue details.',
    parameters: {
      type: 'object' as const,
      properties: {
        number: { type: 'number', description: 'Issue number' },
      },
      required: ['number'],
    },
  },
  {
    name: 'gh_repo_view',
    description: 'View current repository info (name, description, stats).',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'gh_run_list',
    description: 'List recent GitHub Actions workflow runs.',
    parameters: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max runs to show (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'todo_write',
    description: 'Write todos to track progress on complex tasks.',
    parameters: {
      type: 'object' as const,
      properties: {
        todos: { 
          type: 'array', 
          description: 'List of todos',
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
    description: 'Launch parallel subagents (max 3). Use when facing 2-3 independent tasks.',
    parameters: {
      type: 'object' as const,
      properties: {
        tasks: {
          type: 'array',
          description: 'List of 2-3 independent tasks to execute in parallel',
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Short task description' },
              prompt: { type: 'string', description: 'Full task prompt' },
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
    description: 'Run linting and type checking. Auto-detects eslint/tsc/golangci/pylint/clippy based on project type.',
    parameters: {
      type: 'object' as const,
      properties: {
        fix: { type: 'boolean', description: 'Auto-fix issues where possible (optional)' },
        files: { type: 'string', description: 'Specific files or directories to lint (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'test',
    description: 'Run tests. Auto-detects vitest/jest/go test/pytest/cargo test based on project type.',
    parameters: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', description: 'Test name pattern to filter (optional)' },
        coverage: { type: 'boolean', description: 'Run with coverage report (optional)' },
      },
      required: [],
    },
  },
];

export function getWorkspace(): string {
  return WORKSPACE;
}

export interface ToolEventCallback {
  (event: string, data: any): void;
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  eventCallback?: ToolEventCallback
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'workspace':
        if (args.path) {
          const newPath = resolve(args.path);
          if (!await fs.pathExists(newPath)) {
            return { success: false, error: `Path does not exist: ${newPath}` };
          }
          WORKSPACE = newPath;
          return { success: true, output: `Workspace: ${WORKSPACE}` };
        }
        return { success: true, output: `Workspace: ${WORKSPACE}` };

      case 'file_read': {
        const readPath = resolvePath(args.path);
        const content = await fs.readFile(readPath, 'utf-8');
        const lines = content.split('\n');
        
        if (args.offset || args.limit) {
          const start = args.offset ? args.offset - 1 : 0;
          const end = args.limit ? start + args.limit : lines.length;
          const selectedLines = lines.slice(start, end);
          return { success: true, output: selectedLines.join('\n') };
        }
        
        return { success: true, output: content };
      }

      case 'file_write': {
        const writePath = resolvePath(args.path);
        await fs.ensureDir(dirname(writePath));

        // 读取旧内容（如果存在）生成实际diff
        let diff = '';
        try {
          const oldContent = await fs.readFile(writePath, 'utf-8');
          if (oldContent !== args.content) {
            const diffLines = computeDiff(oldContent, args.content);
            diff = formatDiff(diffLines, 3);
          }
        } catch {
          diff = `Created new file: ${args.content.split('\n').length} lines`;
        }

        await fs.writeFile(writePath, args.content, 'utf-8');
        return { success: true, output: `Wrote ${writePath}`, diff };
      }

      case 'file_edit': {
        const editPath = resolvePath(args.path);
        const fileContent = await fs.readFile(editPath, 'utf-8');

        if (!fileContent.includes(args.oldString)) {
          return { success: false, error: `Text not found in file. Read the file to get exact text.` };
        }

        const newContent = fileContent.replace(args.oldString, args.newString);
        // 使用generateEditDiff生成实际diff
        const diff = generateEditDiff(args.oldString, args.newString);

        await fs.writeFile(editPath, newContent, 'utf-8');
        return { success: true, output: `Edited ${editPath}`, diff };
      }

      case 'file_exists': {
        const existsPath = resolvePath(args.path);
        const exists = await fs.pathExists(existsPath);
        return { success: true, output: exists ? 'exists' : 'not found' };
      }

      case 'file_delete': {
        const deletePath = resolvePath(args.path);
        await fs.remove(deletePath);
        return { success: true, output: `Deleted ${deletePath}` };
      }

      case 'file_copy': {
        const srcPath = resolvePath(args.source);
        const dstPath = resolvePath(args.destination);
        await fs.copy(srcPath, dstPath);
        return { success: true, output: `Copied ${srcPath} → ${dstPath}` };
      }

      case 'file_move': {
        const moveSrc = resolvePath(args.source);
        const moveDst = resolvePath(args.destination);
        await fs.move(moveSrc, moveDst);
        return { success: true, output: `Moved ${moveSrc} → ${moveDst}` };
      }

      case 'directory_create': {
        const dirPath = resolvePath(args.path);
        await fs.ensureDir(dirPath);
        return { success: true, output: `Created directory ${dirPath}` };
      }

      case 'directory_list': {
        const listPath = args.path ? resolvePath(args.path) : WORKSPACE;
        const items = await fs.readdir(listPath);
        return { success: true, output: items.join('\n') };
      }

      case 'glob': {
        const files = await fastGlob(args.pattern, {
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
        const grepPath = args.path ? resolvePath(args.path) : WORKSPACE;
        const includePattern = args.include ? `--include="${args.include}"` : '';
        
        const grepResult = await execa(`grep -r ${includePattern} "${args.pattern}" ${grepPath} | head -100`, {
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
        const timeout = args.timeout ? args.timeout * 1000 : 120000;
        const bashResult = await execa(args.command, {
          shell: true,
          cwd: WORKSPACE,
          timeout: timeout,
          reject: false,
        });
        
        return {
          success: bashResult.exitCode === 0,
          output: bashResult.stdout || bashResult.stderr,
        };
      }

      case 'git_status': {
        const git = simpleGit(WORKSPACE);
        const status = await git.status();
        return { success: true, output: status.files.map(f => `${f.index} ${f.path}`).join('\n') || 'clean' };
      }

      case 'git_diff': {
        const git = simpleGit(WORKSPACE);
        const diff = await git.diff();
        return { success: true, output: diff || 'No changes' };
      }

      case 'git_log': {
        const git = simpleGit(WORKSPACE);
        const log = await git.log({ maxCount: args.limit || 10 });
        return { 
          success: true, 
          output: log.all.map(c => `${c.hash.substring(0,7)} ${c.message}`).join('\n')
        };
      }

      case 'git_add': {
        const git = simpleGit(WORKSPACE);
        await git.add(args.files || '.');
        return { success: true, output: 'Files added' };
      }

      case 'git_commit': {
        const git = simpleGit(WORKSPACE);
        await git.commit(args.message);
        return { success: true, output: `Committed: ${args.message}` };
      }

      case 'git_branch': {
        const git = simpleGit(WORKSPACE);
        if (args.name) {
          await git.branch(args.name);
          return { success: true, output: `Created branch: ${args.name}` };
        }
        const branches = await git.branchLocal();
        return { success: true, output: branches.all.join('\n') };
      }

      case 'git_checkout': {
        const git = simpleGit(WORKSPACE);
        await git.checkout(args.branch);
        return { success: true, output: `Switched to ${args.branch}` };
      }

      case 'web_search': {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
        const searchResult = await execa(`curl -s "${searchUrl}"`, { shell: true, timeout: 30000 });
        return { success: true, output: searchResult.stdout.substring(0, 5000) };
      }

      case 'web_fetch': {
        const fetchResult = await execa(`curl -sL "${args.url}"`, { 
          shell: true, 
          timeout: 30000,
        });
        return { success: true, output: fetchResult.stdout.substring(0, 10000) };
      }

      case 'question': {
        return {
          success: true,
          output: `QUESTION: ${args.text}\nWaiting for user response...`
        };
      }

      case 'gh_pr_view': {
        const jsonFlag = args.json ? '--json title,body,state,author,additions,deletions,changed_files' : '';
        const ghResult = await execa(`gh pr view ${args.number} ${jsonFlag}`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 30000,
          reject: false,
        });
        return {
          success: ghResult.exitCode === 0,
          output: ghResult.stdout || ghResult.stderr,
        };
      }

      case 'gh_issue_list': {
        const state = args.state || 'open';
        const limit = args.limit || 20;
        const label = args.label ? `--label "${args.label}"` : '';
        const ghResult = await execa(`gh issue list --state ${state} --limit ${limit} ${label}`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 30000,
          reject: false,
        });
        return {
          success: ghResult.exitCode === 0,
          output: ghResult.stdout || 'No issues found',
        };
      }

      case 'gh_issue_view': {
        const ghResult = await execa(`gh issue view ${args.number}`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 30000,
          reject: false,
        });
        return {
          success: ghResult.exitCode === 0,
          output: ghResult.stdout || ghResult.stderr,
        };
      }

      case 'gh_repo_view': {
        const ghResult = await execa(`gh repo view`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 30000,
          reject: false,
        });
        return {
          success: ghResult.exitCode === 0,
          output: ghResult.stdout || 'Not in a GitHub repository',
        };
      }

      case 'gh_run_list': {
        const limit = args.limit || 10;
        const ghResult = await execa(`gh run list --limit ${limit}`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 30000,
          reject: false,
        });
        return {
          success: ghResult.exitCode === 0,
          output: ghResult.stdout || 'No workflow runs found',
        };
      }

      case 'todo_write': {
        const todos = args.todos.map((t: any, i: number) => 
          `${i+1}. [${t.status}] ${t.content}`
        ).join('\n');
        return { success: true, output: `Todos:\n${todos}` };
      }

      case 'task': {
        const tasks = args.tasks as SubAgentTask[];

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
        const fixFlag = args.fix ? '--fix' : '';
        const files = args.files || '.';

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
        const filter = args.filter || '';
        const coverage = args.coverage ? '--coverage' : '';

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