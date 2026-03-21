# 11A - Dynamic Lighting Support (Cantrip Gap: Light)

## Current Repo Status

This file is preserved as task context, but its original "missing feature" framing is now stale.

Repo verification on 2026-03-11 confirmed that the structured lighting model and the first runtime path already exist:
- `public/data/spells/level-0/light.json` already uses `utilityType: "light"` plus a populated `light` block.
- `src/types/combat.ts` already defines `LightSource` and `activeLightSources`.
- `src/commands/effects/UtilityCommand.ts` already creates a `LightSource` entry when a utility effect uses the `light` block.
- `src/commands/__tests__/LightMechanics.test.ts` already exists, so this is no longer only a schema-design task.

## What Became Historical

The original version assumed:
- the schema still needed a `light` block
- the engine had no runtime path for structured light sources
- `light.json` still needed to be migrated into the newer data shape

Those claims no longer describe the repo.

## What Still Looks Incomplete

The feature does still have follow-through gaps:
- `src/commands/effects/UtilityCommand.ts` still carries a TODO about expiring/removing active light sources when duration ends or concentration breaks.
- The same TODO also calls out renderer and vision updates, so the data path exists but the full visual/map-consumption story is not yet proven complete by this doc.
- This file should therefore be read as a follow-through brief, not as proof that dynamic lighting is entirely absent.

## Maintained Interpretation

Use this file as a narrow reminder of the remaining work:
1. verify expiration/cleanup of active light sources
2. verify that battle-map or vision rendering actually consumes `activeLightSources`
3. avoid re-opening schema or data-migration work that the repo already completed

## Verification Basis

Checked against:
- `public/data/spells/level-0/light.json`
- `src/types/combat.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/commands/__tests__/LightMechanics.test.ts`
