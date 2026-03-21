# Spell Conversion Workflow

**Last Updated**: 2026-03-11  
**Purpose**: Describe the current spell-conversion workflow in a narrower, safer way than the older migration docs, while avoiding stale assumptions about glossary locations or folder completeness.

## Scope

Use this workflow when converting or normalizing spell JSON data in the current repo.

This workflow is for:
- spell JSON migration
- schema-field normalization
- validation and manifest checks

It is not a guarantee that every older spell-doc assumption in this subtree is still current.

## Current Sources Of Truth

Use these sources first:
- [`../../spells/SPELL_JSON_EXAMPLES.md`](../../spells/SPELL_JSON_EXAMPLES.md)
- [`../../../src/types/spells.ts`](../../../src/types/spells.ts)
- [`../../../package.json`](../../../package.json) for current commands
- current spell files under `public/data/spells/`

Use older subtree docs as supporting context only when they still match the repo.

## Core Workflow

1. Read the closest spell example in `docs/spells/SPELL_JSON_EXAMPLES.md`.
2. Inspect the existing target file, if one exists.
3. Normalize the spell data into the current folder structure and schema shape.
4. Verify enums, casing, effect fields, targeting fields, and scaling fields.
5. Run `npm run validate`.
6. Update any related status or tracking surface that still depends on the spell being migrated.

## Important Current Rules

- cantrips belong under `public/data/spells/level-0/`
- leveled spells should use the level-based structure already present under `public/data/spells/`
- every effect must satisfy the current schema requirements
- use the current command names from `package.json`, not older variants copied from stale docs

## Cautions

- Do not assume every legacy spell has a matching glossary markdown file in a dedicated `public/data/glossary/entries/spells/` folder; verify the current glossary structure first.
- Do not assume all older migration status percentages in this subtree are current.
- Do not assume older "single source of truth" workflow docs still exist just because nearby docs reference them.

## Validation Checklist

Before calling a converted spell done:
- file is in the correct location
- schema-required fields are present
- enum casing matches current conventions
- `npm run validate` passes
- any dependent status or tracking surface has been updated if it still matters

## Related Docs

- [`SPELL-WORKFLOW-QUICK-REF.md`](./SPELL-WORKFLOW-QUICK-REF.md)
- [`../../spells/SPELL_INTEGRATION_CHECKLIST.md`](../../spells/SPELL_INTEGRATION_CHECKLIST.md)
- [`../../SPELL_INTEGRATION_STATUS.md`](../../SPELL_INTEGRATION_STATUS.md)
