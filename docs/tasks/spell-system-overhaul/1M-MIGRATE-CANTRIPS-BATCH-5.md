# 1M - Migrate Cantrips (Batch 5)

**Scope**: Convert/verify five cantrips in the structured schema, validate, and log integration here. Use level-0 paths only, with full schema compliance.

## Spells in this batch (5)
- magic-stone (present, old format)
- mending (present, old format)
- message (present, old format)
- minor-illusion (present, old format)
- poison-spray (present, old format)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`
2. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
3. `docs/spells/SPELL_JSON_EXAMPLES.md`
4. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
5. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
6. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - If `public/data/spells/{id}.json` exists, read it first; migrate to `public/data/spells/level-0/{id}.json`. No flattened copies remain.
   - Field Comparison Check: ritual present; `castingTime.combatCost.type` present; tags/arbitrationType preserved; strict enums/casing; every effect has `trigger` and `condition`; `validTargets` plural.
   - Ensure cantrip rules: `level: 0`, `ritual: false`, scaling uses `character_level` if needed, damage types Title Case.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md`.
   - Run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` for the spell; capture notes below.
2. After all five: `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate` (0 errors expected).
3. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, shared checklists). Track completion here only.
4. Stay within the approved schema; no new fields; ASCII only.

## Per-Spell Checklist (record here)
- magic-stone: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- mending: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- message: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- minor-illusion: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- poison-spray: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
