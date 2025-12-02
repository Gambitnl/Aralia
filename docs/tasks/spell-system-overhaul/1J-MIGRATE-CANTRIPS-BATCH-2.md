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
6. `docs/spells/STATUS_LEVEL_0.md` (update after each spell)

## Execution Steps
1. For each spell:
   - Apply the conversion workflow (BaseEffect fields, targeting, enums/casing).
   - Create/update glossary entry in `public/data/glossary/entries/spells/{id}.md`.
   - Update `docs/spells/STATUS_LEVEL_0.md` with status and mark Integration checklist when done.
2. Validation: run `npm run validate` (or `npm run validate:spells`) and fix any errors.
3. Integration: execute `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` per spell; ensure combat/creator/sheet expectations are satisfied.
4. Deliverables:
   - 5 validated spell JSON files in `public/data/spells/level-0/`.
   - Glossary entries created/updated.
   - `STATUS_LEVEL_0.md` updated with data and integration status.

## Notes
- Guidance is missing: create new JSON and glossary entry.
- Use the examples doc as the primary template; do not borrow fields from legacy files.
- Reactions/materials: include `reactionCondition` if applicable; set `materialCost`/`isConsumed` when GP cost is specified.
