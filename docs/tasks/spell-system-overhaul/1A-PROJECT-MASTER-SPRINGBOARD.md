# Spell System Project - Master Springboard

**Last Updated**: 2026-03-11  
**Status**: Active springboard with preserved historical context  
**Purpose**: Provide the best current project-level entry point for the spell-system-overhaul subtree while clearly flagging older planning assumptions that still live in nearby docs.

## What This File Is

This is the main springboard for the spell-system-overhaul docs.

It is intentionally narrower than older versions:
- it preserves the core mission of the spell-system overhaul
- it points to the main live subtree surfaces
- it avoids presenting stale counts, timelines, and missing files as if they were still current truth

## Project Mission

The spell-system-overhaul effort is still aimed at moving Aralia away from brittle or overly inferred spell handling toward a more structured spell system that supports:
1. richer spell data
2. stronger mechanical execution in combat and related systems
3. clearer workflow for migration and validation
4. room for AI or narrative adjudication where purely mechanical handling is not enough

## Current Reality

This subtree now mixes multiple documentation eras:
- an older phased 27-task architecture plan
- later cantrip and migration-batch work
- workflow and prompt-heavy coordination docs
- gap-analysis, summary, and support files

Because of that:
- some files remain valuable as historical planning context
- some files are still active work surfaces
- some files overclaim authority and are being normalized during the current docs overhaul

## Best Documents To Read First

### Current orientation

1. this file
2. [`README.md`](./README.md)
3. [`START-HERE.md`](./START-HERE.md)

### Historical phased-plan context

4. [`00-TASK-INDEX.md`](./00-TASK-INDEX.md)
5. [`00-PARALLEL-ARCHITECTURE.md`](./00-PARALLEL-ARCHITECTURE.md)

### Current spell-status and integration context outside this subtree

6. [`../../SPELL_INTEGRATION_STATUS.md`](../../SPELL_INTEGRATION_STATUS.md)
7. [`../../spells/SPELL_INTEGRATION_CHECKLIST.md`](../../spells/SPELL_INTEGRATION_CHECKLIST.md)
8. [`../../architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

## Verified Current Notes

- `src/types/spells.ts` exists.
- `src/systems/spells/validation/` exists.
- `public/data/spells_manifest.json` currently contains a larger spell set than the older 2025 counts recorded in this subtree.
- the older `public/data/glossary/entries/spells/` path referenced by some subtree docs is not currently present.
- current repo commands come from [`package.json`](../../../package.json), including:
  - `npm run validate`
  - `npm run test`
  - `npm run typecheck`

## Current Cautions

When reading older docs in this subtree, verify before trusting:
- exact spell counts
- cantrip migration percentages
- timeline estimates
- missing or "to be created" workflow files
- older command names such as `npm run type-check`

One especially important example:
- earlier docs expected a `1C-JULES-WORKFLOW-CONSOLIDATED.md` file
- that file does not currently exist

## What Still Seems Directionally Useful

Even though many details drifted, these themes still matter:
- spell data migration is important
- validation and structured spell data are still a major concern
- mechanical execution, targeting, and integration layers are still relevant design areas
- the subtree history explains why there are so many migration batches, workflow docs, and support notes

## Practical Start Paths

### If you need the current broad picture

Read:
1. this file
2. [`README.md`](./README.md)
3. [`../../SPELL_INTEGRATION_STATUS.md`](../../SPELL_INTEGRATION_STATUS.md)

### If you need the older full-plan architecture

Read:
1. [`00-TASK-INDEX.md`](./00-TASK-INDEX.md)
2. [`00-PARALLEL-ARCHITECTURE.md`](./00-PARALLEL-ARCHITECTURE.md)

### If you need migration workflow context

Read the workflow and support docs that actually exist in this folder, especially:
- `@WORKFLOW-SPELL-CONVERSION.md`
- `SPELL-WORKFLOW-QUICK-REF.md`
- `BATCH-CREATION-GUIDE.md`

## Maintenance Rule

This file should remain the honest springboard for the subtree.

That means:
- keep it broad
- keep it current
- do not let it drift back into a stale metrics dashboard
- do not let it claim missing files or outdated commands are still authoritative
