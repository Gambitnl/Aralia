# 1K - Migrate Cantrips (Batch 3)

**Scope**: Convert/verify five cantrips in the structured schema, using **level-0** JSON paths only, and capture all results in this file (do not touch shared status files). Every spell must satisfy the current validator, schema, and Jules acceptance criteria.

## Spells in this batch (5)
- light (verify/convert; use level-0 path)
- mind-sliver (verify/convert; use level-0 path)
- mold-earth (verify/convert; use level-0 path)
- primal-savagery (verify/convert; use level-0 path)
- sapping-sting (verify/convert; use level-0 path)

## Required Reading (read in order, no skipping)
1. `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md` (iron rules: nesting, ritual, combatCost, strict enums)
2. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md` (step-by-step workflow)
3. `docs/spells/SPELL_JSON_EXAMPLES.md` (shape and field examples)
4. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md` (legacy cues to preserve)
5. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md` (shortcuts/reminders)
6. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` (per-spell QA)

## Execution Steps
1. For each spell (one at a time):
   - Locate any legacy file at `public/data/spells/{id}.json`. Read it fully, then migrate to `public/data/spells/level-0/{id}.json`. Do not leave flattened copies.
   - Apply the Field Comparison Check (ritual present, `castingTime.combatCost.type` present, tags/arbitrationType preserved, enums/casing exact, trigger+condition on every effect).
   - Ensure `level: 0`, `ritual: false`, correct scaling (character_level for cantrips), strict enums (`validTargets` plural, damage types Title Case), and required base fields (`trigger`, `condition`) on all effects.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching IDs/names.
   - Run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` for the spell and capture notes in the checklist below.
2. After all five spells: run `npx tsx scripts/regenerate-manifest.ts` (confirm nested paths) and then `npm run validate` to ensure 0 errors.
3. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, shared checklists). Track everything in this file only.
4. If you add or modify data fields, keep to ASCII, maintain schema compatibility, and do not invent new types beyond the approved schema.

## Per-Spell Checklist (fill here, not elsewhere)
- light: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- mind-sliver: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- mold-earth: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- primal-savagery: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- sapping-sting: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
