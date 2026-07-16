// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 07:48:58
 * Dependents: systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file converts a regiment-scale WorldForge fact into a small gate patrol.
 *
 * A generated regiment can contain thousands of troops, while the combat map
 * needs a handful of individually playable actors. This adapter makes that
 * lossy conversion explicit: state alert sets the token budget, infantry and
 * archers are sampled proportionally, and unsupported mounted or siege roles
 * remain visible as excluded source facts instead of becoming generic guards.
 *
 * Called by: worldBattleScenario when framing a settlement-edge encounter
 * Depends on: Ground settlement-defense facts and BattleMap combat contracts
 */
import type {
  BattleMapDefendingForce,
  BattleMapSettlementHostility,
} from '@/types/combat';
import type {
  GroundSettlementDefense,
  GroundSettlementDefenseUnit,
  GroundSettlementRegiment,
} from '@/systems/worldforge/bridge/settlementDefense';
import { resolveSettlementEncounterHostility } from './settlementEncounterHostility';

// ============================================================================
// Gate Patrol Semantic Bridges
// ============================================================================
// These mappings connect generated military vocabulary to existing bestiary
// mechanics. Cavalry and artillery are deliberately not faked until mounted
// actors and siege-engine objects have proper tactical behavior.
// ============================================================================

const GATE_PATROL_BESTIARY: Readonly<Record<string, {
  bestiaryName: string;
  roleLabel: string;
}>> = {
  archers: { bestiaryName: 'Scout', roleLabel: 'Archer' },
  infantry: { bestiaryName: 'Guard', roleLabel: 'Infantry' },
};

const CONTEXT_EXCLUDED_GATE_UNITS = new Set(['artillery', 'cavalry', 'fleet']);

// ============================================================================
// Deterministic Proportional Sampling
// ============================================================================
// Largest-remainder allocation keeps the actor count exact while preserving
// source composition as closely as a four-to-six-token patrol allows.
// ============================================================================

function allocateActors(
  units: GroundSettlementDefenseUnit[],
  actorBudget: number,
): Array<GroundSettlementDefenseUnit & { tacticalActors: number }> {
  const totalEligibleTroops = units.reduce((total, unit) => total + unit.count, 0);
  if (totalEligibleTroops <= 0 || actorBudget <= 0) return [];

  const allocations = units.map((unit) => {
    const exactActors = (unit.count / totalEligibleTroops) * actorBudget;
    return {
      ...unit,
      tacticalActors: Math.floor(exactActors),
      remainder: exactActors - Math.floor(exactActors),
    };
  });
  let actorsLeft = actorBudget
    - allocations.reduce((total, allocation) => total + allocation.tacticalActors, 0);

  // Stable tie-breaking means repeated screenshots keep the same composition
  // even when two source units have equal fractional claims.
  const remainderOrder = [...allocations].sort((a, b) => (
    b.remainder - a.remainder
    || b.count - a.count
    || a.unitType.localeCompare(b.unitType)
  ));
  for (let index = 0; actorsLeft > 0; index += 1, actorsLeft -= 1) {
    remainderOrder[index % remainderOrder.length].tacticalActors += 1;
  }

  return allocations.map(({ remainder: _remainder, ...allocation }) => allocation);
}

/** Pick the largest land regiment physically stationed in the settlement cell. */
function primaryGateRegiment(
  defense: GroundSettlementDefense,
): GroundSettlementRegiment | undefined {
  return [...defense.stationedRegiments]
    .filter((regiment) => !regiment.naval)
    .sort((a, b) => b.totalTroops - a.totalTroops || a.sourceIndex - b.sourceIndex)[0];
}

// ============================================================================
// Public Projection
// ============================================================================

export function projectSettlementDefendingForce(
  defense: GroundSettlementDefense,
  hostility: BattleMapSettlementHostility = resolveSettlementEncounterHostility(defense),
): BattleMapDefendingForce | undefined {
  const regiment = primaryGateRegiment(defense);
  if (!regiment) return undefined;

  const eligibleUnits = regiment.units.filter((unit) => GATE_PATROL_BESTIARY[unit.unitType]);
  if (eligibleUnits.length === 0) return undefined;

  // FMG alert is a generated state-level preparedness multiplier. Rounding it
  // gives Legium four actors; clamping prevents tiny or regiment-scale token
  // counts from making the visual harness unreadable.
  const tacticalActorBudget = Math.max(2, Math.min(6, Math.round(defense.stateAlert)));
  const allocatedUnits = allocateActors(eligibleUnits, tacticalActorBudget)
    .filter((unit) => unit.tacticalActors > 0);
  const excludedUnits = regiment.units
    .filter((unit) => !GATE_PATROL_BESTIARY[unit.unitType])
    .map((unit) => ({
      sourceUnitType: unit.unitType,
      sourceTroops: unit.count,
      reason: CONTEXT_EXCLUDED_GATE_UNITS.has(unit.unitType)
        ? 'not-gate-patrol-role' as const
        : 'missing-bestiary-bridge' as const,
    }));

  return {
    source: {
      kind: 'worldforge-state-regiment',
      burgId: defense.burgId,
      burgName: defense.burgName,
      stateId: defense.stateId,
      stateName: defense.stateName,
      stateFullName: defense.stateFullName,
      stateForm: defense.stateForm,
      stateAlert: defense.stateAlert,
      regimentIndex: regiment.sourceIndex,
      regimentName: regiment.name,
      regimentTroops: regiment.totalTroops,
      sourceCellId: regiment.sourceCellId,
    },
    projection: {
      kind: 'gate-patrol-alert-sample-v1',
      tacticalActorBudget,
      tacticalActors: allocatedUnits.reduce(
        (total, unit) => total + unit.tacticalActors,
        0,
      ),
      units: allocatedUnits.map((unit) => ({
        sourceUnitType: unit.unitType,
        sourceTroops: unit.count,
        tacticalActors: unit.tacticalActors,
        ...GATE_PATROL_BESTIARY[unit.unitType],
      })),
      excludedUnits,
      hostility,
    },
  };
}
