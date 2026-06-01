# Physics System North Star

Status: active
Last updated: 2026-05-31

## Why this project exists

This project covers movement, terrain, environmental effects, and elemental-state mechanics used by combat movement validation, pathfinding, area effects, and weather/terrain interactions.

It is intentionally registered as partial implementation because related physics behavior is split across system, utility, and hook layers.

## Scope

- `src/systems/physics`: elemental state and interaction engine.
- `src/utils/movementUtils.ts`, `src/utils/physicsUtils.ts`, `src/utils/spatial/pathfinding.ts`, `src/utils/spatial/lineOfSight.ts`: movement and LOS math.
- `src/hooks/combat/useGridMovement.ts`, `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/engine/useCombatEngine.ts`, `src/hooks/combat/useTurnManager.ts`: movement, movement effects, and turn timing.
- `src/systems/environment/*` and `src/commands/effects/TerrainCommand.ts`: terrain, hazards, weather modifiers, and tile mutation.
- `src/types/elemental.ts`, `src/types/environment.ts`, `src/types/combat.ts`: foundational types.

## Implemented state

- Elemental interaction core exists: `applyStateToTags` handles `StateTag` reactions from `StateInteractions` and returns final tag outcomes.
- Movement math exists and is tested for 5-10-5 diagonal costs, tile cost normalization, pathfinding, and map reachability.
- Terrain and environmental effects are represented in combat maps via `environmentalEffects` and are mutated by `TerrainCommand`.
- Environment systems define base terrain rules, weather profiles, hazards, and modifier hooks.
- Combat turn flow already links round completion to `ROUND_DURATION_SECONDS` via `useTurnManager` callbacks.

## Integration map

- Commands feed the physics outcomes: `DamageCommand`, `StatusConditionCommand`, and `TerrainCommand`.
- Command effects are consumed by hooks: `useActionExecutor` (movement + tile triggers), `useCombatEngine` (damage/effects ticks), `useTurnManager` (round timing).
- Spatial/physical utility layer (`pathfinding`, `movementUtils`, `physicsUtils`) is directly imported by both combat hooks and movement UI hooks.
- Environmental systems (`EnvironmentSystem`, `WeatherSystem`, `hazards`) are imported in combat-adjacent command paths and rules.

## Concrete file map

- `src/systems/physics/ElementalInteractionSystem.ts`
- `src/systems/physics/Physics_Ralph.md`
- `src/systems/physics/__tests__/ElementalInteractionSystem.test.ts`
- `src/types/elemental.ts`
- `src/types/combat.ts`
- `src/types/environment.ts`
- `src/utils/movementUtils.ts`
- `src/utils/combat/physicsUtils.ts`
- `src/utils/spatial/pathfinding.ts`
- `src/utils/spatial/lineOfSight.ts`
- `src/hooks/combat/useGridMovement.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/hooks/combat/engine/useCombatEngine.ts`
- `src/hooks/combat/useTurnManager.ts`
- `src/commands/effects/TerrainCommand.ts`
- `src/systems/environment/EnvironmentSystem.ts`
- `src/systems/environment/TerrainSystem.ts`
- `src/systems/environment/WeatherSystem.ts`
- `src/systems/environment/hazards.ts`

## Gaps that are part of this project

- Elemental reactions are currently one-step only and do not re-run recursively after producing a new state.
- `DamageCommand` does not apply elemental state transitions to `CombatCharacter.stateTags`; integration exists in comments only.
- Engine tile effect handling is partly inconsistent: commands write `environmentalEffects[]`, while cleanup/effects code still reads `(tile as any).environmentalEffect` in some paths.
- Line of sight ignores elevation even though weather/terrain data includes height in tiles.
- Opportunity-attack timing is documented as retroactive after move commit.
- Physics utility TODOs remain for suffocation and throw-distance integration with inventory flow.
- Object-level collision/AC/HP hooks exist as utility stubs but are not fully connected to combat target flow.

## Next checks for next handoff

- Verify state transition wiring from elemental damage/status effects into `stateTags` without regressions.
- Resolve `environmentalEffects` versus `environmentalEffect` handling into a single stable tile effect model.
- Add tests for element reaction recursion and turn-ordered movement collision interactions.
- Confirm `useTurnManager` round timing assumptions against world-time consumers outside combat.

## Resume path

1. Read this file.
2. Read `docs/projects/physics/TRACKER.md`.
3. Read `docs/projects/physics/GAPS.md`.
