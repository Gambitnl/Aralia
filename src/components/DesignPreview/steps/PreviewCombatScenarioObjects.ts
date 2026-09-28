// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 22/06/2026, 01:02:58
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines movable map objects for Tactical Sandbox scenarios.
 *
 * Object interaction is a separate mechanic from character movement and spell
 * targeting, so the preview keeps object records in one helper. The cover
 * torch still lives with the light helpers because it also owns a light source;
 * this file is for ordinary objects whose main proof is selection, movement,
 * and targetability.
 */

import type { BattleMapData, Position, TargetableMapObject } from '../../../types/combat';

// ============================================================================
// Object Interaction Lane
// ============================================================================
// The crate is intentionally mundane and loose. That gives the sandbox a stable
// object id to select and move without implying special rules such as a fixed
// door, a magical item, or an object carried by a creature.
// ============================================================================

export const OBJECT_INTERACTION_CRATE_ID = 'object-interaction-crate';

export function createObjectInteractionCrate(): TargetableMapObject {
  return {
    id: OBJECT_INTERACTION_CRATE_ID,
    name: 'Training Crate',
    position: { x: 6, y: 5 },
    size: 'Medium',
    weightPounds: 40,
    isWornOrCarried: false,
    isMagical: false,
    isFixedToSurface: false,
    // The sandbox crate is a real public container with finite durability.
    // Reset Board calls this factory again, restoring every mutable fact and
    // clearing replay receipts instead of partially repairing live state.
    interactionState: {
      kind: 'container',
      isOpen: false,
      useCount: 0,
      hitPoints: 10,
      maxHitPoints: 10,
      destroyed: false,
      resolvedEventIds: [],
    },
  };
}

export function moveScenarioObject(
  mapData: BattleMapData,
  objectId: string,
  destination: Position
): BattleMapData {
  // Preserve every object record except the selected one. The helper is narrow
  // on purpose: later object lanes can add breakage, locking, or carrying rules
  // without changing the simple "move this loose object" proof path.
  return {
    ...mapData,
    targetableObjects: (mapData.targetableObjects ?? []).map(targetObject =>
      targetObject.id === objectId
        ? { ...targetObject, position: destination }
        : targetObject
    )
  };
}
