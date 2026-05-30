# Skill Gate Prompt Enhancement — Design Spec

**Date**: 2025-01-16
**Status**: approved
**Topic**: Strengthen system prompt to prevent AI from skipping brainstorming/skill checks

## Problem

The system prompt (`src/prompts/system.ts`) has an `<EXTREMELY-IMPORTANT>` block mandating skill invocation. Despite this, the AI sometimes skips the skill check — typically by self-rationalizing that the request is "too simple" or "just a question."

Real example: User asked "How would you improve yourself?" — a design question about system changes. AI should have invoked `brainstorming` but instead answered directly.

### Root Cause

The current prompt says "If you think there is even a 1% chance..." — this leaves room for the AI's own judgment to override the rule. The AI rationalizes: "This doesn't feel like a 1% case" → bypass.

## Solution

Replace the `<EXTREMELY-IMPORTANT>` block with a **decision tree** that removes subjective judgment. Instead of "if you think," use pattern matching: "does the message contain X → invoke Y."

### Key Changes

1. **Decision tree, not judgment call** — keyword-based triggers with explicit mappings
2. **Anti-patterns list** — name the specific rationalizations the AI will be tempted to use, and pre-reject them
3. **Ambiguous-request examples** — show that "questions about improvement" ARE design work

### File Changed

`src/prompts/system.ts` — replace the `<EXTREMELY-IMPORTANT>` block only.

### New Prompt Text

```
<EXTREMELY-IMPORTANT>
Before ANY response or action, scan for skill triggers using this DECISION TREE — not your own judgment:

1. Does the user's message contain:
   - "create"/"add"/"build"/"make"/"implement"/"write" + "feature/component/module/system" → brainstorming
   - "fix"/"debug"/"bug"/"error"/"broken"/"not working" → systematic-debugging
   - "how to improve"/"how to make better"/"could we" → brainstorming (designing improvements IS creative work)
   - "review"/"check my" → requesting-code-review

2. If ANY keyword matches → invoke skill. Do NOT evaluate "complexity" — the skill itself decides scope.

ANTI-PATTERNS (you WILL be tempted by these — RESIST):
- "This is too simple for design" → WRONG. Every change goes through design.
- "The user already knows what they want" → WRONG. Skill will surface hidden assumptions.
- "I've done this before" → WRONG. This project may differ.
- "It's just a question about the project" → If it involves creating/changing ANYTHING, it's design.

CORRECT responses to ambiguous requests:
- "What would you improve?" → This is about designing improvements → brainstorming
- "Can you add X?" → This is creating a feature → brainstorming
- "Let's fix Y" → This is debugging → systematic-debugging

When in doubt: INVOKE THE SKILL. The cost of unnecessary skill invocation is 2-3 messages. The cost of skipping design is wasted implementation.
</EXTREMELY-IMPORTANT>
```

## Non-Goals

- No code-level enforcement (user chose against hard gate)
- No new files or modules
- No changes to skill loading/invocation logic
- No changes to how skills work internally

## Testing

- Run full test suite to confirm no regressions (pure text change, no logic impact)
- Manual verification: in next session, ask a design-adjacent question and observe whether skill is invoked

## Risks

- **Prompt alone may still be insufficient** — if this iteration fails again, the fallback is a lightweight code gate (option B-lite from discussion)
- **Keyword matching is brittle** — user phrasing varies; the decision tree can't cover everything. The anti-patterns and "when in doubt" clause serve as catch-alls.
