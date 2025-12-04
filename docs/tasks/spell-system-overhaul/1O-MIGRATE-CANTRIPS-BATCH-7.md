# 1O - Migrate Cantrips (Batch 7)

**Scope**: Convert five cantrips to the new JSON format, validate, and log integration here.

## Spells in this batch (5)
- shillelagh (present, old format)
- shocking-grasp (present, old format)
- spare-the-dying (present, old format)
- thaumaturgy (present, old format)
- thorn-whip (present, old format)

## Required Reading
1. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
4. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. Convert JSONs to `public/data/spells/level-0/{id}.json`; update/create glossary entries.
2. Run `SPELL_INTEGRATION_CHECKLIST.md` for each spell; capture outcomes below.
3. Manifest: `npx tsx scripts/regenerate-manifest.ts` to refresh `public/data/spells_manifest.json`.
4. Validation: `npm run validate` (or `npm run validate:spells`) and fix any errors.
5. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, shared checklists). Track completion here.

## Per-Spell Checklist (record here)
- shillelagh: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- shocking-grasp: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- spare-the-dying: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- thaumaturgy: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- thorn-whip: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
