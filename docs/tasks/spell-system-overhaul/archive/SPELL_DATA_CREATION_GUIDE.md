# Legacy Spell Data Creation Guide

**Status:** Historical guide snapshot
**Last Reviewed:** 2026-03-12

## What This File Is

This file preserves an older spell-data authoring guide from before the current levelized spell-data layout and refreshed spell-reference surfaces fully settled.

## Verified Drift

A 2026-03-12 repo check confirmed that several assumptions in the older guide no longer match the maintained workflow:
- active spell files are organized under public/data/spells/level-0 through level-9, not as a flat creation lane
- the guide's old engineHook-era schema example no longer reflects the current validator-first spell structure
- the guide points at older glossary and workflow assumptions that are no longer the main spell-authoring path
- src/types.ts is no longer the right single-source type reference for the spell lane

## Current Reading Rule

Do not use this file as the active spell creation checklist.
Use it only as historical reference for how the spell-data workflow used to be explained.

## Use These Current Docs Instead

- docs/spells/SPELL_JSON_EXAMPLES.md
- docs/spells/SPELL_INTEGRATION_CHECKLIST.md
- docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md
- docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md
- docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md

## Preserved Value

This file still shows what kinds of normalization and authoring concerns the spell migration team originally tried to standardize, but it should not be treated as current schema authority.
