# 1J - Migrate Cantrips (Batch 2)

**Scope**: Convert five high-priority cantrips to the new JSON format and verify integration.

## Spells in this batch (5)
- fire-bolt (present, old format)
- eldritch-blast (present, old format)
- dancing-lights (present, old format)
- druidcraft (present, old format)
- guidance (missing locally — create new JSON)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
4. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - Apply the conversion workflow (BaseEffect fields, targeting, enums/casing).
   - Place JSON at `public/data/spells/level-0/{id}.json`.
   - Create/update glossary entry in `public/data/glossary/entries/spells/{id}.md`.
   - Run the integration checklist (`docs/spells/SPELL_INTEGRATION_CHECKLIST.md`) and log results in **this batch file** (do not edit shared status files).
2. Manifest: run `npx tsx scripts/regenerate-manifest.ts` to refresh `public/data/spells_manifest.json`.
3. Validation: run `npm run validate` (or `npm run validate:spells`) and fix any errors.
4. Deliverables:
   - 5 validated spell JSON files in `public/data/spells/level-0/`.
   - Glossary entries created/updated.
   - Integration checklist results recorded in this file (no shared status file edits).

## Notes
- Guidance is missing: create new JSON and glossary entry.
- Use the examples doc as the primary template; do not borrow fields from legacy files.
- Reactions/materials: include `reactionCondition` if applicable; set `materialCost`/`isConsumed` when GP cost is specified.
