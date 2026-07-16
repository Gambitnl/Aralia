// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 09:53:33
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file decides when a generated state's patrol recognizes and intercepts
 * the party inside a real WorldForge settlement.
 *
 * The patrol event is deliberately deterministic. It requires the player to be
 * inside the source town's ground envelope, a real stationed land regiment, and
 * a hostile standing with that exact generated state. A save-backed receipt
 * then limits the event to once per settlement per game day, so returning from
 * combat cannot immediately launch the same fight again.
 *
 * Called by: World3DWrapper while the player moves through a live GroundWorld
 * Depends on: settlement defense facts and the shared hostility referee
 */
import type { PlayerFactionStanding } from '@/types/factions';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { GroundSettlementDefense } from '@/systems/worldforge/bridge/settlementDefense';
import {
  resolveSettlementEncounterHostility,
  worldforgeStateFactionId,
  type SettlementEncounterTrigger,
} from './settlementEncounterHostility';

// ============================================================================
// Durable Event Receipt
// ============================================================================
// The receipt records that this particular world event already occurred. It is
// separate from WorldForge terrain deltas because an encounter is narrative
// history, not a mutation of a road, building, or other generated artifact.
// ============================================================================

export interface WorldforgeEncounterReceipt {
  id: string;
  kind: 'state-patrol-interception';
  worldSeed: number;
  gameDay: number;
  triggeredAtGameTimeMs: number;
  sourceCellId: number;
  burgId: number;
  stateId: number;
  factionId: string;
  playerGroundMeters: { x: number; z: number };
}

export interface StatePatrolWorldEvent {
  id: string;
  trigger: Extract<SettlementEncounterTrigger, { kind: 'state-confrontation' }>;
  receipt: WorldforgeEncounterReceipt;
  defense: GroundSettlementDefense;
  standing: PlayerFactionStanding;
  distanceFromTownCenterM: number;
  recognitionRadiusM: number;
}

export interface StatePatrolWorldEventInput {
  worldSeed: number;
  gameDay: number;
  gameTimeMs: number;
  playerGroundMeters: { x: number; z: number };
  playerFactionStandings: Readonly<Record<string, PlayerFactionStanding>>;
  receipts?: readonly Pick<WorldforgeEncounterReceipt, 'id'>[];
}

// ============================================================================
// Recognition Policy
// ============================================================================
// A short margin beyond the generated town envelope lets a gate patrol notice
// an approaching hostile party before they cross the first building footprint.
// Six meters is roughly one combat movement step and remains small relative to
// generated settlement radii.
// ============================================================================

export const STATE_PATROL_RECOGNITION_MARGIN_M = 6;

/** Build the stable once-per-day identity shared by the event and save receipt. */
export function statePatrolWorldEventId(
  worldSeed: number,
  defense: Pick<GroundSettlementDefense, 'sourceCellId' | 'burgId' | 'stateId'>,
  gameDay: number,
): string {
  return [
    'worldforge-state-patrol',
    worldSeed,
    defense.sourceCellId,
    defense.burgId,
    defense.stateId,
    `day-${gameDay}`,
  ].join(':');
}

/** A patrol can exist only when WorldForge stationed a usable land force here. */
function hasStationedLandForce(defense: GroundSettlementDefense): boolean {
  return defense.stationedRegiments.some((regiment) => (
    !regiment.naval
    && regiment.totalTroops > 0
    && regiment.units.some((unit) => unit.count > 0)
  ));
}

/**
 * Find the nearest eligible generated-state patrol event at the player's exact
 * ground position. The shared hostility referee remains the final authority;
 * this scan only supplies it with the explicit world-event trigger.
 */
export function findStatePatrolWorldEvent(
  ground: GroundWorld,
  input: StatePatrolWorldEventInput,
): StatePatrolWorldEvent | null {
  const consumedIds = new Set((input.receipts ?? []).map((receipt) => receipt.id));

  // Rank overlapping settlement envelopes by real ground distance and then by
  // burg identity so one position always chooses the same source settlement.
  const nearbyDefenses = (ground.settlementDefenses ?? [])
    .flatMap((defense) => {
      const town = ground.towns.find((candidate) => candidate.burgId === defense.burgId);
      if (!town || !hasStationedLandForce(defense)) return [];
      const distanceFromTownCenterM = Math.hypot(
        input.playerGroundMeters.x - town.xM,
        input.playerGroundMeters.z - town.zM,
      );
      const recognitionRadiusM = Math.max(0, town.halfM) + STATE_PATROL_RECOGNITION_MARGIN_M;
      return distanceFromTownCenterM <= recognitionRadiusM
        ? [{ defense, distanceFromTownCenterM, recognitionRadiusM }]
        : [];
    })
    .sort((left, right) => (
      left.distanceFromTownCenterM - right.distanceFromTownCenterM
      || left.defense.burgId - right.defense.burgId
    ));

  for (const nearby of nearbyDefenses) {
    const factionId = worldforgeStateFactionId(nearby.defense.stateId);
    const standing = input.playerFactionStandings[factionId];
    if (!standing) continue;

    const id = statePatrolWorldEventId(
      input.worldSeed,
      nearby.defense,
      input.gameDay,
    );
    if (consumedIds.has(id)) continue;

    const trigger: StatePatrolWorldEvent['trigger'] = {
      kind: 'state-confrontation',
      source: 'world-event',
      sourceId: id,
      factionId,
      summary: `${nearby.defense.stateFullName}'s patrol recognizes a hostile party near ${nearby.defense.burgName}.`,
    };
    const hostility = resolveSettlementEncounterHostility(nearby.defense, {
      trigger,
      playerStanding: standing,
    });
    if (hostility.verdict !== 'hostile') continue;

    return {
      id,
      trigger,
      defense: nearby.defense,
      standing,
      distanceFromTownCenterM: nearby.distanceFromTownCenterM,
      recognitionRadiusM: nearby.recognitionRadiusM,
      receipt: {
        id,
        kind: 'state-patrol-interception',
        worldSeed: input.worldSeed,
        gameDay: input.gameDay,
        triggeredAtGameTimeMs: input.gameTimeMs,
        sourceCellId: nearby.defense.sourceCellId,
        burgId: nearby.defense.burgId,
        stateId: nearby.defense.stateId,
        factionId,
        playerGroundMeters: { ...input.playerGroundMeters },
      },
    };
  }

  return null;
}
