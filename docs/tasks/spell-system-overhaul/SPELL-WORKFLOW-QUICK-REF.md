# Spell Workflow Quick Reference

**Last Updated**: 2026-03-11  
**Purpose**: Provide a compact guardrail list for spell-file editing without repeating stale migration assumptions from older subtree docs.

## Non-Negotiables

- verify the target spell path before editing
- use the current schema in `src/types/spells.ts`
- keep enum casing consistent with current conventions
- ensure required effect and targeting fields are present
- run `npm run validate` after the change

## Practical Flow

### Creating or updating a spell

1. Find the closest example in [`../../spells/SPELL_JSON_EXAMPLES.md`](../../spells/SPELL_JSON_EXAMPLES.md).
2. Edit the real spell file under `public/data/spells/`.
3. Compare against the current schema in [`../../../src/types/spells.ts`](../../../src/types/spells.ts).
4. Validate with `npm run validate`.

### Legacy conversion caution

When converting older spell data:
- do not assume older field-mapping tables are complete
- do not assume every level folder is empty or every flat file should disappear without comparison
- verify the manifest and current directory shape before moving files

## Current Commands

- validate data: `npm run validate`
- run tests: `npm run test`
- typecheck: `npm run typecheck`
- run dev server: `npm run dev`

## Common Checks

- spell ID matches file name
- level-based folder is correct
- schema-required fields are present
- status or tracking docs are updated only if they are still live and relevant

## Related Docs

- [`@WORKFLOW-SPELL-CONVERSION.md`](./@WORKFLOW-SPELL-CONVERSION.md)
- [`../../spells/SPELL_INTEGRATION_CHECKLIST.md`](../../spells/SPELL_INTEGRATION_CHECKLIST.md)
