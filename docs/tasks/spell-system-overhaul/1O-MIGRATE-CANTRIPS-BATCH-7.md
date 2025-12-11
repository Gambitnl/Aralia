# 1O - Migrate Cantrips (Batch 7)

**Scope**: Convert/verify five cantrips in the structured schema, validate, and log integration here. Use level-0 paths only with full schema/validator compliance.

## Spells in this batch (5)
- shillelagh (present, old format)
- shocking-grasp (present, old format)
- spare-the-dying (present, old format)
- thaumaturgy (present, old format)
- thorn-whip (present, old format)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`
2. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
3. `docs/spells/SPELL_JSON_EXAMPLES.md`
4. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
5. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
6. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - If `public/data/spells/{id}.json` exists, read it, then migrate to `public/data/spells/level-0/{id}.json`; delete flattened copies afterward.
   - Field Comparison Check: ritual present; `castingTime.combatCost.type` present; tags/arbitrationType preserved; strict enums/casing; every effect has `trigger` and `condition`; `validTargets` plural.
   - Enforce cantrip rules: `level: 0`, `ritual: false`, `character_level` scaling if needed, Title Case damage types.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md`.
   - Run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` and capture notes below.
2. After all five: run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate` (expect 0 errors).
3. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, shared checklists). Track completion here only.
4. Stay within approved schema; no new fields; ASCII only.

## Per-Spell Checklist (record here)
- shillelagh: Data ✅ / Validation ✅ / Integration ✅ (notes: Already migrated)
- shocking-grasp: Data ✅ / Validation ✅ / Integration ✅ (notes: Added reaction-suppression condition, melee cantrip)
- spare-the-dying: Data ✅ / Validation ✅ / Integration ✅ (notes: Stabilize utility; scaling range retained)
- thaumaturgy: Data ✅ / Validation ✅ / Integration ✅ (notes: Utility minor wonders; Cleric-only)
- thorn-whip: Data ✅ / Validation ✅ / Integration ✅ (notes: Adds pull movement on hit)
