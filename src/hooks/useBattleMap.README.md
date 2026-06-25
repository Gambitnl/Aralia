# useBattleMap Hook (`src/hooks/useBattleMap.ts`)

## Purpose

`useBattleMap` coordinates battle-map interaction state for the 2D and 3D combat
map surfaces. It keeps selected-character state, action mode, movement previews,
and ability target clicks aligned with the active turn.

## Lifecycle

```mermaid
flowchart TD
  Render["Battle map renders hook"] --> Positions["Derive character position map"]
  Positions --> CurrentTurn["Resolve current turn character"]
  CurrentTurn --> Selection{"Current actor is player?"}
  Selection -->|yes| AutoMove["Auto-resolve player selection and move mode"]
  Selection -->|no| Idle["No selectable action mode"]
  AutoMove --> Movement["useGridMovement calculates valid moves and path state"]
  Movement --> TileClick["Tile click"]
  Movement --> CharacterClick["Character click"]
  TileClick --> Targeting{"Ability targeting active?"}
  CharacterClick --> Targeting
  Targeting -->|yes| AbilitySystem["Delegate target validation to useAbilitySystem"]
  Targeting -->|no| MoveCheck["Validate selected player and movement tile"]
  MoveCheck --> Path["Find path and calculate movement cost"]
  Path --> Execute["turnManager.executeAction"]
  Execute --> Clear["Clear movement preview on success"]
```

## Ownership Boundaries

- `useBattleMap` owns click interpretation, local selection state, action mode,
  and movement preview lifecycle.
- `useGridMovement` owns valid-move and active-path state.
- `useAbilitySystem` owns final spell or ability target validation and feedback.
- `useTurnManager` owns executing movement actions and turn-cost accounting.

## Deferred Risks

- Character positions are rebuilt from the character list each render cycle.
- Pathfinding still recalculates frequently and may need caching if combat maps
  become larger or more dynamic.
- View/camera state is intentionally outside this hook; rendering surfaces should
  keep those concerns local unless a shared map viewport model is introduced.
