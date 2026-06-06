# Error Recovery Fix Plan

## Problem
When tools timeout or fail, spica aborts without trying alternative strategies or escalating properly.

## Current Behavior
```
Tool timeout → Abort → [OK] Done → Give up
```

## Expected Behavior (per superpowers design)
```
Tool timeout → 
  1. Analyze failure reason
  2. Try alternative strategy
  3. If still fails → Report BLOCKED with context
  4. Provide suggestions for next steps
```

## Root Cause
- `tool_stuck_warning` only sets `interruptFlag = true`
- No alternative strategy implementation
- No BLOCKED status reporting
- No error recovery mechanism

## Implementation Plan

### Task 1: Add Error Recovery Strategy Registry
**File**: `src/agent.ts`

Add strategy registry for common failures:
```typescript
interface RecoveryStrategy {
  condition: (error: string, tool: string) => boolean;
  alternatives: string[];
  suggestion: string;
}

const RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    condition: (error) => error.includes('timeout') || error.includes('stuck'),
    alternatives: [
      'Try with shorter timeout',
      'Try with detached=true',
      'Try smaller scope',
    ],
    suggestion: 'Consider breaking task into smaller pieces',
  },
  {
    condition: (error) => error.includes('test') && error.includes('timeout'),
    alternatives: [
      'Run only affected tests',
      'Run quick validation (tsc, lint)',
      'Skip tests and document',
    ],
    suggestion: 'Test suite may be too large, try focused testing',
  },
];
```

### Task 2: Implement Error Recovery in Agent Loop
**File**: `src/agent.ts`

Modify `tool_stuck_warning` handler:
```typescript
if (event === 'tool_stuck_warning') {
  this.abortTool(tc.name);
  
  // NEW: Try recovery strategy
  const strategy = this.findRecoveryStrategy(result.error, tc.name);
  if (strategy) {
    this.emit('recovery_suggestion', {
      tool: tc.name,
      error: result.error,
      alternatives: strategy.alternatives,
      suggestion: strategy.suggestion,
    });
    
    // Add recovery message to LLM
    this.llm!.addMessage({
      role: 'user',
      content: `[SYSTEM] Tool ${tc.name} failed: ${result.error}\n` +
        `Alternative approaches:\n${strategy.alternatives.map(a => `- ${a}`).join('\n')}\n` +
        `Suggestion: ${strategy.suggestion}\n` +
        `Please try an alternative approach or report BLOCKED if stuck.`
    });
    
    return { name: tc.name, id: tc.id, result: 'Tool failed, alternatives provided', isCritical: false };
  }
  
  this.interruptFlag = true;
}
```

### Task 3: Add BLOCKED Status Reporting
**File**: `src/agent.ts`

Add method to report blocked status:
```typescript
reportBlocked(context: {
  task: string;
  attempted: string[];
  failed: string[];
  error: string;
  suggestions: string[];
}) {
  this.emit('blocked', {
    status: 'BLOCKED',
    ...context,
    timestamp: new Date().toISOString(),
  });
  
  // Add to conversation for visibility
  this.llm!.addMessage({
    role: 'user',
    content: `[SYSTEM] Agent is BLOCKED.\n` +
      `Task: ${context.task}\n` +
      `Attempted: ${context.attempted.join(', ')}\n` +
      `Failed: ${context.failed.join(', ')}\n` +
      `Error: ${context.error}\n` +
      `Suggestions: ${context.suggestions.join('\n')}\n` +
      `Please provide guidance or break down the task.`
  });
}
```

### Task 4: Update CLI to Display Recovery Suggestions
**File**: `src/cli/ui/`

Display recovery suggestions when tools fail:
```typescript
agent.on('recovery_suggestion', (data) => {
  console.log('\n[RECOVERY] Tool failed:', data.tool);
  console.log('Alternatives:');
  data.alternatives.forEach(a => console.log(`  - ${a}`));
  console.log('Suggestion:', data.suggestion);
});

agent.on('blocked', (data) => {
  console.log('\n[BLOCKED] Agent needs help:');
  console.log('Task:', data.task);
  console.log('Failed attempts:', data.failed.join(', '));
  console.log('Suggestions:', data.suggestions.join('\n'));
});
```

## Testing
1. Simulate tool timeout → verify recovery suggestions
2. Simulate test failure → verify alternative strategies
3. Simulate repeated failures → verify BLOCKED reporting

## Priority
**CRITICAL** - This violates core superpowers design principles

## Related
- Superpowers: `subagent-driven-development/implementer-prompt.md`
- Superpowers: `systematic-debugging/SKILL.md`