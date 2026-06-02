import fs from 'fs-extra';
import { execa } from 'execa';
import simpleGit from 'simple-git';
import { resolve as pathResolve, isAbsolute, dirname, join, basename } from 'path';
import fastGlob from 'fast-glob';
import { SpicaAgent } from '../agent';
import { SubAgentTask, getSubAgentConfig, summarizeResult } from './subAgent';
import { computeDiff, formatDiff, generateEditDiff } from '../cli/ui/diff';
import { getMCPManager } from '../mcp/client';
import { getBashPath } from '../utils/platform';
import axios from 'axios';

const isWindows = process.platform === 'win32';

// WORKSPACE 可以通过 setWorkspace 函数更新
let WORKSPACE = process.cwd();

// 设置工作目录
export function setWorkspace(path: string): void {
  WORKSPACE = path;
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
  syntaxErrors?: string[];
  content?: string;
  filesAtRisk?: string[];
  safetyMode?: 'protected' | 'normal';
  requiresUserConfirmation?: boolean;
  referencedSkills?: string[];
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
    description: 'Write/create file. Overwrites existing. Auto-checks syntax for code files (TS/JS/Python/Go/Rust/Shell). Returns syntaxErrors if issues found.',
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
    description: 'Edit file by exact text replacement. Read first. Auto-checks syntax after edit. Returns syntaxErrors if issues found.',
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
    description: 'Edit file with multiple replacements at once. More efficient than multiple file_edit calls. Read file first. Auto-checks syntax after edit.',
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
        ignore: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore (default: node_modules, .git, dist, build, *.lock)' },
        maxFiles: { type: 'number', description: 'Max files to return (default: 100, prevents overflow)' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search text patterns in files. Returns matches with file paths and line numbers.',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search' },
        path: { type: 'string', description: 'Directory to search (default: workspace)' },
        include: { type: 'string', description: 'File pattern to include (e.g., "*.ts")' },
        maxLines: { type: 'number', description: 'Max lines to return (default: 100, prevents overflow)' },
      },
      required: ['pattern'],
    },
  },
  {
name: 'bash',
    description: 'Run shell command. Auto-retries with detached=true if timeout/stuck.',
    parameters: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 120)' },
        detached: { type: 'boolean', description: 'Run in background (tmux/screen)' },
        interactive: { type: 'boolean', description: 'Enable PTY interaction' },
        maxOutputLength: { type: 'number', description: 'Max output chars (default 50000)' },
        autoRetry: { type: 'boolean', description: 'Auto-retry with detached if stuck (default true)' },
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
    name: 'web_search',
    description: 'Search web using DuckDuckGo (free) or Tavily API (if configured). Returns up to 10 results with titles and URLs. Use for finding documentation, solutions, current information.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        engine: { type: 'string', enum: ['duckduckgo', 'tavily'], description: 'Search engine (default: duckduckgo)' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 30)' },
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
    description: 'GitHub CLI operations. Actions: pr_view, pr_list, pr_create, pr_comment, pr_review, pr_merge, pr_diff, issue_list, issue_view, issue_create, issue_comment, search, repo_view, run_list, run_view.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['pr_view', 'pr_list', 'pr_create', 'pr_comment', 'pr_review', 'pr_merge', 'pr_diff', 'issue_list', 'issue_view', 'issue_create', 'issue_comment', 'search', 'repo_view', 'run_list', 'run_view'],
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
            body: { type: 'string', description: 'Comment/PR body text' },
            base: { type: 'string', description: 'Base branch (for PR create)' },
            head: { type: 'string', description: 'Head branch (for PR create)' },
            action: { type: 'string', description: 'Review action: approve/comment/request-changes' },
            method: { type: 'string', description: 'Merge method: squash/rebase/merge' },
            type: { type: 'string', description: 'Search type: code/issues/prs' },
            query: { type: 'string', description: 'Search query' },
          },
          description: 'Action-specific arguments'
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'todo_write',
    description: 'Write or update task todos. Use to create task list at start, or update status during work.',
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
    name: 'skill',
    description: 'Invoke a skill to load its full instructions. Use when a skill description suggests it may apply to the current task. Calling this tool loads the complete SKILL.md content so you can follow it precisely.',
    parameters: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Skill name (e.g., brainstorming, systematic-debugging, using-superpowers)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'todo_read',
    description: 'Read current persisted tasks from .spica/tasks.json. Use to check existing tasks before adding new ones.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
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
    description: 'Run project-level linter/type checker. Auto-detects: TypeScript (tsc), ESLint, Go (golangci-lint), Python (pylint), Rust (clippy). Use after code changes to catch errors.',
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
    description: 'Run tests. Auto-detects: vitest, npm test, go test, pytest, cargo test. IMPORTANT: Run after code changes to verify functionality.',
    parameters: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', description: 'Pattern (optional)' },
        coverage: { type: 'boolean', description: 'Coverage (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'file_patch',
    description: 'Apply a unified diff patch to a file. Accepts full unified diff content with @@ hunk headers. Returns error if patch does not apply cleanly.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Target file path to patch' },
        patch: { type: 'string', description: 'Unified diff content with @@ hunks' },
      },
      required: ['path', 'patch'],
    },
  },
  {
    name: 'format',
    description: 'Format code using project formatter. Auto-detects: prettier (TS/JS), gofmt (Go), rustfmt (Rust), black (Python). Use after file edits to fix style.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File or directory to format (defaults to workspace root)' },
      },
      required: [],
    },
  },
];

// 获取所有工具定义（内置 + MCP动态 + 自定义工具 + 插件）
export function getAllToolDefinitions(): ToolDefinition[] {
  const mcpTools = getMCPManager().getToolDefinitions();
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
          const newPath = pathResolve(safeArgs.path);
          if (!await fs.pathExists(newPath)) {
            return { success: false, error: `Path does not exist: ${newPath}` };
          }
          WORKSPACE = newPath;
          return { success: true, output: `Workspace: ${WORKSPACE}` };
        }
        return { success: true, output: `Workspace: ${WORKSPACE}` };

      case 'file_read': {
        const readPath = resolvePath(safeArgs.path);
        const content = await fs.readFile(readPath, 'utf-8');
        const lines = content.split('\n');
        const lineCount = lines.length;

        // 简化输出：只显示文件路径和基本信息，内容放在 content 字段供 AI 使用
        if (safeArgs.offset || safeArgs.limit) {
          const start = safeArgs.offset ? safeArgs.offset - 1 : 0;
          const end = safeArgs.limit ? start + safeArgs.limit : lines.length;
          const selectedLines = lines.slice(start, end);
          return {
            success: true,
            output: `[${readPath}:${start + 1}-${end}] (${selectedLines.length} lines)`,
            content: selectedLines.join('\n')
          };
        }

        return {
          success: true,
          output: `[${readPath}] (${lineCount} lines)`,
          content: content
        };
      }

      case 'file_write': {
        const writePath = resolvePath(safeArgs.path);
        await fs.ensureDir(dirname(writePath));

        // 备份旧文件（如果存在）到 .spica/backups/
        let oldContentForBackup = '';
        try {
          oldContentForBackup = await fs.readFile(writePath, 'utf-8');
          if (oldContentForBackup !== safeArgs.content) {
            const backupDir = join(WORKSPACE, '.spica', 'backups');
            await fs.ensureDir(backupDir);
            const timestamp = Date.now();
            const safeName = safeArgs.path.replace(/[/\\]/g, '_');
            const backupPath = join(backupDir, `${timestamp}-${safeName}`);
            await fs.writeFile(backupPath, oldContentForBackup, 'utf-8');
          }
        } catch {
          // 新文件，无需备份
        }

        // 读取旧内容（如果存在）生成实际diff
        let diff = '';
        try {
          if (oldContentForBackup) {
            if (oldContentForBackup !== safeArgs.content) {
              const diffLines = computeDiff(oldContentForBackup, safeArgs.content);
              diff = formatDiff(diffLines, 3);
            }
          } else {
            const diffLines = computeDiff('', safeArgs.content);
            diff = formatDiff(diffLines, 2);
          }
        } catch {
          const diffLines = computeDiff('', safeArgs.content);
          diff = formatDiff(diffLines, 2);
        }

        await fs.writeFile(writePath, safeArgs.content, 'utf-8');

        // 自动语法检查
        const syntaxResult = await runSyntaxCheck(writePath);
        const syntaxWarning = formatSyntaxResult(syntaxResult, writePath);

        return {
          success: true,
          output: `Wrote ${writePath}${syntaxWarning}`,
          diff,
          syntaxErrors: syntaxResult.hasErrors ? syntaxResult.errors : undefined,
        };
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

        // 自动语法检查
        const syntaxResult = await runSyntaxCheck(editPath);
        const syntaxWarning = formatSyntaxResult(syntaxResult, editPath);

        return {
          success: true,
          output: `Edited ${editPath}${syntaxWarning}`,
          diff,
          syntaxErrors: syntaxResult.hasErrors ? syntaxResult.errors : undefined,
        };
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

        // 自动语法检查
        const syntaxResult = await runSyntaxCheck(editPath);
        const syntaxWarning = formatSyntaxResult(syntaxResult, editPath);

        return {
          success: true,
          output: `Edited ${editPath} (${editCount} changes)${syntaxWarning}`,
          diff: diffs.join('\n---\n'),
          syntaxErrors: syntaxResult.hasErrors ? syntaxResult.errors : undefined,
        };
      }

      case 'file_patch': {
        const patchPath = resolvePath(safeArgs.path);
        const patchText = String(safeArgs.patch || '');
        if (!patchText) return { success: false, error: 'Patch content is required' };

        const originalContent = await fs.readFile(patchPath, 'utf-8');

        // 备份旧文件
        try {
          const backupDir = join(WORKSPACE, '.spica', 'backups');
          await fs.ensureDir(backupDir);
          const timestamp = Date.now();
          const safeName = safeArgs.path.replace(/[/\\]/g, '_');
          const backupPath = join(backupDir, `${timestamp}-${safeName}`);
          await fs.writeFile(backupPath, originalContent, 'utf-8');
        } catch { /* 新文件无需备份 */ }

        const patchResult = applyUnifiedPatch(originalContent, patchText);
        if (!patchResult.success) {
          return { success: false, error: `Patch failed: ${patchResult.error}` };
        }

        await fs.writeFile(patchPath, patchResult.content!, 'utf-8');

        const patchDiff = computeDiff(originalContent, patchResult.content!);
        const patchDiffStr = formatDiff(patchDiff, 3);
        const patchSyntax = await runSyntaxCheck(patchPath);
        const patchSyntaxWarn = formatSyntaxResult(patchSyntax, patchPath);

        return {
          success: true,
          output: `Patched ${patchPath} (${patchResult.hunksApplied} hunks)${patchSyntaxWarn}`,
          diff: patchDiffStr,
          syntaxErrors: patchSyntax.hasErrors ? patchSyntax.errors : undefined,
        };
      }

      case 'format': {
        const target = safeArgs.path ? resolvePath(safeArgs.path) : WORKSPACE;
        const projectType = await detectProjectType(WORKSPACE);

        // Use array-based invocation to avoid shell injection
        const formatCmds: Record<string, { cmd: string; args: string[] }> = {
          typescript: { cmd: 'npx', args: ['prettier', '--write', target] },
          javascript: { cmd: 'npx', args: ['prettier', '--write', target] },
          python: { cmd: 'python', args: ['-m', 'black', target] },
          go: { cmd: 'gofmt', args: ['-w', target] },
          rust: { cmd: 'rustfmt', args: [target] },
        };

        const fmtConfig = formatCmds[projectType];
        if (!fmtConfig) {
          return { success: false, error: `No formatter for project type: ${projectType}` };
        }

        const fmtResult = await execa(fmtConfig.cmd, fmtConfig.args, {
          cwd: WORKSPACE,
          timeout: 30000,
          reject: false,
        });

        // For Python, try autopep8 as fallback
        if (projectType === 'python' && fmtResult.exitCode !== 0) {
          const fallbackResult = await execa('python', ['-m', 'autopep8', '--in-place', target], {
            cwd: WORKSPACE,
            timeout: 30000,
            reject: false,
          });
          return {
            success: fallbackResult.exitCode === 0,
            output: fallbackResult.stdout || 'Formatted successfully',
            error: fallbackResult.exitCode !== 0 ? fallbackResult.stderr : undefined,
          };
        }

        return {
          success: fmtResult.exitCode === 0,
          output: fmtResult.stdout || 'Formatted successfully',
          error: fmtResult.exitCode !== 0 ? fmtResult.stderr : undefined,
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
        const ignorePatterns = (safeArgs.ignore as string[]) || ['node_modules', '.git', 'dist', 'build', '*.lock'];
        const maxFiles = (safeArgs.maxFiles as number) || 100;
        
        const files = await fastGlob(safeArgs.pattern, {
          cwd: WORKSPACE,
          absolute: true,
          ignore: ignorePatterns,
        });
        
        const truncated = files.slice(0, maxFiles);
        return { 
          success: true, 
          output: files.length > 0 
            ? `Found ${files.length} files (showing ${truncated.length}):\n${truncated.join('\n')}`
            : 'No files found',
          content: truncated.join('\n'),
        };
      }

      case 'grep': {
        const grepPath = safeArgs.path ? resolvePath(safeArgs.path) : WORKSPACE;
        const includePattern = safeArgs.include || '*';
        const maxLines = (safeArgs.maxLines as number) || 100;
        
        try {
          const files = await fastGlob(includePattern, {
            cwd: grepPath,
            absolute: true,
            ignore: ['node_modules', '.git', 'dist', 'build', '*.lock'],
          });
          
          const regex = new RegExp(safeArgs.pattern, 'g');
          const matches: string[] = [];
          
          for (const file of files) {
            if (matches.length >= maxLines) break;
            
            try {
              const content = await fs.readFile(file, 'utf-8');
              const lines = content.split('\n');
              
              for (let i = 0; i < lines.length; i++) {
                if (matches.length >= maxLines) break;
                
                if (regex.test(lines[i])) {
                  const relativePath = file.replace(WORKSPACE, '').replace(/^\//, '');
                  matches.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
          
          return {
            success: true,
            output: matches.length > 0 
              ? `Found ${matches.length} matches:\n${matches.join('\n')}`
              : 'No matches found',
            content: matches.join('\n'),
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Grep failed: ${error.message}`,
          };
        }
      }

      case 'bash': {
        const command = String(safeArgs.command || '');
        if (!command) {
          return { success: false, error: 'Command is required' };
        }
        const timeout = safeArgs.timeout ? safeArgs.timeout * 1000 : 120000;
        const detached = safeArgs.detached === true;
        const interactive = safeArgs.interactive === true;
        const _autoRetry = safeArgs.autoRetry !== false;
        const maxOutputLength = (safeArgs.maxOutputLength as number) || 50000;
        let inputs = (safeArgs.inputs as string[]) || [];
        const inputFile = safeArgs.inputFile as string;
        const outputFile = safeArgs.outputFile as string;

        // 卡住检测阈值（默认30秒，可通过 stuckWarning 参数调整）
        const stuckWarningMs = (safeArgs.stuckWarning as number) || 60000;

        // Shell 注入检测 — 阻止高危 metacharacters
        const injectionPatterns = [
          { pattern: /\$\(/, name: 'command substitution $(...)' },
          { pattern: /`[^`]+`/, name: 'backtick command substitution' },
          { pattern: /\/dev\/tcp\//, name: 'bash network connection' },
          { pattern: /\|\s*(bash|sh|zsh|python|perl|ruby)\b/, name: 'piping to shell interpreter' },
          { pattern: /mkfifo/, name: 'named pipe creation' },
          { pattern: /\bnc\s+-[el]/, name: 'netcat listener' },
          { pattern: /;/, name: 'command separator' },
          { pattern: /&&/, name: 'AND operator' },
          { pattern: /\|\|/, name: 'OR operator' },
          { pattern: /\$\{/, name: 'variable expansion' },
          { pattern: /<<\s*/, name: 'heredoc' },
          { pattern: /\beval\b/, name: 'eval command' },
        ];
        for (const { pattern, name } of injectionPatterns) {
          if (pattern.test(command)) {
            return {
              success: false,
              error: `Blocked: command contains ${name}. This pattern is not allowed for security reasons.`,
            };
          }
        }

        try {
          // Read inputs from file if provided
          if (inputFile) {
            const inputPath = pathResolve(WORKSPACE, inputFile);
            if (!fs.existsSync(inputPath)) {
              return { success: false, error: `Input file not found: ${inputFile}` };
            }
            const fileContent = await fs.readFile(inputPath, 'utf-8');
            // Split by lines, each line is one input
            inputs = fileContent.split('\n').filter(line => line.length > 0);
          }

          // 交互式 PTY 模式：AI 可以输入/输出
          if (interactive) {
            const expect = (safeArgs.expect as Array<{ wait: string; input: string }>) || [];
            return await runInteractivePty(command, WORKSPACE, timeout, inputs, expect, maxOutputLength, outputFile, eventCallback);
          }

          // 分离模式：使用 tmux 运行（用户可 attach 查看）
          if (detached) {
            if (isWindows) {
              // Windows: 使用 PowerShell 启动后台进程并获取 PID
              const sessionId = `spica_${Date.now()}`;
              const psCommand = `
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c ${command.replace(/"/g, '""')}" -WindowStyle Hidden -PassThru;
Write-Output $proc.Id;
`;
              try {
                const result = await execa('powershell', ['-Command', psCommand], {
                  cwd: WORKSPACE,
                  timeout: 10000,
                  reject: false,
                });
                const pid = result.stdout.trim();
                return {
                  success: true,
                  output: `Started in detached mode (Windows).\nSession: ${sessionId}\nPID: ${pid || 'unknown'}\nCommand: ${command}\n\nTo monitor: Task Manager or PowerShell "Get-Process -Id ${pid}"\nTo kill: taskkill /PID ${pid} /F`,
                };
              } catch {
                // Fallback: 使用 start /B
                const escapedCmd = command.replace(/"/g, '\\"');
                await execa(`start /B cmd /c "${escapedCmd}"`, {
                  shell: true,
                  cwd: WORKSPACE,
                  timeout: 5000,
                  reject: false,
                });
                return {
                  success: true,
                  output: `Started in detached mode (Windows background).\nCommand: ${command}\n\nNote: Process runs in background. Use Task Manager to monitor.`,
                };
              }
            }

            const sessionId = `spica_${Date.now()}`;
            const escapedCommand = command.replace(/'/g, "'\\''");

            const actualCommand = `tmux new-session -d -s ${sessionId} '${escapedCommand}' 2>/dev/null || screen -dmS ${sessionId} ${escapedCommand} 2>/dev/null || (${escapedCommand} &)`;

            await execa(actualCommand, {
              shell: true,
              cwd: WORKSPACE,
              timeout: 5000,
              reject: false,
            });

            return {
              success: true,
              output: `Started in detached mode.\nSession: ${sessionId}\n\nTo view:\n  tmux attach -t ${sessionId}\n  # or: screen -r ${sessionId}\n\nTo kill:\n  tmux kill-session -t ${sessionId}\n  # or: screen -S ${sessionId} -X quit`,
            };
          }

          const actualCommand = command;

          // 创建 AbortController 用于卡住检测和中断（优先使用 agent 传入的 signal）
          const externalSignal = safeArgs._abortSignal as AbortSignal | undefined;
          const abortController = externalSignal
            ? new AbortController()
            : new AbortController();

          // 如果有外部 signal，监听它的 abort 事件
          if (externalSignal) {
            if (externalSignal.aborted) {
              abortController.abort();
            } else {
              externalSignal.addEventListener('abort', () => {
                abortController.abort();
              });
            }
          }

// 设置卡住警告定时器 - 触发自动中断和重试
          let stuckWarningSent = false;
          let stuckWarningTimer: NodeJS.Timeout | null = setTimeout(() => {
            if (!stuckWarningSent) {
              stuckWarningSent = true;
              abortController.abort();
            }
          }, stuckWarningMs);

          try {
            // 执行命令
            const bashResult = await execa(actualCommand, {
              shell: true,
              cwd: WORKSPACE,
              timeout: timeout,
              reject: false,
              cancelSignal: abortController.signal,
            });

            // 清除卡住警告定时器（无论成功或失败都要清除）
            if (stuckWarningTimer) {
              clearTimeout(stuckWarningTimer);
              stuckWarningTimer = null;
            }

            // 检查是否超时或被中断
            if (bashResult.timedOut || abortController.signal.aborted) {
              return {
                success: false,
                error: `Command timeout after ${timeout / 1000}s. Try using detached=true for long-running commands.`,
              };
            }
            // 合并stdout和stderr显示完整输出
            const fullOutput = (bashResult.stdout + '\n' + bashResult.stderr).trim();
            // 截断超长输出（防止内存溢出）
            const truncateOutput = (text: string, maxLen: number): string => {
              if (text.length <= maxLen) return text;
              return text.slice(0, maxLen) + `\n... [truncated, total ${text.length} chars]`;
            };
            const output = truncateOutput(fullOutput, maxOutputLength);

            // Write output to file if provided
            if (outputFile) {
              const outputPath = pathResolve(WORKSPACE, outputFile);
              await fs.writeFile(outputPath, fullOutput, 'utf-8');
              return {
                success: bashResult.exitCode === 0,
                output: `Output written to ${outputFile} (${fullOutput.length} chars)`,
                error: bashResult.exitCode !== 0 ? output : undefined,
              };
            }

            return {
              success: bashResult.exitCode === 0,
              output: bashResult.exitCode === 0 ? output : undefined,
              error: bashResult.exitCode !== 0 ? output : undefined,
            };
          } catch (bashError: any) {
            // 清除卡住警告定时器（异常时也要清除）
            if (stuckWarningTimer) {
              clearTimeout(stuckWarningTimer);
            }
            // 捕获超时错误
            if (bashError.message?.includes('timed out') || bashError.name === 'TimedOutError') {
              return { success: false, error: `Timeout after ${timeout / 1000}s` };
            }
            return { success: false, error: bashError.message };
          }
        } catch (outerError: any) {
          return { success: false, error: outerError.message };
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
            
            // 安全检查：检测未提交更改
            const status = await git.status();
            if (status.files.length > 0) {
              // 不直接执行，返回教育性错误让AI决定如何处理
              const fileList = status.files.slice(0, 10).map(f => f.path).join('\n');
              return {
                success: false,
                error: `未提交更改存在 (${status.files.length} files)，切换分支将丢失工作。\n建议安全操作顺序：\n1. git action:stash (保存当前工作)\n2. git action:checkout (安全切换)\n3. git action:stash_pop (恢复工作)\n\n或者提交当前工作：\n1. git action:add files:. (添加所有文件)\n2. git action:commit message:"work in progress" (提交)\n3. git action:checkout (安全切换)\n\n受影响文件：\n${fileList}${status.files.length > 10 ? '\n... 更多文件' : ''}`,
                filesAtRisk: status.files.map(f => f.path),
                safetyMode: 'protected'
              };
            }
            
            // 安全：可以切换分支
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
            // 安全检查：所有reset模式都需要检查未提交更改
            const status = await git.status();
            const mode = args.mode || 'mixed';
            
            if (status.files.length > 0 && (mode === 'hard' || mode === 'mixed')) {
              const fileList = status.files.slice(0, 10).map(f => f.path).join('\n');
              const warningMsg = mode === 'hard' 
                ? `Reset --hard 将永久丢失 ${status.files.length} 个文件的所有更改！`
                : `Reset --mixed 将取消 ${status.files.length} 个文件的暂存状态`;
              
              return {
                success: false,
                error: `${warningMsg}\n建议安全操作：\n1. git action:stash (保存工作)\n2. git action:reset mode:${mode} (执行reset)\n3. 如需恢复：git action:stash_pop\n\n受影响文件：\n${fileList}${status.files.length > 10 ? '\n... 更多文件' : ''}\n\n如确认继续，请明确说明：用户已确认reset操作`,
                filesAtRisk: status.files.map(f => f.path),
                safetyMode: 'protected',
                requiresUserConfirmation: true
              };
            }
            
            // 执行reset（已确认安全或clean状态）
            await git.reset(mode);
            return { success: true, output: `Reset (${mode}) completed safely` };
          }
          case 'stash': {
            const stashAction = args.stash_action || 'push';
            
            if (stashAction === 'push' || stashAction === 'save') {
              const message = args.message || `spica-auto-backup-${Date.now()}`;
              await git.stash({ message } as any);
              return { success: true, output: `Stashed: ${message}` };
            } else if (stashAction === 'pop') {
              await execa('git stash pop', { shell: true, cwd: WORKSPACE });
              return { success: true, output: 'Stash restored' };
            } else if (stashAction === 'apply') {
              await execa('git stash apply', { shell: true, cwd: WORKSPACE });
              return { success: true, output: 'Stash applied' };
            } else if (stashAction === 'list') {
              const stashList = await git.stashList();
              return { success: true, output: stashList.all.map(s => `${s.hash.substring(0,7)} ${s.message}`).join('\n') || 'No stashes' };
            } else if (stashAction === 'drop') {
              await execa('git stash drop', { shell: true, cwd: WORKSPACE });
              return { success: true, output: 'Stash dropped' };
            }
            
            return { success: false, error: `Unknown stash action: ${stashAction}` };
          }
          case 'checkpoint_restore': {
            // 查找最近的SPICA-CHECKPOINT commit
            const log = await git.log({ maxCount: 20 });
            const checkpoint = log.all.find(c => c.message.includes('[SPICA-CHECKPOINT]'));
            
            if (!checkpoint) {
              return { 
                success: false, 
                error: '没有找到checkpoint。建议：\n1. git action:log (查看历史)\n2. git action:reset mode:hard (手动恢复到某个commit)'
              };
            }
            
            // 检查当前是否有未保存工作
            const currentStatus = await git.status();
            if (currentStatus.files.length > 0) {
              return {
                success: false,
                error: `当前有 ${currentStatus.files.length} 个未保存更改。\n建议先处理：\n1. git action:stash (保存当前工作)\n2. git action:reset mode:hard (恢复checkpoint)\n3. git action:stash_pop (恢复之前工作)`
              };
            }
            
            // 安全恢复到checkpoint
            await git.reset(['--hard', checkpoint.hash]);
            return { 
              success: true, 
              output: `Restored to checkpoint: ${checkpoint.hash.substring(0,7)}\nMessage: ${checkpoint.message}\nTime: ${checkpoint.date}`
            };
          }
          default:
            return { success: false, error: `Unknown git action: ${action}` };
        }
      }

      case 'web_search': {
        const timeoutMs = (safeArgs.timeout || 30) * 1000;
        const engine = safeArgs.engine || 'duckduckgo';

        // 创建 AbortController
        const externalSignal = safeArgs._abortSignal as AbortSignal | undefined;
        const abortController = new AbortController();

        if (externalSignal) {
          if (externalSignal.aborted) {
            abortController.abort();
          } else {
            externalSignal.addEventListener('abort', () => {
              abortController.abort();
            });
          }
        }

        // Check for Tavily API key
        const tavilyApiKey = process.env.TAVILY_API_KEY;

        try {
          // Tavily API (preferred if configured)
          if (engine === 'tavily' && tavilyApiKey) {
            try {
              const tavilyResp = await axios.post('https://api.tavily.com/search', {
                api_key: tavilyApiKey,
                query: safeArgs.query,
                search_depth: 'basic',
                max_results: 10,
              }, {
                timeout: timeoutMs,
                signal: abortController.signal,
              });

              const data = tavilyResp.data;
              if (data.results && data.results.length > 0) {
                const results = data.results.map((r: any) => `- ${r.title}\n  ${r.url}\n  ${r.content?.slice(0, 100) || ''}`);
                return { success: true, output: `Tavily搜索结果 (${results.length}个):\n\n${results.join('\n\n')}` };
              }
            } catch {
              // Tavily failed, fallback to DuckDuckGo
            }
          }

          // DuckDuckGo HTML (default, free)
          const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(safeArgs.query)}`;

          const searchResp = await axios.get(searchUrl, {
            timeout: Math.min(timeoutMs, 15000),
            signal: abortController.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html',
            },
            maxRedirects: 5,
          });

          if (abortController.signal.aborted) {
            return { success: false, error: 'Tool execution aborted by user (ESC ESC).' };
          }

          const html = searchResp.data || '';
          if (typeof html !== 'string' || html.length === 0) {
            return {
              success: true,
              output: `Web search temporarily unavailable. Agent should proceed with available information.`,
            };
          }

          // Parse HTML to extract results
          const results: string[] = [];

          // DuckDuckGo HTML format
          const titleMatches = html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g);
          for (const match of titleMatches) {
            const url = match[1];
            const title = match[2].trim();
            const actualUrl = url.includes('uddg=') ? decodeURIComponent(url.split('uddg=')[1].split('&')[0]) : url;
            results.push(`- ${title}\n  ${actualUrl}`);
            if (results.length >= 10) break;
          }

          // Fallback parsing if no results
          if (results.length === 0) {
            const fallbackMatches = html.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]{3,50})<\/a>/g);
            for (const match of fallbackMatches) {
              const url = match[1];
              const title = match[2].trim();
              if (!url.includes('duckduckgo.com') && title.length > 3) {
                results.push(`- ${title}\n  ${url}`);
                if (results.length >= 10) break;
              }
            }
          }

          const output = results.length > 0
            ? `DuckDuckGo搜索结果 (${results.length}个):\n\n${results.join('\n\n')}`
            : `搜索完成但未找到有效结果。\n提示: 设置 TAVILY_API_KEY 可获得更好的搜索体验。\n原始输出:\n${html.substring(0, 1000)}`;

          return { success: true, output };
        } catch (searchError: any) {
          if (abortController.signal.aborted || searchError.code === 'ERR_CANCELED' || searchError.message?.includes('abort')) {
            return { success: false, error: 'Tool execution aborted by user (ESC ESC).' };
          }
          return { success: false, error: searchError.message };
        }
      }

      case 'web_fetch': {
        const timeoutMs = (safeArgs.timeout || 30) * 1000;
        const url = safeArgs.url as string;

        try {
          validateUrl(url);
        } catch (e: any) {
          return { success: false, error: e.message };
        }

        // 创建 AbortController（支持 ESC ESC 中断）
        const externalSignal = safeArgs._abortSignal as AbortSignal | undefined;
        const abortController = externalSignal ? new AbortController() : new AbortController();

        if (externalSignal) {
          if (externalSignal.aborted) {
            abortController.abort();
          } else {
            externalSignal.addEventListener('abort', () => {
              abortController.abort();
            });
          }
        }

        try {
          const fetchResp = await axios.get(url, {
            timeout: timeoutMs,
            signal: abortController.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Cache-Control': 'no-cache',
            },
            maxRedirects: 10,
            responseType: 'text',
          });

          // 检查是否被中断
          if (abortController.signal.aborted) {
            return {
              success: false,
              error: 'Tool execution aborted by user (ESC ESC).'
            };
          }

          const html = fetchResp.data || '';
          if (typeof html !== 'string' || html.length === 0) {
            return {
              success: false,
              error: 'Fetch failed: No content received.'
            };
          }

          // 检查是否被拦截 (Cloudflare 等)
          if (html.includes('Just a moment') || html.includes('Checking your browser') || html.includes('cf-browser-verification')) {
            return {
              success: false,
              error: '被 Cloudflare 或类似防护拦截。建议：\n1. 设置 HTTPS_PROXY 环境变量使用代理\n2. 尝试其他来源\n3. 使用 web_search 搜索替代信息',
            };
          }

          // 提取主要内容（简化 HTML）
          let content = html;

          // 移除 script, style, nav, footer, header 等无关内容
          content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
          content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
          content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
          content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

          // 提取 title
          const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : '';

          // 提取 body 内容
          const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          let body = bodyMatch ? bodyMatch[1] : content;

          // 简化：提取文本内容
          body = body.replace(/<[^>]+>/g, ' ');
          body = body.replace(/\s+/g, ' ').trim();

          // 截取主要内容（最多 10000 字符）
          const maxLen = 10000;
          if (body.length > maxLen) {
            body = body.substring(0, maxLen) + '\n... [truncated]';
          }

          const output = title ? `标题: ${title}\n\n内容:\n${body}` : body;

          return { success: true, output };
        } catch (fetchError: any) {
          // 检查是否是中断导致的错误
          if (abortController.signal.aborted || fetchError.code === 'ERR_CANCELED' || fetchError.message?.includes('abort')) {
            return { success: false, error: 'Tool execution aborted by user (ESC ESC).' };
          }
          return { success: false, error: fetchError.message };
        }
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
            const ghArgs = ['pr', 'view'];
            if (args.number) ghArgs.push(String(args.number));
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'pr_list': {
            const state = args.state || 'open';
            const limit = args.limit || 20;
            const ghResult = await execa('gh', ['pr', 'list', '--state', state, '--limit', String(limit)], { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No PRs found' };
          }
          case 'pr_create': {
            const title = args.title || '';
            const body = args.body || '';
            const base = args.base || 'main';
            const head = args.head || '';
            if (!title) return { success: false, error: 'Title required' };
            const ghArgs = ['pr', 'create', '--title', title, '--body', body, '--base', base];
            if (head) ghArgs.push('--head', head);
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'issue_list': {
            const state = args.state || 'open';
            const limit = args.limit || 20;
            const ghArgs = ['issue', 'list', '--state', state, '--limit', String(limit)];
            if (args.label) ghArgs.push('--label', args.label);
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No issues found' };
          }
          case 'issue_view': {
            const ghArgs = ['issue', 'view'];
            if (args.number) ghArgs.push(String(args.number));
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'issue_create': {
            const title = args.title || '';
            const body = args.body || '';
            if (!title) return { success: false, error: 'Title required' };
            const ghResult = await execa('gh', ['issue', 'create', '--title', title, '--body', body], { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'repo_view': {
            const ghResult = await execa('gh', ['repo', 'view'], { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'Not in a GitHub repository' };
          }
          case 'run_list': {
            const limit = args.limit || 10;
            const ghResult = await execa('gh', ['run', 'list', '--limit', String(limit)], { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No workflow runs found' };
          }
          case 'run_view': {
            const ghArgs = ['run', 'view'];
            if (args.number) ghArgs.push(String(args.number));
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || ghResult.stderr };
          }
          case 'pr_comment': {
            if (!args.number) return { success: false, error: 'PR number required' };
            const ghArgs = ['pr', 'comment', String(args.number)];
            if (args.body) ghArgs.push('--body', args.body);
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'Comment posted' };
          }
          case 'pr_review': {
            if (!args.number) return { success: false, error: 'PR number required' };
            const reviewAction = args.action || 'comment';
            const ghArgs = ['pr', 'review', String(args.number), `--${reviewAction}`];
            if (args.body) ghArgs.push('--body', args.body);
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || `Review (${reviewAction}) submitted` };
          }
          case 'pr_merge': {
            if (!args.number) return { success: false, error: 'PR number required' };
            const mergeMethod = args.method || 'squash';
            const ghArgs = ['pr', 'merge', String(args.number), `--${mergeMethod}`];
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || `PR merged (${mergeMethod})` };
          }
          case 'pr_diff': {
            if (!args.number) return { success: false, error: 'PR number required' };
            const ghResult = await execa('gh', ['pr', 'diff', String(args.number)], { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No diff' };
          }
          case 'issue_comment': {
            if (!args.number) return { success: false, error: 'Issue number required' };
            const ghArgs = ['issue', 'comment', String(args.number)];
            if (args.body) ghArgs.push('--body', args.body);
            const ghResult = await execa('gh', ghArgs, { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'Comment posted' };
          }
          case 'search': {
            const searchType = args.type || 'code';
            const searchQuery = args.query || '';
            if (!searchQuery) return { success: false, error: 'Search query required' };
            const searchLimit = args.limit || 10;
            const ghResult = await execa('gh', ['search', searchType, searchQuery, '--limit', String(searchLimit)], { cwd: WORKSPACE, timeout, reject: false });
            return { success: ghResult.exitCode === 0, output: ghResult.stdout || 'No results' };
          }
          default:
            return { success: false, error: `Unknown gh action: ${action}` };
        }
      }

      case 'skill': {
        const { loadSkills } = await import('../skills/index');
        const skills = loadSkills(WORKSPACE);
        const skillName = String(safeArgs.name || '');

        if (!skillName) {
          return {
            success: false,
            error: `Skill name required. Available skills: ${Array.from(skills.keys()).join(', ')}`,
          };
        }

        const skill = skills.get(skillName);
        if (!skill) {
          return {
            success: false,
            error: `Skill "${skillName}" not found. Available skills: ${Array.from(skills.keys()).join(', ')}`,
          };
        }

        const skillContent = skill.promptTemplate || '';

        // Find skill references in loaded skill content
        const allSkillNames = Array.from(skills.keys());
        const referencedSkills: string[] = [];
        const lowerContent = skillContent.toLowerCase();

        for (const name of allSkillNames) {
          if (name === skillName) continue;
          if (
            lowerContent.includes(`superpowers:${name}`) ||
            lowerContent.includes(`skill(name="${name}")`) ||
            lowerContent.includes(`skill(name='${name}')`) ||
            lowerContent.includes(`use the \`${name}\` skill`) ||
            lowerContent.includes(`use ${name}`) ||
            lowerContent.includes(`invoke ${name}`)
          ) {
            referencedSkills.push(name);
          }
        }

        return {
          success: true,
          output: `Skill: ${skill.name}\nDescription: ${skill.description}\n\n${skillContent}`,
          referencedSkills: [...new Set(referencedSkills)],
        };
      }

      case 'todo_read': {
        const { loadPersistedTasks, getTaskStats } = await import('../storage/taskPersistence');
        const tasks = loadPersistedTasks(WORKSPACE);
        const stats = getTaskStats(WORKSPACE);

        if (tasks.length === 0) {
          return { success: true, output: 'No persisted tasks found. Use todo_write to create tasks.' };
        }

        const statusLabels: Record<string, string> = {
          'completed': '[DONE]',
          'in_progress': '[ACTV]',
          'pending': '[PEND]',
        };

        const lines = [`\nPersisted Tasks (${stats.completed}/${stats.total} done)`];
        lines.push('---------------------------------');
        tasks.forEach((t: any, i: number) => {
          const label = statusLabels[t.status] || '[PEND]';
          lines.push(`${label} ${i+1}. ${t.subject}`);
        });
        lines.push('---------------------------------');
        lines.push('Use todo_write to update or add new tasks.');

        return { success: true, output: lines.join('\n') };
      }

      case 'todo_write': {
        const todos = safeArgs.todos || [];
        const total = todos.length;
        const completed = todos.filter((t: any) => t.status === 'completed').length;
        const inProgress = todos.filter((t: any) => t.status === 'in_progress').length;
        const pending = todos.filter((t: any) => t.status === 'pending').length;

        // Persist todos to .spica/tasks.json
        const { savePersistedTasks } = await import('../storage/taskPersistence');
        const persistedTasks = todos.map((t: any, i: number) => ({
          id: `task_${i + 1}`,
          subject: t.content,
          description: t.content,
          status: t.status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        savePersistedTasks(WORKSPACE, persistedTasks);

        const statusLabels: Record<string, string> = {
          'completed': '[DONE]',
          'in_progress': '[ACTV]',
          'pending': '[PEND]',
        };

        const lines = [`\nTask List (${completed}/${total} done, ${inProgress} active, ${pending} pending)`];
        lines.push('---------------------------------');
        todos.forEach((t: any, i: number) => {
          const label = statusLabels[t.status] || '[PEND]';
          lines.push(`${label} ${i+1}. ${t.content}`);
        });
        lines.push('---------------------------------');
        lines.push('(Saved to .spica/tasks.json)');

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
          
          // 设置工具白名单（限制subagent权限，避免context pollution）
          if (config.allowedTools !== '*') {
            taskAgent.setToolWhitelist(config.allowedTools);
          }

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
        // MCP 工具（格式：servername/toolname）
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
  const resolved = isAbsolute(path) ? path : pathResolve(WORKSPACE, path);
  const realWorkspace = fs.realpathSync(pathResolve(WORKSPACE));

  function isOutside(p: string): boolean {
    return !p.startsWith(realWorkspace) && !p.startsWith(pathResolve(realWorkspace));
  }

  let realPath: string;
  try {
    realPath = fs.realpathSync(resolved);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      try {
        const lst = fs.lstatSync(resolved);
        if (lst.isSymbolicLink()) {
          const linkTarget = fs.readlinkSync(resolved);
          const resolvedTarget = isAbsolute(linkTarget)
            ? linkTarget
            : pathResolve(dirname(resolved), linkTarget);
          let realTarget: string;
          try {
            realTarget = fs.realpathSync(resolvedTarget);
            if (isOutside(realTarget)) {
              // eslint-disable-next-line preserve-caught-error -- caught below as _e and re-thrown
              throw new Error('Access denied: symlink points outside workspace');
            }
          } catch (_e) {
            if (_e instanceof Error && _e.message.includes('Access denied')) throw _e;
            const targetParent = dirname(resolvedTarget);
            try {
              const realTargetParent = fs.realpathSync(targetParent);
              const fullPath = pathResolve(realTargetParent, basename(resolvedTarget));
              if (isOutside(fullPath)) {
                throw new Error('Access denied: symlink points outside workspace', { cause: _e });
              }
            } catch (_e2) {
              if (isOutside(pathResolve(resolvedTarget))) {
                throw new Error('Access denied: symlink points outside workspace', { cause: _e2 });
              }
            }
            return resolved;
          }
          return resolved;
        }
      } catch (lstErr: any) {
        if (lstErr.message?.includes('Access denied')) throw lstErr;
      }

      const parent = dirname(resolved);
      let realParent: string;
      try {
        realParent = fs.realpathSync(parent);
        if (isOutside(realParent)) {
          // eslint-disable-next-line preserve-caught-error -- caught below and re-thrown
          throw new Error(`Access denied: path "${path}" is outside workspace`);
        }
      } catch (parentErr: any) {
        if (parentErr.message?.includes('Access denied')) throw parentErr;
        throw new Error(`Access denied: cannot resolve path "${path}"`, { cause: parentErr });
      }
      return resolved;
    }
    throw err;
  }

  if (isOutside(realPath)) {
    throw new Error('Access denied: symlink points outside workspace');
  }

  return resolved;
}

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    throw new Error(`Access denied: requests to localhost are not allowed`);
  }

  // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      throw new Error(`Access denied: requests to private IP ranges are not allowed`);
    }
    // Block cloud metadata endpoint
    if (a === 169 && b === 254) {
      throw new Error(`Access denied: requests to link-local addresses are not allowed`);
    }
  }

  // Block non-http protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Access denied: only http/https URLs are allowed`);
  }
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

// 根据文件扩展名检测语言类型
function detectFileType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'mts': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'kt': 'kotlin',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
  };
  return typeMap[ext] || 'unknown';
}

// 语法检查结果接口
interface SyntaxCheckResult {
  hasErrors: boolean;
  errors: string[];
  warnings: string[];
}

// 对单个文件进行语法检查
async function runSyntaxCheck(filePath: string): Promise<SyntaxCheckResult> {
  const result: SyntaxCheckResult = { hasErrors: false, errors: [], warnings: [] };
  const fileType = detectFileType(filePath);
  const absolutePath = resolvePath(filePath);

  // 如果文件不存在，跳过检查
  if (!await fs.pathExists(absolutePath)) {
    return result;
  }

  // 检查是否在项目目录下（有 package.json 或 tsconfig.json）
  const isProjectFile = await fs.pathExists(join(WORKSPACE, 'package.json')) ||
                        await fs.pathExists(join(WORKSPACE, 'tsconfig.json'));

  try {
    switch (fileType) {
      case 'typescript': {
        // TypeScript: 优先使用项目级别的 tsc
        if (isProjectFile) {
          // 在项目目录下运行 tsc
          const checkResult = await execa('npx tsc --noEmit --skipLibCheck', {
            shell: true,
            cwd: WORKSPACE,
            timeout: 30000,
            reject: false,
          });
          const output = (checkResult.stdout || '') + '\n' + (checkResult.stderr || '');
          if (output.trim()) {
            const lines = output.split('\n').filter(l => l.includes('error'));
            for (const line of lines) {
              if (line.includes(filePath) || line.includes('error TS')) {
                result.errors.push(line.trim());
                result.hasErrors = true;
              }
            }
          }
        } else {
          // 非项目文件：使用简单的括号匹配检查
          const content = await fs.readFile(absolutePath, 'utf-8');
          const bracketErrors = checkBracketMatching(content, filePath);
          if (bracketErrors.length > 0) {
            result.errors.push(...bracketErrors);
            result.hasErrors = true;
          }
        }
        break;
      }

      case 'javascript': {
        // JavaScript: 使用 node --check 进行语法检查
        const nodeCheck = await execa(`node --check "${absolutePath}" 2>&1`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 10000,
          reject: false,
        });
        if (nodeCheck.exitCode !== 0) {
          const errorOutput = nodeCheck.stderr || nodeCheck.stdout;
          if (errorOutput && errorOutput.includes('SyntaxError')) {
            result.errors.push(errorOutput);
            result.hasErrors = true;
          }
        }
        break;
      }

      case 'python': {
        // Python: 使用 python3 -m py_compile
        const pyCheck = await execa(`python3 -m py_compile "${absolutePath}" 2>&1`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 15000,
          reject: false,
        });
        if (pyCheck.exitCode !== 0) {
          const errorOutput = pyCheck.stderr || pyCheck.stdout;
          if (errorOutput && (errorOutput.includes('SyntaxError') || errorOutput.includes('IndentationError'))) {
            result.errors.push(errorOutput);
            result.hasErrors = true;
          }
        }
        break;
      }

      case 'go': {
        // Go: 使用 gofmt -l 检查格式（比 go vet 更可靠）
        const gofmt = await execa(`gofmt -l "${absolutePath}" 2>&1`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 5000,
          reject: false,
        });
        if (gofmt.exitCode !== 0 && gofmt.stderr) {
          result.errors.push(gofmt.stderr);
          result.hasErrors = true;
        }
        // go vet 可能会报告问题
        const goVet = await execa(`go vet "${absolutePath}" 2>&1 || true`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 15000,
          reject: false,
        });
        if (goVet.stdout && goVet.stdout.includes('error')) {
          result.warnings.push(goVet.stdout);
        }
        break;
      }

      case 'rust': {
        // Rust: 使用 rustfmt --check
        const rustfmt = await execa(`rustfmt --check "${absolutePath}" 2>&1 || true`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 15000,
          reject: false,
        });
        if (rustfmt.exitCode !== 0 && rustfmt.stdout) {
          result.warnings.push(`格式不符合 rustfmt 规范`);
        }
        break;
      }

      case 'shell': {
        // Shell: 使用 bash -n 进行语法检查（Windows 下跳过）
        if (isWindows) {
          result.warnings.push('Shell syntax check not available on Windows');
          break;
        }
        const shellCheck = await execa(`bash -n "${absolutePath}" 2>&1`, {
          shell: true,
          cwd: WORKSPACE,
          timeout: 5000,
          reject: false,
        });
        if (shellCheck.exitCode !== 0) {
          const errorOutput = shellCheck.stderr || shellCheck.stdout;
          if (errorOutput) {
            result.errors.push(errorOutput);
            result.hasErrors = true;
          }
        }
        break;
      }

      default:
        // 未知文件类型，跳过检查
        break;
    }
  } catch (error: any) {
    // 语法检查失败不应阻止文件操作，只记录警告
    result.warnings.push(`语法检查失败: ${error.message}`);
  }

  return result;
}

// 简单的括号匹配检查（用于非项目文件）
function checkBracketMatching(content: string, filePath: string): string[] {
  const errors: string[] = [];
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const openBrackets = new Set(['(', '[', '{']);
  const closeBrackets = new Set([')', ']', '}']);
  const lines = content.split('\n');

  let inString: string | false = false;
  let inComment = false;
  let inMultiLineComment = false;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      // 处理字符串
      if ((char === '"' || char === "'" || char === '`') && !inComment && !inMultiLineComment) {
        if (!inString) {
          inString = char;
        } else if (inString === char && (i === 0 || line[i - 1] !== '\\')) {
          inString = false;
        }
        i++;
        continue;
      }

      // 处理注释
      if (!inString) {
        if (char === '/' && nextChar === '/' && !inMultiLineComment) {
          inComment = true;
          break;
        }
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true;
          i += 2;
          continue;
        }
        if (char === '*' && nextChar === '/' && inMultiLineComment) {
          inMultiLineComment = false;
          i += 2;
          continue;
        }
      }

      if (!inString && !inComment && !inMultiLineComment) {
        if (openBrackets.has(char)) {
          stack.push({ char, line: lineNum + 1 });
        } else if (closeBrackets.has(char)) {
          if (stack.length === 0) {
            errors.push(`${filePath}:${lineNum + 1}: 多余的闭合括号 '${char}'`);
          } else {
            const top = stack.pop()!;
            if (pairs[top.char] !== char) {
              errors.push(`${filePath}:${lineNum + 1}: 括号不匹配，期望 '${pairs[top.char]}' 但得到 '${char}'`);
            }
          }
        }
      }

      i++;
    }
    inComment = false; // 单行注释在行末结束
  }

  // 检查未闭合的括号
  for (const item of stack) {
    errors.push(`${filePath}:${item.line}: 未闭合的括号 '${item.char}'`);
  }

  return errors;
}

// 格式化语法检查结果
function formatSyntaxResult(result: SyntaxCheckResult, filePath: string): string {
  const lines: string[] = [];

  if (result.hasErrors) {
    lines.push(`\n⚠️  语法错误检测到 (${filePath}):`);
    result.errors.slice(0, 5).forEach(err => {
      lines.push(`  ❌ ${err}`);
    });
    if (result.errors.length > 5) {
      lines.push(`  ... 还有 ${result.errors.length - 5} 个错误`);
    }
    lines.push('\n请修复上述错误后再继续。');
  }

  if (result.warnings.length > 0) {
    lines.push(`\n💡 提示 (${filePath}):`);
    result.warnings.slice(0, 3).forEach(warn => {
      lines.push(`  ⚠️ ${warn}`);
    });
  }

  return lines.join('\n');
}

// 交互式 PTY 执行（支持 AI 输入/输出）
async function runInteractivePty(
  command: string,
  cwd: string,
  timeout: number,
  inputs: string[],
  expect: Array<{ wait: string; input: string }>,
  maxOutputLength: number,
  outputFile?: string,
  eventCallback?: (event: string, data: any) => void
): Promise<ToolResult> {
  let pty: typeof import('node-pty');
  try {
    pty = await import('node-pty');
  } catch {
    return { success: false, error: 'node-pty not available. Install with: npm install node-pty (requires native build tools).' };
  }

  return new Promise((resolve) => {
    // 创建 PTY（通过 shell 执行，支持 cd、&& 等语法）
    const bashPath = getBashPath();
    const shell = bashPath || (isWindows ? process.env.COMSPEC || 'cmd.exe' : '/bin/bash');
    const shellArgs = bashPath ? ['-c', command] : (isWindows ? ['/c', command] : ['-c', command]);

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: cwd,
      env: process.env as { [key: string]: string },
    });

    let output = '';
    let inputIndex = 0;
    let expectIndex = 0;
    let resolved = false;

    // 监听输出（使用 onData）
    ptyProcess.onData((data: string) => {
      output += data;

      // 发送事件给 UI（实时显示）
      if (eventCallback) {
        eventCallback('pty_output', { data });
      }

      // 检查 expect 匹配
      if (expect.length > 0 && expectIndex < expect.length) {
        const currentExpect = expect[expectIndex];
        // 支持正则表达式匹配（如果 wait 以 ^ 开头）
        const isRegex = currentExpect.wait.startsWith('^');
        const matched = isRegex
          ? new RegExp(currentExpect.wait).test(output)
          : output.includes(currentExpect.wait);

        if (matched) {
          ptyProcess.write(currentExpect.input + '\n');
          expectIndex++;
        }
      }
    });

    // 监听结束（使用 onExit）
    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (!resolved) {
        resolved = true;
        // 等待确保所有输出被捕获（嵌套 shell 需要更长延迟）
        const delay = command.includes('bash') && command.includes('-c') ? 300 : 150;
        setTimeout(async () => {
          // 截断超长输出
          const truncateOutput = (text: string, maxLen: number): string => {
            if (text.length <= maxLen) return text;
            return text.slice(0, maxLen) + `\n... [truncated, total ${text.length} chars]`;
          };

          // Write to file if outputFile provided
          if (outputFile) {
            const outputPath = pathResolve(cwd, outputFile);
            await fs.writeFile(outputPath, output.trim(), 'utf-8');
            resolve({
              success: exitCode === 0,
              output: `Output written to ${outputFile} (${output.length} chars)`,
              error: exitCode !== 0 ? truncateOutput(output.trim(), maxOutputLength) : undefined,
            });
            return;
          }

          const finalOutput = truncateOutput(output.trim(), maxOutputLength);
          resolve({
            success: exitCode === 0,
            output: exitCode === 0 ? finalOutput : undefined,
            error: exitCode !== 0 ? finalOutput : undefined,
          });
        }, delay);
      }
    });

    // 发送预定义输入（按时间间隔，优化延迟）
    if (inputs.length > 0) {
      // 根据输入数量动态调整间隔（大量输入时更快）
      const inputDelay = inputs.length > 20 ? 50 : 200;  // ms

      const sendInputs = () => {
        if (inputIndex < inputs.length && !resolved) {
          // 特殊处理：Ctrl+D 直接发送（不加换行）
          const input = inputs[inputIndex];
          if (input === '\x04') {
            ptyProcess.write('\x04');
          } else {
            ptyProcess.write(input + '\n');
          }
          inputIndex++;
          setTimeout(sendInputs, inputDelay);
        }
      };
      // 根据命令复杂度决定初始延迟
      const initialDelay = command.includes('cat') ? 500 : 1000;
      setTimeout(sendInputs, initialDelay);
    }

    // 超时处理
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ptyProcess.write('\x03');  // 发送 Ctrl+C
        // 等待一小段时间让进程清理
        setTimeout(() => {
          resolve({
            success: false,
            error: `Timeout after ${timeout / 1000}s\nOutput:\n${output.trim()}`,
          });
        }, 100);
      }
    }, timeout);
  });
}

// Unified diff patch parser and applier
interface PatchResult {
  success: boolean;
  content?: string;
  error?: string;
  hunksApplied?: number;
}

function parseHunkHeader(header: string): { oldStart: number; oldCount: number; newStart: number; newCount: number } | null {
  const match = header.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
  if (!match) return null;
  return {
    oldStart: parseInt(match[1], 10),
    oldCount: match[2] ? parseInt(match[2], 10) : 1,
    newStart: parseInt(match[3], 10),
    newCount: match[4] ? parseInt(match[4], 10) : 1,
  };
}

function applyUnifiedPatch(original: string, patchText: string): PatchResult {
  const originalLines = original.split('\n');
  const patchLines = patchText.split('\n');

  let currentHunk: { oldStart: number; oldCount: number; newStart: number; newCount: number } | null = null;
  let oldPos = 0;
  const newLines: string[] = [];
  let hunksApplied = 0;
  let hunkLinesProcessed = 0;

  for (let i = 0; i < patchLines.length; i++) {
    const line = patchLines[i];

    // 跳过文件头部
    if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('diff ') || line.startsWith('index ')) {
      continue;
    }

    // 解析 hunk header
    if (line.startsWith('@@')) {
      const hunk = parseHunkHeader(line);
      if (!hunk) return { success: false, error: `Invalid hunk header: ${line}` };

      // 第一个 hunk: 复制 hunk 前面的行
      if (hunksApplied === 0) {
        while (oldPos < hunk.oldStart - 1 && oldPos < originalLines.length) {
          newLines.push(originalLines[oldPos++]);
        }
      } else {
        // 后续 hunk: 复制两个 hunk 之间不变的行
        while (oldPos < hunk.oldStart - 1 && oldPos < originalLines.length) {
          newLines.push(originalLines[oldPos++]);
        }
      }

      currentHunk = hunk;
      hunkLinesProcessed = 0;
      continue;
    }

    if (!currentHunk) continue;

    // 处理 hunk body
    if (line.startsWith('+')) {
      newLines.push(line.slice(1));
      hunkLinesProcessed++;
    } else if (line.startsWith('-')) {
      const expectedLine = originalLines[oldPos];
      if (expectedLine !== line.slice(1)) {
        return { success: false, error: `Hunk mismatch at line ${oldPos + 1}: expected "${expectedLine}", got "${line.slice(1)}"` };
      }
      oldPos++;
      hunkLinesProcessed++;
    } else if (line.startsWith(' ') || line === '') {
      const contextContent = line.startsWith(' ') ? line.slice(1) : line;
      const expectedLine = originalLines[oldPos];
      if (expectedLine !== undefined && expectedLine !== contextContent) {
        // 宽松匹配：去除行尾空格
        if (expectedLine.trimEnd() !== contextContent.trimEnd()) {
          return { success: false, error: `Context mismatch at line ${oldPos + 1}: expected "${expectedLine}", got "${contextContent}"` };
        }
      }
      newLines.push(contextContent);
      oldPos++;
      hunkLinesProcessed++;

      // 检查 hunk 是否完成
      if (currentHunk && hunkLinesProcessed >= currentHunk.oldCount + currentHunk.newCount) {
        hunksApplied++;
        currentHunk = null;
      }
    }
  }

  // 如果最后一个 hunk 还没关闭，关闭它
  if (currentHunk && hunkLinesProcessed > 0) {
    hunksApplied++;
  }

  // 复制剩余行
  while (oldPos < originalLines.length) {
    newLines.push(originalLines[oldPos++]);
  }

  if (hunksApplied === 0) {
    return { success: false, error: 'No valid hunks found in patch' };
  }

  return { success: true, content: newLines.join('\n'), hunksApplied };
}