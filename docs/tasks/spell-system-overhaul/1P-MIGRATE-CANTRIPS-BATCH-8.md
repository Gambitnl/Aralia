# 1P - Migrate Cantrips (Batch 8)

**Scope**: Convert/verify five cantrips in the structured schema, validate, and log integration here. Use level-0 paths only with full schema/validator compliance.

## Spells in this batch (5)
- thunderclap (present, old format)
- toll-the-dead (present, old format)
- true-strike (present, old format)
- vicious-mockery (present, old format)
- word-of-radiance (present, old format)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`
2. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
3. `docs/spells/SPELL_JSON_EXAMPLES.md`
4. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
5. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
6. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - If `public/data/spells/{id}.json` exists, read it, then migrate to `public/data/spells/level-0/{id}.json`; remove flattened copies.
   - Field Comparison Check: ritual present; `castingTime.combatCost.type` present; tags/arbitrationType preserved; strict enums/casing; every effect has `trigger` and `condition`; `validTargets` plural.
   - Enforce cantrip rules: `level: 0`, `ritual: false`, `character_level` scaling if needed, Title Case damage types.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md`.
   - Run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` and capture notes below.
2. After all five: run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate` (expect 0 errors).
3. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, shared checklists). Track completion here only.
4. Stay within approved schema; no new fields; ASCII only.

## Per-Spell Checklist (record here)
- thunderclap: Data ✅ / Validation ✅ / Integration ✅ (notes: Migrated to level-0. AoE centered on self.)
- toll-the-dead: Data ✅ / Validation ✅ / Integration ✅ (notes: Conditional 1d12 damage documented in description.)
- true-strike: Data ✅ / Validation ✅ / Integration ✅ (notes: Completely rewritten to 2024 mechanics: Action, attack with weapon, radiant/normal damage.)
- vicious-mockery: Data ✅ / Validation ✅ / Integration ✅ (notes: Disadvantage modeled as UTILITY effect.)
- word-of-radiance: Data ✅ / Validation ✅ / Integration ✅ (notes: Selective targeting "creatures of your choice" noted in description.)
