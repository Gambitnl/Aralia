# 1K - Migrate Cantrips (Batch 3)

**Scope**: Convert five cantrips to the new JSON format (create if missing), validate, and record integration results in this task file (do not touch shared status files).

## Spells in this batch (5)
- light (missing locally — create new JSON)
- mind-sliver (missing locally — create new JSON)
- mold-earth (missing locally — create new JSON)
- primal-savagery (missing locally — create new JSON)
- sapping-sting (missing locally — create new JSON)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
4. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - Apply the conversion workflow; place JSON in `public/data/spells/level-0/{id}.json`.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md`.
   - Run `SPELL_INTEGRATION_CHECKLIST.md` for this spell and note results below.
2. Manifest: `npx tsx scripts/regenerate-manifest.ts` to refresh `public/data/spells_manifest.json`.
3. Validation: `npm run validate` (or `npm run validate:spells`) and fix errors.
4. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, or shared checklists). Record completion here.

## Per-Spell Checklist (fill here, not elsewhere)
- light: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- mind-sliver: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- mold-earth: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- primal-savagery: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- sapping-sting: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
