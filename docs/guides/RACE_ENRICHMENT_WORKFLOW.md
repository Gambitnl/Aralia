# Race Enrichment Workflow

Last Updated: 2026-03-11
Purpose: Document the current race-sync workflow that keeps glossary race entries aligned with character-creator race data.

## Current Status

This workflow is still active and script-backed.

Verified anchors in this pass:
- scripts/sync-glossary-races-with-character-creator.ts
- scripts/audit-race-sync.ts
- scripts/audits/verify-cc-glossary-race-sync.ts
- npm run audit:races in package.json

## What This Workflow Does

The current workflow keeps these surfaces aligned:
- src/data/races/*.ts
- public/data/glossary/entries/races/**/*.json
- public/data/glossary/index/character_races.json

The main sync script currently handles things like:
- canonical race-id normalization
- glossary maleImageUrl and femaleImageUrl alignment with character-creator visuals
- grouped character_races index regeneration based on the current character-creator grouping model

## Current Command Sequence

Run from repo root:
- npx tsx scripts/sync-glossary-races-with-character-creator.ts
- npm run audit:races
- npx tsx scripts/audits/verify-cc-glossary-race-sync.ts
- npm run build

## Practical Pass Criteria

Treat the workflow as passing when:
- the sync script completes cleanly
- npm run audit:races reports the expected coverage state
- verify-cc-glossary-race-sync.ts reports no blocking mismatches
- npm run build still succeeds after the data changes

## Scope Note

This workflow is about glossary-character-creator race alignment.

It is not the full race-addition workflow by itself, and it is not the portrait-regeneration workflow.

## Common Drift To Avoid

Do not treat:
- unenriched_races.txt
- older hand-edited grouped-index assumptions
- race image paths stored in only one lane

as the active source of truth without checking the current sync scripts first.
