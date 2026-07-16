// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 07:47:45
 * Dependents: systems/combat/worldScenario/settlementDefenderProjection.ts, systems/combat/worldScenario/settlementEncounterHostility.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file exposes the military facts that belong to a generated settlement.
 *
 * The FMG world already knows which state controls a burg and which regiments
 * are stationed in that burg's atlas cell. Ground and combat consumers use this
 * adapter so they do not independently invent guards, faction names, or troop
 * composition when a player reaches the same place at walking scale.
 *
 * Called by: groundChunkLoader while assembling generated towns
 * Depends on: the cached WorldForge bridge atlas and its military records
 */
import type { Regiment } from '../fmg/military-generator';
import { getBridgeAtlas } from './legacySubmapBridge';

// ============================================================================
// Source Defense Contract
// ============================================================================
// These records retain atlas-scale facts only. They deliberately do not decide
// that the troops are hostile or choose tactical stat blocks; those are separate
// encounter decisions made where the combat context is known.
// ============================================================================

export interface GroundSettlementDefenseUnit {
  unitType: string;
  count: number;
}

export interface GroundSettlementRegiment {
  sourceIndex: number;
  name: string;
  totalTroops: number;
  sourceCellId: number;
  sourceAtlasPoint: { x: number; y: number };
  naval: boolean;
  units: GroundSettlementDefenseUnit[];
}

export interface GroundSettlementDefense {
  burgId: number;
  burgName: string;
  /** Canonical atlas cell used by player location, crime, and encounter systems. */
  sourceCellId: number;
  stateId: number;
  stateName: string;
  stateFullName: string;
  stateForm: string;
  /** FMG's generated preparedness multiplier for the controlling state. */
  stateAlert: number;
  capital: boolean;
  walled: boolean;
  citadel: boolean;
  stationedRegiments: GroundSettlementRegiment[];
}

// ============================================================================
// Atlas Fact Adapter
// ============================================================================
// A regiment is stationed at a settlement only when its authored source cell is
// exactly the burg's source cell. Nearby state troops remain real world facts,
// but they are not silently promoted to this town's local garrison.
// ============================================================================

export function settlementDefenseForBurg(
  worldSeed: number,
  burgId: number,
): GroundSettlementDefense | null {
  const atlas = getBridgeAtlas(worldSeed);
  const burg = atlas.pack.burgs?.[burgId];
  if (!burg || burg.state == null) return null;

  const state = atlas.pack.states?.[burg.state];
  if (!state) return null;

  // The military port adds `alert` after state generation. The legacy State
  // interface has not yet absorbed that additive field, so narrow it locally
  // rather than weakening this bridge with an untyped record.
  const stateWithMilitary = state as typeof state & {
    alert?: number;
    military?: Regiment[];
  };
  const stationedRegiments = (stateWithMilitary.military ?? [])
    .filter((regiment) => regiment.cell === burg.cell)
    .sort((a, b) => Number(a.n) - Number(b.n) || a.i - b.i)
    .map<GroundSettlementRegiment>((regiment) => ({
      sourceIndex: regiment.i,
      name: regiment.name,
      totalTroops: regiment.a,
      sourceCellId: regiment.cell,
      sourceAtlasPoint: { x: regiment.x, y: regiment.y },
      naval: regiment.n === 1,
      units: Object.entries(regiment.u)
        .filter((entry): entry is [string, number] => (
          typeof entry[1] === 'number' && Number.isFinite(entry[1])
        ))
        .map(([unitType, count]) => ({ unitType, count }))
        .sort((a, b) => a.unitType.localeCompare(b.unitType)),
    }));

  return {
    burgId,
    burgName: burg.name ?? `Burg ${burgId}`,
    sourceCellId: burg.cell,
    stateId: state.i,
    stateName: state.name,
    stateFullName: state.fullName ?? state.name,
    stateForm: state.form ?? 'Unknown government',
    stateAlert: stateWithMilitary.alert ?? 0,
    capital: burg.capital === 1,
    walled: burg.walls === 1,
    citadel: burg.citadel === 1,
    stationedRegiments,
  };
}
