/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/battleMapBridge.ts
 * Wires pressure plates and secret doors to the tactical BattleMap.
 *
 * This file resolves two integration markers that had sat unwired since the
 * puzzle package was written:
 *
 *  - #903: pressure plate trigger zones in the BattleMap movement handler.
 *  - #911: secret doors revealed by BattleMap rendering once detected or open.
 *
 * Why the bridge lives here rather than in the BattleMap code: the BattleMap has
 * no state container for puzzle props. `BattleMapData` carries tiles, targetable
 * objects, and occupants, and none of those can hold a `PressurePlate` or a
 * `SecretDoor`. Rather than force a puzzle record into a combat type, this file
 * owns a small side layer keyed by the BattleMap's own `"x-y"` tile ids, and
 * exposes two pure functions shaped for the exact seams the BattleMap already
 * has:
 *
 *  - `resolvePlateTriggers` is shaped like `processTileEffects`, the existing
 *    on-enter hook in hooks/combat/engine/useCombatEngine.ts that
 *    `handleMoveExecution` calls the moment a new position is accepted.
 *  - `getSecretDoorTileView` returns a tile presentation override in the same
 *    vocabulary `BattleMapTile` already renders (`BattleMapTerrain`), so the
 *    renderer needs no new drawing concept to show a revealed door.
 *
 * What is preserved: the puzzle rules stay in pressurePlateSystem and
 * secretDoorSystem. This file only decides which plate a moving creature stepped
 * on and how a door's state should look, and it never invents a check.
 *
 * Called by: the BattleMap movement and render paths once those call sites are
 * inserted (tracked as GG-215 in docs/projects/GLOBAL_GAPS.md).
 * Depends on: types/combat for the tactical vocabulary, pressurePlateSystem for
 * the trigger rule, and ./types for the puzzle records.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 09/09/2026, 15:02:05
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BattleMapTerrain, CombatCharacter, Position } from '../../types/combat';
import { checkPressurePlate, updatePressurePlateState } from './pressurePlateSystem';
import type {
  PressurePlate,
  PressurePlateResult,
  SecretDoor,
  SecretDoorState,
  SizeCategory,
  Trap,
} from './types';

// ============================================================================
// Tile Keys
// ============================================================================
// BattleMapTile.id is the string "x-y" and BattleMapData.tiles is keyed the same
// way. The puzzle layer reuses that key exactly so a plate or door can never
// drift out of alignment with the tile it sits on.
// ============================================================================

export function tileIdForPosition(position: Position): string {
  return `${position.x}-${position.y}`;
}

// ============================================================================
// The Puzzle Layer
// ============================================================================
// `PressurePlate` has no coordinates of its own, so placement is recorded here
// instead of being added to the puzzle record. `SecretDoor` already carries a
// `tileId`, so doors are stored as-is and need no wrapper.
// ============================================================================

export interface PlacedPressurePlate {
  plate: PressurePlate;
  /** BattleMap tile id, "x-y". */
  tileId: string;
  /** Trap this plate fires, if any. Matched against `plate.linkedTrapId`. */
  trap?: Trap;
}

export interface BattleMapPuzzleLayer {
  plates: PlacedPressurePlate[];
  doors: SecretDoor[];
}

export function createBattleMapPuzzleLayer(
  plates: PlacedPressurePlate[] = [],
  doors: SecretDoor[] = [],
): BattleMapPuzzleLayer {
  return { plates, doors };
}

// ============================================================================
// Movement Triggers (#903)
// ============================================================================
// The existing movement path already resolves spell zones against the whole
// `movementPath`, not just the destination, because walking through a zone is
// enough to set it off. Plates behave the same way, so this function takes the
// path and reports every plate along it, in step order.
// ============================================================================

export interface PressurePlateTrigger {
  plateId: string;
  tileId: string;
  position: Position;
  result: PressurePlateResult;
}

export interface ResolvePlateTriggersInput {
  layer: BattleMapPuzzleLayer;
  /** The creature that moved. Only its identity is used; see `occupantSize`. */
  character: CombatCharacter;
  /**
   * Tiles the creature entered this move, destination last. Callers on the
   * tactical side already carry this as `CombatAction.movementPath`.
   */
  movementPath: Position[];
  /**
   * Size of the moving creature. `CombatCharacter` carries no size field today,
   * so the caller supplies it; 'Medium' is the same default the plate rule has
   * always used for a character with no size override.
   */
  occupantSize?: SizeCategory;
}

/**
 * Reports every pressure plate the creature set off during one move.
 *
 * Mutating behavior is inherited deliberately: `checkPressurePlate` already
 * marks a plate pressed in place, and the reset pass afterwards is the same
 * `updatePressurePlateState` call the plate rules expect at the end of an
 * interaction. Keeping both here means the tactical caller does not have to
 * know the plate lifecycle to use the result.
 */
export function resolvePlateTriggers(input: ResolvePlateTriggersInput): PressurePlateTrigger[] {
  const occupant = { ageSizeOverride: input.occupantSize };
  const triggers: PressurePlateTrigger[] = [];

  for (const position of input.movementPath) {
    const tileId = tileIdForPosition(position);

    for (const placed of input.layer.plates) {
      if (placed.tileId !== tileId) continue;

      // A plate only fires for a trap it is actually linked to. The rule owns
      // that match; the trap is passed through so the rule can read its state.
      const result = checkPressurePlate(occupant, placed.plate, placed.trap);
      if (!result.triggered) continue;

      triggers.push({
        plateId: placed.plate.id,
        tileId,
        position,
        result,
      });
    }
  }

  // Auto-resetting plates rise again once the creature has walked on. A plate
  // the creature is still standing on is the destination tile, so it is left
  // pressed.
  const destinationTileId = input.movementPath.length > 0
    ? tileIdForPosition(input.movementPath[input.movementPath.length - 1])
    : null;

  for (const placed of input.layer.plates) {
    if (placed.tileId === destinationTileId) continue;
    updatePressurePlateState(placed.plate);
  }

  return triggers;
}

// ============================================================================
// Secret Door Rendering (#911)
// ============================================================================
// `BattleMapTerrain` has no "door" member and adding one would change every
// terrain switch in the renderer. A secret door is therefore expressed in terms
// the renderer already understands: it reads as wall until it opens, and the
// separate `revealed` flag is what tells the renderer to draw a discovery
// marker over an otherwise unchanged wall tile.
// ============================================================================

export interface SecretDoorTileView {
  tileId: string;
  /** Terrain the tile should render as while the door is in this state. */
  terrain: BattleMapTerrain;
  /** True once the party knows the door is there: 'detected', 'open', 'closed'. */
  revealed: boolean;
  /** True only when the passage is actually walkable. */
  passable: boolean;
  /** Short label for a tooltip or discovery marker; null while still hidden. */
  label: string | null;
  state: SecretDoorState;
}

export function getSecretDoorTileView(door: SecretDoor): SecretDoorTileView {
  // 'closed' means a door the party has already opened and shut again, so it
  // stays revealed. Only 'hidden' conceals the door from the player.
  const revealed = door.state !== 'hidden';
  const passable = door.state === 'open';

  return {
    tileId: door.tileId,
    terrain: passable ? 'floor' : 'wall',
    revealed,
    passable,
    label: revealed ? door.name : null,
    state: door.state,
  };
}

/**
 * Builds the render overrides for every door on the map, keyed by tile id.
 *
 * A hidden door is included with `revealed: false` on purpose rather than being
 * filtered out: the renderer needs to keep drawing it as ordinary wall, and a
 * caller that diffs this map between frames can then see the exact moment a
 * search flipped a door to 'detected'.
 */
export function getSecretDoorTileViews(
  layer: BattleMapPuzzleLayer,
): Map<string, SecretDoorTileView> {
  const views = new Map<string, SecretDoorTileView>();

  for (const door of layer.doors) {
    views.set(door.tileId, getSecretDoorTileView(door));
  }

  return views;
}
