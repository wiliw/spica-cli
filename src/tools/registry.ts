import type { ToolDefinition } from './helpers';
import { getMCPManager } from '../mcp/client';

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
    name: 'file_replace',
    description: 'Replace text in file using regex pattern. More flexible than file_edit for pattern matching. Read file first. Auto-checks syntax after edit.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        pattern: { type: 'string', description: 'Regex pattern to match (e.g., "oldFunc\\\\(\\\\)" for oldFunc())' },
        replacement: { type: 'string', description: 'Replacement text. Use $1, $2 for capture groups.' },
        flags: { type: 'string', description: 'Regex flags: g (global), i (ignore case), m (multiline). Default: "g"' },
        all: { type: 'boolean', description: 'Replace all occurrences. Default: true' },
      },
      required: ['path', 'pattern', 'replacement'],
    },
  },
  {
    name: 'file_insert',
    description: 'Insert text at specific line number. Read file first. Auto-checks syntax after edit.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path' },
        line: { type: 'number', description: 'Line number to insert at (1-based). Use 0 to append at end, -1 to prepend at beginning.' },
        content: { type: 'string', description: 'Content to insert' },
        after: { type: 'string', description: 'Insert after line matching this pattern (alternative to line)' },
        before: { type: 'string', description: 'Insert before line matching this pattern (alternative to line)' },
      },
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
    description: 'Run shell command. Timeout returns error - AI should decide retry strategy.',
    parameters: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 120)' },
        detached: { type: 'boolean', description: 'Run in background (tmux/screen)' },
        interactive: { type: 'boolean', description: 'Enable PTY interaction' },
        maxOutputLength: { type: 'number', description: 'Max output chars (default 50000)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'monitor',
    description: 'Start a background monitor that streams events from a long-running script. Each stdout line becomes a notification. Use for watching logs, processes, or polling for changes. Exit ends the watch.',
    parameters: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to run. Each stdout line is an event.' },
        description: { type: 'string', description: 'Short description shown in notifications' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 300, max 3600)' },
        persistent: { type: 'boolean', description: 'Run for session lifetime (no timeout). Stop with task_stop.' },
      },
      required: ['command', 'description'],
    },
  },
  {
    name: 'task_stop',
    description: 'Stop a running background task (monitor or detached bash).',
    parameters: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'Task ID from monitor or bash (detached mode)' },
      },
      required: ['task_id'],
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
    description: 'Run parallel subagents (max 3). Each subagent works independently. IMPORTANT: If a subagent fails (returns ✗), you should: 1) Analyze the error message, 2) Retry with a modified prompt or different approach, 3) Or handle the failed task yourself in main agent. Do NOT ignore failed subagents - investigate and resolve them.',
    parameters: {
      type: 'object' as const,
      properties: {
        tasks: {
          type: 'array',
          description: 'Tasks to run in parallel. Each task should be independent and self-contained.',
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Short desc for display' },
              prompt: { type: 'string', description: 'Full prompt with clear instructions, context, and expected output format' },
              type: { type: 'string', enum: ['explore', 'review', 'fix', 'build'], description: 'Subagent type: explore(read-only), review(+lint), fix(+edit), build(full)' },
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
  {
    name: 'code_health',
    description: 'Analyze code health score (maintainability, complexity, nesting). Target: >= 9.5 for AI-friendly code. Based on Martin Fowler\'s recommendations.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File or directory to analyze' },
        threshold: { type: 'number', description: 'Minimum acceptable score (default: 9.5)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'test_quality_check',
    description: 'Detect test anti-patterns: over-mocking (TST-004), happy-path-only (TST-005), assertion-free (TST-008). Use after writing tests to ensure quality.',
    parameters: {
      type: 'object' as const,
      properties: {
        testFile: { type: 'string', description: 'Test file to analyze' },
        threshold: { type: 'number', description: 'Minimum acceptable score (default: 7.0)' },
      },
      required: ['testFile'],
    },
  },
];

export const mcpToolNameMap = new Map<string, string>();

export function getAllToolDefinitions(): ToolDefinition[] {
  const mcpTools = getMCPManager().getToolDefinitions();
  mcpToolNameMap.clear();
  const mcpConverted: ToolDefinition[] = mcpTools.map(t => {
    const sanitized = t.name.replace(/\//g, '_');
    if (sanitized !== t.name) {
      mcpToolNameMap.set(sanitized, t.name);
    }
    return {
      name: sanitized,
      description: `[MCP] ${t.description}`,
      parameters: t.inputSchema,
    };
  });
  return [...TOOLS_DEFINITIONS, ...mcpConverted];
}

