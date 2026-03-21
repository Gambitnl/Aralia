# Task 01: TypeScript Interfaces & Types

**Status:** Preserved task spec with current-status note  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/types/spells.ts`](../../../src/types/spells.ts)

---

## Why This File Still Exists

This task spec is preserved because the type foundation it called for now exists and still shapes later spell-migration work.

It is no longer a clean future-task brief. It now serves as:
- a preserved record of the original type-foundation intent
- a pointer to the live implementation
- a note about where the implementation diverged from the original design brief

---

## Verified Current State

The core implementation requested by this task now exists:

- [`src/types/spells.ts`](../../../src/types/spells.ts) exists
- runtime type guards such as `isSpell` and `isDamageEffect` exist
- type tests exist at:
  - [`src/types/__tests__/spells.test.ts`](../../../src/types/__tests__/spells.test.ts)
  - [`src/types/__tests__/spells.test-d.ts`](../../../src/types/__tests__/spells.test-d.ts)

The live type layer already includes:
- core spell metadata and mechanics
- targeting unions and area-of-effect structures
- effect unions and per-effect typing
- scaling formulas
- AI arbitration typing

---

## Important Divergences From The Original Task Brief

### Architecture reference changed

The original research reference path in the older version of this file was broken:
- `docs/architecture/@SPELL-SYSTEM-RESEARCH.md`

Use the current architecture surface instead:
- [`docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

### Some design choices landed differently

- the live code uses a `SpellSchool` enum rather than only string-literal unions
- the live `Spell` shape carries more fields and compatibility notes than the original brief showed
- no `LegacySpell` alias was re-verified during this pass, so the older backward-compatibility note should not be treated as a guaranteed current contract

---

## What To Treat As Current Authority

For current spell typing, use:
- [`src/types/spells.ts`](../../../src/types/spells.ts)
- [`src/types/__tests__/spells.test.ts`](../../../src/types/__tests__/spells.test.ts)
- [`src/types/__tests__/spells.test-d.ts`](../../../src/types/__tests__/spells.test-d.ts)

This file should be read as preserved task context, not as a fresher source of truth than the code.

---

## What Remains Useful From The Original Task

- it defines the original goal of a machine-readable spell type foundation
- it preserves the intent behind discriminated unions, type guards, and typed tests
- it remains a readable explanation of why the spell type surface became large and detailed

---

## What Should No Longer Be Assumed

- that the broken `@SPELL-SYSTEM-RESEARCH.md` reference is still valid
- that every code example here matches the live shape exactly
- that the task is still waiting to create the core type file from scratch
- that the "LegacySpell" preservation note is a verified live guarantee

Use this file as preserved implementation context plus a pointer to the live type layer.
