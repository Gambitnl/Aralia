# 1L - Migrate Cantrips (Batch 4)

**Scope**: Convert five cantrips to the new JSON format, validate, and record integration results in this task file only.

## Spells in this batch (5)
- shape-water (missing locally — create new JSON)
- sword-burst (missing locally — create new JSON)
- friends (present, old format)
- frostbite (present, old format)
- mage-hand (present, old format)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
4. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - Convert/create JSON in `public/data/spells/level-0/{id}.json`.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md`.
   - Run `SPELL_INTEGRATION_CHECKLIST.md` and capture notes here.
2. Manifest: `npx tsx scripts/regenerate-manifest.ts` to refresh `public/data/spells_manifest.json`.
3. Validation: `npm run validate` (or `npm run validate:spells`) and fix errors.
4. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, or shared checklists). Log completion below.

## Per-Spell Checklist (record here)
- shape-water: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- sword-burst: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- friends: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- frostbite: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- mage-hand: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
