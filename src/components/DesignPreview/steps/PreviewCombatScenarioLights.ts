// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/06/2026, 14:48:31
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BattleMapData, LightSource, Position, TargetableMapObject } from '../../../types/combat';

/**
 * This file defines the teaching lights used by the combat scenario preview.
 *
 * The cover sandbox normally runs as a dungeon map, so the visibility system
 * treats it as ambient darkness. These helpers add explicit, named light
 * sources so the board can demonstrate where bright light ends, where dim light
 * begins, and which tiles remain dark. PreviewCombatScenarios.tsx calls this
 * file while constructing the scenario, and the regular BattleMap overlay and
 * useVisibility hook consume the resulting LightSource records.
 */

// ============================================================================
// Cover Sandbox Lighting
// ============================================================================
// This section keeps the cover scenario's torch separate from its wall and
// character placement. That makes the source of the bright/dim circles easier
// to audit without changing combat rules or procedural map generation.
// ============================================================================

export const COVER_SCENARIO_TORCH_ID = 'cover-sandbox-torch';
export const COVER_SCENARIO_TORCH_POSITION: Position = { x: 4, y: 5 };

export function createCoverScenarioTorchObject(): TargetableMapObject {
  // The torch is intentionally loose, mundane, and light. Those facts let it
  // participate in object targeting and movement without pretending it is a
  // fixed dungeon feature like a wall, pillar, or planted brazier.
  return {
    id: COVER_SCENARIO_TORCH_ID,
    name: 'Sandbox Torch',
    position: COVER_SCENARIO_TORCH_POSITION,
    size: 'Tiny',
    weightPounds: 1,
    isWornOrCarried: false,
    isMagical: false,
    isFixedToSurface: false
  };
}

export function createCoverScenarioLightSources(casterId: string): LightSource[] {
  // Place a fixed torch near the player-side firing lane. A 15 ft bright radius
  // and another 15 ft of dim light reveal the nearby cover while leaving the far
  // side dark enough to keep the visibility contrast visible in the sandbox.
  return [{
    id: COVER_SCENARIO_TORCH_ID,
    sourceSpellId: 'sandbox-torch',
    casterId,
    brightRadius: 15,
    dimRadius: 15,
    attachedTo: 'point',
    position: COVER_SCENARIO_TORCH_POSITION,
    color: '#fbbf24',
    createdTurn: 0
  }];
}

export function moveCoverScenarioTorch(
  mapData: BattleMapData,
  lightSources: LightSource[],
  destination: Position
): { mapData: BattleMapData; lightSources: LightSource[] } {
  // Move the object record first because this is the gameplay-facing state that
  // spells and object targeting read.
  const targetableObjects = (mapData.targetableObjects ?? []).map(targetObject =>
    targetObject.id === COVER_SCENARIO_TORCH_ID
      ? { ...targetObject, position: destination }
      : targetObject
  );

  // Then keep the light emitter in lockstep with the object. The current
  // LightSource type has no `attachedTo: object` mode yet, so the sandbox keeps
  // the point light synchronized explicitly while preserving the existing type.
  const movedLightSources = lightSources.map(lightSource =>
    lightSource.id === COVER_SCENARIO_TORCH_ID
      ? { ...lightSource, position: destination }
      : lightSource
  );

  return {
    mapData: {
      ...mapData,
      targetableObjects
    },
    lightSources: movedLightSources
  };
}
