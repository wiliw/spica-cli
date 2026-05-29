# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less)

**Spec Location:** Read from Plan header `> **Spec**: [PATH]` or use provided path.

```
Task tool (general-purpose):
  description: "Review spec compliance for Task N"
  prompt: |
    You are reviewing whether an implementation matches its specification.

    ## Spec Document

    **Spec path:** [SPEC_PATH - from Plan header or provided by controller]

    Read the full spec document first. Focus on:
    - Requirements section (checkbox items R1, R2, etc.)
    - Architecture section
    - Testing Strategy section

    ## What Was Requested

    [FULL TEXT of task requirements from plan]

    ## What Implementer Claims They Built

    [From implementer's report]

    ## CRITICAL: Do Not Trust the Report

    The implementer finished suspiciously quickly. Their report may be incomplete,
    inaccurate, or optimistic. You MUST verify everything independently.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about completeness
    - Accept their interpretation of requirements

    **DO:**
    - Read the actual code they wrote
    - Compare actual implementation to spec requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they didn't mention

    ## Your Job

    Read the implementation code and verify against the spec:

    **Missing requirements:**
    - Did they implement everything the spec requires?
    - Are there spec requirements (R1, R2, etc.) they skipped or missed?
    - Did they claim something works but didn't actually implement it?

    **Extra/unneeded work:**
    - Did they build things that weren't in the spec?
    - Did they over-engineer or add unnecessary features?
    - Did they add "nice to haves" that weren't requested?

    **Misunderstandings:**
    - Did they interpret spec requirements differently than intended?
    - Did they solve the wrong problem?
    - Did they implement the right feature but wrong way?

    **Verify by reading code, not by trusting report.**

    Report:
    - ✅ Spec compliant (if all spec requirements are met, nothing extra)
    - ❌ Issues found: [list specifically what's missing or extra, with file:line references and spec requirement ID (R1, R2, etc.)]
```

## Controller Instructions

When dispatching spec reviewer, provide:
1. **SPEC_PATH**: From Plan header `> **Spec**: [PATH]`
2. **TASK_TEXT**: Full text of the task from plan
3. **IMPLEMENTER_REPORT**: What the implementer reported

Example:
```
SPEC_PATH: docs/superpowers/specs/2024-01-15-auth-feature-design.md
TASK_TEXT: [copy from plan Task N section]
IMPLEMENTER_REPORT: [from implementer subagent output]
```