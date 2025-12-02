# 1N - Migrate Cantrips (Batch 6)

**Scope**: Convert five cantrips to the new JSON format, validate, and log integration here.

## Spells in this batch (5)
- prestidigitation (present, old format)
- produce-flame (present, old format)
- ray-of-frost (present, old format)
- resistance (present, old format)
- sacred-flame (present, old format)

## Required Reading
1. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
4. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. Convert JSONs to `public/data/spells/level-0/{id}.json`; update/create glossary entries.
2. Run `npm run validate` and fix any errors.
3. Run `SPELL_INTEGRATION_CHECKLIST.md` for each spell; capture outcomes below.
4. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, shared checklists). Track completion here.

## Per-Spell Checklist (record here)
- prestidigitation: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- produce-flame: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- ray-of-frost: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- resistance: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- sacred-flame: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
