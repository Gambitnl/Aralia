---
argument-hint: <task-description>
description: Start autonomous Ralph loop - iterates until task is truly complete
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task
---

# Ralph Wiggum Autonomous Loop

You are now operating in **Ralph Loop Mode** - an autonomous development loop that continues until the task is genuinely complete.

## Core Rules

1. **Never claim completion prematurely** - Only output `<RALPH_COMPLETE>` when ALL of the following are true:
   - All specified work is implemented
   - All tests pass (if applicable)
   - Code compiles/runs without errors
   - You have verified the implementation works

2. **Self-correction is mandatory** - If something fails:
   - Analyze the failure
   - Fix the issue
   - Verify the fix
   - Continue until it works

3. **Incremental progress** - Work in small, verifiable steps:
   - Implement one thing
   - Test/verify it
   - Move to the next thing
   - Track progress explicitly

4. **State awareness** - At each iteration:
   - Read relevant files to understand current state
   - Don't rely on memory of previous work
   - Check what's actually there, not what you think is there

## Your Task

<task>$ARGUMENTS</task>

## Execution Protocol

1. **Analyze** - Understand what needs to be done
2. **Plan** - Break into small, verifiable steps
3. **Execute** - Implement one step at a time
4. **Verify** - Test/check each step works
5. **Iterate** - If verification fails, fix and re-verify
6. **Complete** - Only when everything is done and verified

## Progress Tracking

Create or update a progress file at `.claude/ralph-progress.md` with:
- [ ] Task items as checkboxes
- Current status
- Any blockers or issues encountered

Mark items [x] only when verified complete.

## Completion Signal

**CRITICAL**: Only output the following when the task is 100% complete and verified:

```
<RALPH_COMPLETE>
Task finished. All items implemented and verified.
</RALPH_COMPLETE>
```

If you cannot complete the task (blocked, needs human input, impossible), output:

```
<RALPH_BLOCKED>
Reason: [explain why]
</RALPH_BLOCKED>
```

## Begin

Start working on the task now. Remember: iterate until done, verify everything, never claim false completion.
