# Task 01.5: Critical Type Definition Patches

**Status:** Preserved task spec with current-status note  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/types/spells.ts`](../../../src/types/spells.ts)

---

## Why This File Still Exists

This task spec is preserved because it captures a real schema-growth moment in the spell-system overhaul.

It is no longer a trustworthy "these fields are still missing" brief.
It now serves as:
- a preserved record of the original schema-blocker concerns
- a pointer to the live type, validator, and schema surfaces
- a note about where the live repo differs from the older implementation plan

---

## Verified Current State

The type-layer additions this task asked for are already present in the current repo:

- [`src/types/spells.ts`](../../../src/types/spells.ts) includes:
  - `ritual?: boolean`
  - `rarity?: SpellRarity`
  - `combatCost`
  - `explorationCost`
  - richer `MovementEffect`, `SummoningEffect`, `TerrainEffect`, `UtilityEffect`, and `DefensiveEffect` definitions
- [`src/systems/spells/validation/spellValidator.ts`](../../../src/systems/spells/validation/spellValidator.ts) exists and includes matching validator coverage for those spell surfaces
- [`src/systems/spells/schema/spell.schema.json`](../../../src/systems/spells/schema/spell.schema.json) exists as the current JSON-schema surface

This means the older "critical gaps are still missing from `src/types/spells.ts`" claim is no longer true.

---

## Important Divergences From The Original Task Brief

### Validator path changed

The older version of this file pointed to:
- `src/validation/spellValidator.ts`

Use the current path instead:
- [`src/systems/spells/validation/spellValidator.ts`](../../../src/systems/spells/validation/spellValidator.ts)

### The rarity contract landed differently

The old brief proposed capitalized rarity values such as:
- `Common`
- `Very Rare`

The current type layer uses lowercase machine values instead:
- `common`
- `very_rare`

Use the live type file, not the older example blocks in this task spec.

### The spell-wizard follow-through was not reverified

The older version of this file assumed:
- `scripts/createSpell.ts`
- `npm run spell:new`

Those were not verified in the current repo during this pass.
Do not treat them as current guaranteed tooling surfaces.

### Script names changed

The older version referenced:
- `npm run type-check`
- `npm run validate:spells`

The current verified script names in [`package.json`](../../../package.json) are:
- `npm run typecheck`
- `npm run validate`

### Historical agent brief changed role

The older documentation step referenced `AGENT-ALPHA-TYPES.md` as a live ownership brief.
That path now exists only as a historical compatibility pointer inside this subtree.

---

## What To Treat As Current Authority

For current spell typing and validation behavior, use:
- [`src/types/spells.ts`](../../../src/types/spells.ts)
- [`src/systems/spells/validation/spellValidator.ts`](../../../src/systems/spells/validation/spellValidator.ts)
- [`src/systems/spells/schema/spell.schema.json`](../../../src/systems/spells/schema/spell.schema.json)

Supporting docs:
- [`docs/spells/SPELL_PROPERTIES_REFERENCE.md`](../../spells/SPELL_PROPERTIES_REFERENCE.md)
- [`docs/spells/SPELL_INTEGRATION_CHECKLIST.md`](../../spells/SPELL_INTEGRATION_CHECKLIST.md)

This file should be read as preserved task context, not as fresher truth than those live surfaces.

---

## What Remains Useful From The Original Task

- it preserves why schema completeness mattered before broad spell migration
- it records the specific kind of data loss the team was trying to avoid
- it explains why "just parse the description text" was considered the wrong long-term direction

---

## What Should No Longer Be Assumed

- that `ritual`, `rarity`, `combatCost`, and `explorationCost` are still absent
- that the advanced effect types are still empty stubs
- that the validator still lives under `src/validation/`
- that the old script names and spell-wizard paths are still current
- that this task is still blocking migration in the same way it once was

Use this file as preserved implementation context plus a pointer to the live type and validation layers.
