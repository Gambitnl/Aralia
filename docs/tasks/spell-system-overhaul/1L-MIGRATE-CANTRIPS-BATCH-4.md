# 1L - Migrate Cantrips (Batch 4)

**Scope**: Convert/verify five cantrips in the structured schema, validate, and record integration results in this file only. Use level-0 paths, no flattened copies, and comply with current schema/validator rules.

## Spells in this batch (5)
- shape-water (verify/convert; use level-0 path)
- sword-burst (verify/convert; use level-0 path)
- friends (verify/convert; use level-0 path)
- frostbite (verify/convert; use level-0 path)
- mage-hand (verify/convert; use level-0 path)

## Required Reading (read in order, no skipping)
1. `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md` (nesting, ritual, combatCost, strict enums)
2. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
3. `docs/spells/SPELL_JSON_EXAMPLES.md`
4. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
5. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
6. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell (one at a time):
   - If `public/data/spells/{id}.json` exists, read it, then migrate to `public/data/spells/level-0/{id}.json`. No flattened copies may remain.
   - Run the Field Comparison Check (ritual present; `castingTime.combatCost.type` present; tags/arbitrationType preserved; enums/casing exact; every effect has `trigger` and `condition`; `validTargets` plural).
   - Ensure cantrip requirements: `level: 0`, `ritual: false`, scaling as `character_level` if applicable, strict Title Case enums.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching ID/name.
   - Run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` for the spell and capture notes below.
2. After all five spells: run `npx tsx scripts/regenerate-manifest.ts` (confirm nested paths) and `npm run validate` to ensure 0 errors.
3. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, shared checklists). Log everything here only.
4. Keep to the approved schema; do not invent new fields. Maintain ASCII.

## Per-Spell Checklist (record here)
- shape-water: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- sword-burst: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- friends: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- frostbite: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- mage-hand: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
