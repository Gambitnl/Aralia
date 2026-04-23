# Spell Sub-Classes Handover

This is the single entrypoint for the next agent working the `Sub-Classes`
bucket.

Read this first, then use the linked files below as supporting context.

## Current State

- canonical -> structured is the active lane
- live canonical-side count: `186`
- structured -> json is currently resolved at `0`
- the normalized spell layers now use explicit markers for empty subclass states:
  - `Folded into Classes`
  - `Unsupported Entries`
  - `No Subclass Entries`
- runtime JSON keeps real `subClasses` separate from the status marker field
  `subClassesStatus`

## What The Bucket Means

The bucket is about subclass-only spell access.

Working rule:

- only supported subclass-only access should move into normalized structured
  `.md` and runtime JSON
- repeated-base-only cases are not real subclass-only access and should use
  `Folded into Classes`
- unsupported subclass labels are not kept in the normalized spell layers and
  should use `Unsupported Entries` if they appear in a reviewed spell
- if a spell has no subclass lines at all, use `No Subclass Entries`

## What Still Needs Work

- continue the canonical-first pass for the live `186` canonical-side cases
- transfer supported subclass-only access into structured `.md`
- keep runtime JSON aligned through the structured layer
- retire `subClassesVerification` only after the bucket is fully closed

## The Files To Read

Primary working log:
- [SPELL_SUB_CLASSES_BUCKET_TRACKER.md](F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_BUCKET_TRACKER.md)

Support roster:
- [SPELL_SUPPORTED_SUBCLASS_ROSTERS.md](F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUPPORTED_SUBCLASS_ROSTERS.md)

Live reports:
- [SPELL_STRUCTURED_VS_CANONICAL_REPORT.md](F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md)
- [SPELL_STRUCTURED_VS_JSON_REPORT.md](F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md)

Gate checker surfaces:
- [useSpellGateChecks.ts](F:\Repos\Aralia\src\hooks\useSpellGateChecks.ts)
- [GlossaryEntryPanel.tsx](F:\Repos\Aralia\src\components\Glossary\GlossaryEntryPanel.tsx)

Representative spell file:
- [hold-monster.md](F:\Repos\Aralia\docs\spells\reference\level-5\hold-monster.md)
- [hold-monster.json](F:\Repos\Aralia\public\data\spells\level-5\hold-monster.json)

## Use The Tracker For Details

The working tracker carries the live subbucket split, progress log, guardrails,
and the spell-by-spell examples.

Use this handover file to orient quickly. Use the tracker when you need the
fine-grained bucket details.
