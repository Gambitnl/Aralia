// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 09:55:18
 * Dependents: components/World3D/World3DWrapper.tsx, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file frames a live settlement confrontation on an already-extracted
 * WorldForge tactical map.
 *
 * The deterministic scenario lab owns authored camera recipes such as a gate
 * approach. Production combat instead starts where the player is standing, so
 * this adapter finds the generated town and defending regiment that match the
 * confrontation, preserves the hostility receipt, and describes a watch force
 * intercepting the party at the center of the live crop.
 *
 * Called by: World3DWrapper's active GroundWorld combat provider
 * Depends on: settlement hostility and regiment projection policies
 */
import type {
  BattleMapData,
  BattleMapDefendingForce,
  BattleMapEncounterContext,
  BattleMapTile,
} from '@/types/combat';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { GroundSettlementDefense } from '@/systems/worldforge/bridge/settlementDefense';
import {
  resolveSettlementEncounterHostility,
  settlementDefenseLocationId,
  worldforgeStateFactionId,
  type SettlementEncounterHostilityInput,
} from './settlementEncounterHostility';
import { projectSettlementDefendingForce } from './settlementDefenderProjection';

// ============================================================================
// Projection Result
// ============================================================================
// Callers need to distinguish a place with no generated settlement from a real
// settlement whose evidence intentionally withheld combat. Only the first case
// may use the old placeless encounter fallback.
// ============================================================================

export type LiveSettlementEncounterStatus =
  | 'ready'
  | 'withheld'
  | 'source-gap'
  | 'not-applicable';

export interface LiveSettlementEncounterProjection {
  status: LiveSettlementEncounterStatus;
  detail: string;
  mapData: BattleMapData;
  defendingForce?: BattleMapDefendingForce;
}

// ============================================================================
// Source Selection
// ============================================================================

/** Match the confrontation's durable location or faction to one source defense. */
function defenseForConfrontation(
  ground: GroundWorld,
  input: SettlementEncounterHostilityInput,
): GroundSettlementDefense | undefined {
  const trigger = input.trigger;
  if (!trigger) return undefined;

  if (trigger.kind === 'watch-confrontation') {
    return ground.settlementDefenses?.find((defense) => (
      settlementDefenseLocationId(defense) === trigger.locationId
    ));
  }

  return ground.settlementDefenses?.find((defense) => (
    worldforgeStateFactionId(defense.stateId) === trigger.factionId
  ));
}

/** Pick the walkable referee cell nearest the player's exact crop center. */
function centerAnchorTile(mapData: BattleMapData): BattleMapTile | undefined {
  const center = {
    x: Math.floor(mapData.dimensions.width / 2),
    y: Math.floor(mapData.dimensions.height / 2),
  };
  const exact = mapData.tiles.get(`${center.x}-${center.y}`);
  if (exact && !exact.blocksMovement) return exact;

  return [...mapData.tiles.values()]
    .filter((tile) => !tile.blocksMovement)
    .sort((a, b) => (
      Math.hypot(a.coordinates.x - center.x, a.coordinates.y - center.y)
      - Math.hypot(b.coordinates.x - center.x, b.coordinates.y - center.y)
      || a.coordinates.y - b.coordinates.y
      || a.coordinates.x - b.coordinates.x
    ))[0];
}

/**
 * Point from the player toward the responding settlement force.
 *
 * Town center is the honest production cue because a watch interaction can
 * happen at a market or residence, not only at the harness's chosen gate. A
 * due-north fallback keeps deployment deterministic at the exact town center.
 */
function responseHeading(
  ground: GroundWorld,
  defense: GroundSettlementDefense,
  playerWorldMeters: { x: number; z: number },
): { x: number; y: number } {
  const town = ground.towns.find((candidate) => candidate.burgId === defense.burgId);
  const dx = (town?.xM ?? playerWorldMeters.x) - playerWorldMeters.x;
  const dz = (town?.zM ?? playerWorldMeters.z - 1) - playerWorldMeters.z;
  const length = Math.hypot(dx, dz);
  return length > 1e-9 ? { x: dx / length, y: dz / length } : { x: 0, y: -1 };
}

// ============================================================================
// Live Encounter Projection
// ============================================================================

export function projectLiveSettlementEncounter(
  ground: GroundWorld,
  mapData: BattleMapData,
  playerWorldMeters: { x: number; z: number },
  hostilityInput: SettlementEncounterHostilityInput,
): LiveSettlementEncounterProjection {
  const defense = defenseForConfrontation(ground, hostilityInput);
  if (!defense) {
    const sourceSettlementExists = ground.towns.length > 0;
    return {
      status: sourceSettlementExists ? 'source-gap' : 'not-applicable',
      detail: sourceSettlementExists
        ? 'The live GroundWorld contains a generated settlement, but no stationed defense matches this confrontation.'
        : 'The live GroundWorld contains no generated settlement for this confrontation.',
      mapData,
    };
  }

  const hostility = resolveSettlementEncounterHostility(defense, hostilityInput);
  const defendingForce = projectSettlementDefendingForce(defense, hostility);
  if (!defendingForce) {
    return {
      status: 'source-gap',
      detail: `${defense.burgName} has no regiment roles that can currently become tactical actors.`,
      mapData,
    };
  }

  const anchorTile = centerAnchorTile(mapData);
  if (!anchorTile) {
    return {
      status: 'source-gap',
      detail: 'The extracted source map has no walkable cell for the party confrontation anchor.',
      mapData,
      defendingForce,
    };
  }

  const trigger = hostility.trigger;
  const sourceConfrontationId = trigger.kind === 'none'
    ? 'missing-confrontation'
    : trigger.sourceId;
  // Watch arrests and generated-state patrol events share the same live crop
  // geometry, but keep separate encounter kinds so the combat UI and audit
  // harness never mislabel political hostility as a local crime response.
  const responseDirection = responseHeading(ground, defense, playerWorldMeters);
  const encounterContext: BattleMapEncounterContext = trigger.kind === 'state-confrontation'
    ? {
        kind: 'settlement-state-patrol',
        source: 'worldforge-settlement',
        sourceBurgId: defense.burgId,
        sourceFactionId: trigger.factionId,
        sourceConfrontationId,
        anchorTile: anchorTile.coordinates,
        routeDirection: responseDirection,
        deployment: {
          player: 'current-position',
          enemy: 'state-patrol-interception',
        },
        defendingForce,
      }
    : {
        kind: 'settlement-watch',
        source: 'worldforge-settlement',
        sourceBurgId: defense.burgId,
        sourceConfrontationId,
        anchorTile: anchorTile.coordinates,
        routeDirection: responseDirection,
        deployment: {
          player: 'current-position',
          enemy: 'watch-interception',
        },
        defendingForce,
      };
  const contextualMap = { ...mapData, encounterContext };

  if (hostility.verdict !== 'hostile') {
    return {
      status: 'withheld',
      detail: hostility.detail,
      mapData: contextualMap,
      defendingForce,
    };
  }

  return {
    status: 'ready',
    detail: `${defense.burgName}'s ${defendingForce.source.regimentName} is authorized to intercept the party.`,
    mapData: contextualMap,
    defendingForce,
  };
}
