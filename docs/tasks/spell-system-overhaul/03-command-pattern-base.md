# Task 03: Command Pattern Base Architecture

**Status:** Preserved task spec with current-status note  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/commands`](../../../src/commands)

---

## Why This File Still Exists

This task spec is preserved because the command-pattern foundation it described now exists in the repo and still explains the intended shape of later spell execution work.

It is no longer a pure future-task brief. It now serves as:
- a preserved record of the original command-architecture intent
- a pointer to the current command-layer implementation
- a note about where the repo landed differently from the original plan

---

## Verified Current State

The repo already has the core command foundation this task described:

- [`src/commands/base/SpellCommand.ts`](../../../src/commands/base/SpellCommand.ts)
- [`src/commands/base/BaseEffectCommand.ts`](../../../src/commands/base/BaseEffectCommand.ts)
- [`src/commands/base/CommandExecutor.ts`](../../../src/commands/base/CommandExecutor.ts)
- [`src/commands/factory/SpellCommandFactory.ts`](../../../src/commands/factory/SpellCommandFactory.ts)
- [`src/commands/index.ts`](../../../src/commands/index.ts)

The current execution surface also already reaches into combat flow:
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts) imports `SpellCommandFactory` and `CommandExecutor`

---

## Important Divergences From The Original Task Brief

### Architecture reference changed

The older version of this task referenced a broken research path:
- `docs/architecture/@SPELL-SYSTEM-RESEARCH.md`

Use the current architecture surface instead:
- [`docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

### The live file layout differs

This task originally assumed a spell-command module tree under `src/systems/spells/commands/`.

What is true now:
- the live command base sits under [`src/commands`](../../../src/commands)
- targeting and mechanics helpers do exist under [`src/systems/spells`](../../../src/systems/spells)
- no dedicated [`src/systems/spells/integration/SpellExecutor.ts`](../../../src/systems/spells/integration/SpellExecutor.ts) was re-verified in the current repo

### The task is partly implemented, not wholly pending

This file should no longer be read as "build the command foundation from zero."

The remaining value is:
- understanding the intended command-based execution shape
- identifying where the current implementation still differs from the earlier module map

---

## What To Treat As Current Authority

For current command execution behavior, use:
- [`src/commands/base/SpellCommand.ts`](../../../src/commands/base/SpellCommand.ts)
- [`src/commands/base/CommandExecutor.ts`](../../../src/commands/base/CommandExecutor.ts)
- [`src/commands/factory/SpellCommandFactory.ts`](../../../src/commands/factory/SpellCommandFactory.ts)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

This file should be read as preserved task context, not as a fresher source of truth than those code paths.

---

## What Remains Useful From The Original Task

- it captures the original reason for moving spell execution into commands
- it preserves the expected responsibilities of the command interface, factory, and executor layers
- it documents the intended relationship between scaling, command creation, and combat integration

---

## What Still Needs Careful Follow-Through

- command coverage for all spell-effect families still needs per-effect verification
- any future dedicated integration surface should be judged against the current `useAbilitySystem` flow, not assumed from this older doc
- test/file lists in the original version should not be treated as exact live layout without checking the repo first

Use this file as preserved implementation context plus a pointer to the current command layer.
