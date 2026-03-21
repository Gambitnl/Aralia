# 11C - Structured Terrain/Utility Actions (Cantrip Gap: Mold Earth)

## Current Repo Status

This file is preserved as task context, but its original "missing feature" framing is now stale.

Repo verification on 2026-03-11 confirmed that the structured terrain-manipulation model already exists:
- `public/data/spells/level-0/mold-earth.json` already uses populated `manipulation` blocks for excavation, difficult terrain, normalization, and cosmetic shaping.
- `src/commands/effects/TerrainCommand.ts` already branches on `effect.manipulation` and handles `excavate`, `fill`, `difficult`, `normal`, and `cosmetic` cases.
- The command already applies and removes difficult terrain and records structured manipulation actions in combat logs.

## What Became Historical

The original version assumed:
- the schema still needed a `manipulation` block
- the terrain system could not read structured Mold Earth actions
- `mold-earth.json` still needed to be migrated out of prose-only terrain descriptions

Those claims no longer describe the repo.

## What Still Looks Incomplete

There are still follow-through gaps worth preserving:
- `src/commands/effects/TerrainCommand.ts` still carries a TODO about preserving terrain effects when map data is absent.
- This audit does not prove that non-battle or longer-lived map/state surfaces consume terrain manipulation with the same fidelity.
- So the live gap is now persistence/integration depth, not absence of the structure itself.

## Maintained Interpretation

Use this file as a current-status reminder:
1. do not reopen the already-implemented `manipulation` schema work
2. focus future work on persistence, broader map integration, and end-to-end proof
3. treat the older text here as historical context for why this surface was added

## Verification Basis

Checked against:
- `public/data/spells/level-0/mold-earth.json`
- `src/commands/effects/TerrainCommand.ts`
