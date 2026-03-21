# Task: Complete Stub Command Implementations

**Status:** Preserved completion note with current-status check  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/commands/effects`](../../../src/commands/effects)

---

## Why This File Still Exists

This task is preserved because it marks a real transition point in the spell-command rollout: the old "stub command" phase is broadly over, but a few runtime cleanup concerns still remain.

It should no longer be read as an active implementation brief for missing command files.

---

## Verified Current State

The core command implementations that used to be stub-heavy now exist:

- [`src/commands/effects/HealingCommand.ts`](../../../src/commands/effects/HealingCommand.ts)
- [`src/commands/effects/StatusConditionCommand.ts`](../../../src/commands/effects/StatusConditionCommand.ts)
- [`src/commands/effects/DefensiveCommand.ts`](../../../src/commands/effects/DefensiveCommand.ts)

Important current facts:
- `HealingCommand` already honors `healing.isTemporaryHp`
- `HealingCommand` already preserves the higher temporary-HP value instead of stacking
- `StatusConditionCommand` still carries an inline TODO about expiring `ActiveCondition` durations and logging when they end
- `DefensiveCommand` currently applies only a narrower defensive subset than the full type surface suggests

---

## Remaining Follow-Through Worth Tracking

### 1. Status-condition cleanup

Still open:
- wire `ActiveCondition` duration cleanup into turn processing
- log when those conditions expire

Current inline note:
- [`src/commands/effects/StatusConditionCommand.ts`](../../../src/commands/effects/StatusConditionCommand.ts)

### 2. Defensive-effect expiration semantics

Still worth checking:
- how resistance effects expire
- how immunity effects expire
- how temporary HP granted through defensive effects should be cleaned up when the underlying effect ends

This is no longer the same as "temp HP overlap is missing."
The overlap rule is already handled; the remaining gap is lifecycle cleanup.

---

## What Should No Longer Be Assumed

- that `HealingCommand` still lacks temporary-HP support
- that every remaining follow-up already exists as an inline TODO at the older line references
- that this file is still the best source of truth for command behavior

For current command behavior, use the live files under [`src/commands/effects`](../../../src/commands/effects).
