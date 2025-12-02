# 1P - Migrate Cantrips (Batch 8)

**Scope**: Convert five cantrips to the new JSON format, validate, and log integration here.

## Spells in this batch (5)
- thunderclap (present, old format)
- toll-the-dead (present, old format)
- true-strike (present, old format)
- vicious-mockery (present, old format)
- word-of-radiance (present, old format)

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
- thunderclap: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- toll-the-dead: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- true-strike: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- vicious-mockery: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
- word-of-radiance: Data ✅ / Validation ✅ / Integration ✅ (notes: …)
