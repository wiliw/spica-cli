# spica-cli Design Document

**Date:** 2025-05-10
**Status:** Design Phase
**Goal:** Independent AI coding agent CLI with three-step workflow (mvp → cycle → archive)

---

## Overview

**What:** spica-cli is a standalone CLI application that implements an AI coding agent with a three-step workflow.

**Why:** Small project fast delivery. Simplify workflow while enforcing quality through automation.

**How:** 
- OpenAI API format (multi-model support)
- Three-step workflow: mvp → cycle → archive
- Automatic execution with Iron Law enforcement
- Auto-fix loop on errors

---

## Architecture

```
spica-cli/
├── package.json              # Project config
├── tsconfig.json             # TypeScript config
├── src/
│   ├── index.ts              # CLI entry point
│   ├── agent.ts              # Core agent logic
│   ├── llm/
│   │   ├── client.ts         # OpenAI client wrapper
│   │   └── prompts.ts        # Prompt templates
│   ├── tools/
│   │   ├── file.ts           # File operations
│   │   ├── bash.ts           # Bash execution
│   │   ├── git.ts            # Git operations
│   │   └── test.ts           # Test runner
│   ├── skills/
│   │   ├── mvp.ts            # MVP workflow
│   │   ├── cycle.ts          # Cycle workflow
│   │   └── archive.ts        # Archive workflow
│   │   └── base.ts           # Skill base class
│   ├── utils/
│   │   ├── logger.ts         # Logging utility
│   │   ├── todo.ts           # Todo tracking
│   │   └── config.ts         # Config management
│   └── templates/
│       ├── spec.md           # Spec template
│       ├── tasks.md          # Tasks template
│       └── changelog.md      # Changelog template
├── bin/
│   └── spica                 # CLI binary
└── docs/
    └── design.md             # This document
```

---

## Core Components

### 1. Agent (src/agent.ts)

**Responsibility:** Orchestrate skill execution, manage state, coordinate tools.

```typescript
class SpicaAgent {
  llmClient: LLMClient
  tools: ToolManager
  todos: TodoTracker
  
  async executeSkill(skill: string, input: string): Result {
    // 1. Initialize state
    // 2. Create todos
    // 3. Execute skill steps
    // 4. Handle errors with auto-fix
    // 5. Update todos
    // 6. Return result
  }
  
  async executeStep(step: Step): Result {
    // 1. Update todo: in_progress
    // 2. Check Iron Law (if required)
    // 3. Call LLM with prompt
    // 4. Execute tool calls
    // 5. Auto-fix loop if errors
    // 6. Update todo: completed
  }
  
  async autoFixLoop(error: Error): Result {
    // Loop: diagnose → fix → test → repeat
    // Max 5 iterations
    // If cannot fix → ask user
  }
}
```

### 2. LLM Client (src/llm/client.ts)

**Responsibility:** OpenAI API calls with function calling.

```typescript
class LLMClient {
  client: OpenAI
  
  async generate(prompt: string, tools?: Tool[]): Response {
    // OpenAI chat.completions.create
    // Support function calling
    // Support multi-turn context
  }
  
  async generateWithTools(prompt: string, tools: Tool[]): Response {
    // Define functions in OpenAI format
    // Execute function calls
    // Return tool results to LLM
    // Loop until completion
  }
}
```

### 3. Tools (src/tools/*.ts)

**Each tool implements:**

```typescript
interface Tool {
  name: string
  description: string
  parameters: object  // OpenAI function schema
  execute(params: any): Result
}

// File operations
class FileWriteTool implements Tool {
  name: 'file_write'
  parameters: { path: string, content: string }
  execute(params): write file
}

class FileReadTool implements Tool {
  name: 'file_read'
  parameters: { path: string }
  execute(params): return file content
}

class FileEditTool implements Tool {
  name: 'file_edit'
  parameters: { path: string, old: string, new: string }
  execute(params): edit file precisely
}

// Bash execution
class BashTool implements Tool {
  name: 'bash'
  parameters: { command: string }
  execute(params): run command, return output
}

// Git operations
class GitTool implements Tool {
  name: 'git'
  parameters: { action: string, args?: any }
  execute(params): git operations (commit, status, etc.)
}

// Test runner
class TestTool implements Tool {
  name: 'test'
  parameters: { language: string }
  execute(params): run tests, return results
}
```

---

## Three-Step Workflow

### Step 1: MVP (src/skills/mvp.ts)

**Workflow:**
1. Gather requirements (3 questions)
2. Recommend tech stack + creative ideas
3. Design extensible architecture
4. Implement core function
5. Create change record (spec + tasks)
6. Demo and acceptance

**Iron Laws:**
- MUST ask 3 core questions
- MUST recommend tech stack with rationale
- MUST design with module boundaries
- MUST test core function works

**Prompt Flow:**
```
Prompt 1: Ask user 3 questions (wait for answers)
Prompt 2: Generate tech stack options + recommendation
Prompt 3: Generate architecture design
Prompt 4: Generate implementation code (write files)
Prompt 5: Generate tests (run tests)
Prompt 6: Create documents (spec.md, tasks.md, project-log.md)
```

**Output:**
- Working core function
- docs/spec.md (design document)
- docs/tasks.md (task tracking)
- docs/project-log.md (MVP log)

### Step 2: Cycle (src/skills/cycle.ts)

**Workflow:**
1. Judge request type (bug/simple/complex)
2. Implement (type-specific)
3. Test
4. Update change record
5. Demo and feedback

**Iron Laws:**
- MUST judge type correctly
- MUST test before demo
- MUST update tasks.md

**Type-specific flows:**
- Bug: diagnose → fix → test → loop
- Simple: implement → test
- Complex: TDD (test first → implement → verify)

**Prompt Flow:**
```
Prompt 1: Analyze request, judge type
Prompt 2: Generate fix/implementation code
Prompt 3: Generate tests
Prompt 4: Run tests (auto-fix loop if fails)
Prompt 5: Update tasks.md
```

**Auto-fix loop:**
```
while (test fails && iterations < 5) {
  diagnose error
  generate fix
  run test
  if (test passes) break
}
if (still fails) → ask user
```

**Output:**
- Feature/fix implemented
- Tests pass
- docs/tasks.md updated
- Git commit

### Step 3: Archive (src/skills/archive.ts)

**Workflow:**
1. Verify all tests pass
2. Check tasks completion
3. Confirm acceptance + version
4. Update documentation
5. Official git commit + tag
6. Archive change directory

**Iron Laws:**
- MUST verify tests pass
- MUST check tasks completion
- MUST get version number
- MUST update CHANGELOG.md

**Prompt Flow:**
```
Prompt 1: Run all tests
Prompt 2: Check tasks.md completion
Prompt 3: Ask user for version (wait for answer)
Prompt 4: Generate CHANGELOG entry
Prompt 5: Generate README updates
Prompt 6: Git commit + tag
Prompt 7: Archive change directory
```

**Output:**
- CHANGELOG.md updated
- README.md updated
- docs/project-log.md updated
- Git commit + tag
- Archived: docs/archive/YYYY-MM-DD-<project>/

---

## Tool Definitions (OpenAI Format)

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "file_write",
        "description": "Write content to file",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "content": { "type": "string" }
          },
          "required": ["path", "content"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "file_read",
        "description": "Read file content",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string" }
          },
          "required": ["path"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "file_edit",
        "description": "Edit file by replacing exact text",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "old": { "type": "string" },
            "new": { "type": "string" }
          },
          "required": ["path", "old", "new"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "bash",
        "description": "Execute bash command",
        "parameters": {
          "type": "object",
          "properties": {
            "command": { "type": "string" }
          },
          "required": ["command"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "git_commit",
        "description": "Git commit with message",
        "parameters": {
          "type": "object",
          "properties": {
            "message": { "type": "string" }
          },
          "required": ["message"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "run_test",
        "description": "Run tests for specified language",
        "parameters": {
          "type": "object",
          "properties": {
            "language": { 
              "type": "string",
              "enum": ["go", "bun", "python", "node"]
            }
          },
          "required": ["language"]
        }
      }
    }
  ]
}
```

---

## CLI Commands

### Command: mvp

```bash
spica mvp <description>

# Example:
spica mvp "build a file classifier CLI"
spica mvp "I want to create a web scraper"
```

**Behavior:**
- Parse description
- Execute MVP skill
- Display progress with todos
- Auto-collect requirements (3 questions)
- Auto-implement core
- Auto-create documents
- Demo result

### Command: cycle

```bash
spica cycle <request>

# Example:
spica cycle "add drag-and-drop interface"
spica cycle "fix the classification bug"
```

**Behavior:**
- Parse request
- Execute Cycle skill
- Judge type automatically
- Auto-implement/fix
- Auto-test
- Auto-update docs
- Demo result

### Command: archive

```bash
spica archive [version]

# Example:
spica archive v1.0
spica archive  # defaults to v1.0
```

**Behavior:**
- Execute Archive skill
- Verify all tests
- Check tasks completion
- Ask for version (if not provided)
- Auto-update docs
- Auto-commit + tag
- Archive change

### Command: config

```bash
spica config set <key> <value>
spica config get <key>
spica config list

# Example:
spica config set openai.key sk-xxx
spica config set openai.model gpt-4
spica config set openai.base_url https://api.openai.com/v1
spica config get openai.key
spica config list
```

---

## Configuration

**Config file:** `~/.spica/config.json`

```json
{
  "openai": {
    "apiKey": "sk-xxx",
    "model": "gpt-4",
    "baseUrl": "https://api.openai.com/v1"
  },
  "defaults": {
    "language": "go",
    "testCommand": {
      "go": "go test ./...",
      "bun": "bun test",
      "python": "pytest",
      "node": "npm test"
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

**Tasks:**
1. Setup project structure (TypeScript + package.json)
2. Implement OpenAI client wrapper
3. Implement basic tools (file_write, file_read, bash)
4. Implement CLI commands (commander.js)
5. Implement config management
6. Test basic functionality

**Deliverable:** 
- Can run: `spica config set openai.key sk-xxx`
- Can call OpenAI API
- Can execute basic tools

### Phase 2: MVP Skill (Week 3-4)

**Tasks:**
1. Design MVP prompt templates
2. Implement MVP skill flow
3. Implement todo tracking
4. Implement spec.md/tasks.md generation
5. Test MVP workflow

**Deliverable:**
- Can run: `spica mvp "build hello world"`
- Creates working code
- Creates docs/spec.md, docs/tasks.md

### Phase 3: Cycle Skill (Week 5-6)

**Tasks:**
1. Design Cycle prompt templates
2. Implement type judgment
3. Implement auto-fix loop
4. Implement tasks.md updates
5. Test cycle workflow

**Deliverable:**
- Can run: `spica cycle "add feature"`
- Auto-judges type
- Auto-implements + tests
- Auto-fixes errors

### Phase 4: Archive Skill (Week 7-8)

**Tasks:**
1. Design Archive prompt templates
2. Implement verification logic
3. Implement CHANGELOG/README updates
4. Implement git commit + tag
5. Test archive workflow

**Deliverable:**
- Can run: `spica archive v1.0`
- Updates all docs
- Git commit + tag
- Archives change

### Phase 5: Polish & Release (Week 9-10)

**Tasks:**
1. Add error handling
2. Add logging
3. Add --verbose flag
4. Write README
5. Add tests
6. npm publish

**Deliverable:**
- Production-ready CLI
- Published to npm
- Documented

---

## Success Criteria

**MVP skill:**
- ✅ Creates working core function
- ✅ Generates spec.md, tasks.md, project-log.md
- ✅ Core function tests pass
- ✅ User can see progress with todos

**Cycle skill:**
- ✅ Auto-judges request type
- ✅ Auto-implements feature/fix
- ✅ Auto-tests + auto-fix loop
- ✅ Updates tasks.md
- ✅ Tests pass

**Archive skill:**
- ✅ Verifies all tests pass
- ✅ Updates CHANGELOG, README, project-log
- ✅ Git commit + tag created
- ✅ Change archived

**Overall:**
- ✅ Installable via npm
- ✅ Independent execution
- ✅ OpenAI API format
- ✅ Three-step workflow functional
- ✅ Auto quality enforcement

---

## Technical Stack

**Dependencies:**
- openai (OpenAI SDK)
- commander (CLI framework)
- execa (Bash execution)
- fs-extra (File operations)
- simple-git (Git operations)
- chalk (Terminal colors)

**DevDependencies:**
- typescript
- ts-node
- @types/node
- vitest (Testing)

---

## Notes

**Design principles:**
- Simple workflow (3 steps)
- Automatic execution (no manual steps)
- Quality enforcement (Iron Laws)
- Error recovery (auto-fix loop)
- Clear progress (todo tracking)

**Inspiration:**
- Aider (CLI + AI coding)
- OpenCode (current usage)
- superpowers (Iron Law concept)
- openspec (change tracking)

**Future extensions:**
- TUI interface (Ink + React)
- Multi-model support (Anthropic, local)
- Parallel execution
- Plugin system