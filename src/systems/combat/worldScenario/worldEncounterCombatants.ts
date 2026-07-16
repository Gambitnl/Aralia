// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 07:49:33
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns an inspectable WorldForge defending-force receipt into the
 * normal CombatCharacter records used by the playable battle map.
 *
 * The projection policy has already chosen roles and counts. This adapter only
 * loads matching bestiary mechanics and stamps stable source provenance onto
 * each actor, so the visual harness exercises real attacks, HP, initiative, and
 * movement without returning to the generic combat-demo enemy roster.
 *
 * Called by: PreviewBattleMapScenarioLab before mounting BattleMapDemo
 * Depends on: the runtime monster registry and the standard enemy converter
 */
import type { BattleMapDefendingForce, CombatCharacter } from '@/types/combat';
import type { Monster } from '@/types';
import { loadMonstersData } from '@/data/monsters';
import { createEnemyFromMonster } from '@/utils/combat/createEnemyFromMonster';

// ============================================================================
// Stable Combatant Requests
// ============================================================================
// Requests are pure and inspectable. Loading the large bestiary is kept in the
// public async adapter below so world-scenario generation itself stays small.
// ============================================================================

interface DefenderCombatantRequest {
  globalIndex: number;
  roleIndex: number;
  sourceUnitType: string;
  bestiaryName: string;
  roleLabel: string;
}

function defenderCombatantRequests(
  force: BattleMapDefendingForce,
): DefenderCombatantRequest[] {
  const requests: DefenderCombatantRequest[] = [];
  for (const unit of force.projection.units) {
    for (let roleIndex = 0; roleIndex < unit.tacticalActors; roleIndex += 1) {
      requests.push({
        globalIndex: requests.length,
        roleIndex,
        sourceUnitType: unit.sourceUnitType,
        bestiaryName: unit.bestiaryName,
        roleLabel: unit.roleLabel,
      });
    }
  }
  return requests;
}

// ============================================================================
// Combat Character Construction
// ============================================================================

export async function createWorldDefenderCombatants(
  force: BattleMapDefendingForce | undefined,
): Promise<CombatCharacter[]> {
  // The regiment projection can exist for inspection even when no fight is
  // authorized. Only an explicit hostile receipt may promote representatives
  // into the enemy team.
  if (!force || force.projection.hostility.verdict !== 'hostile') return [];

  // The registry is lazy by design. Await it before conversion so a source
  // defender never falls through to the converter's generic fallback stats.
  await loadMonstersData();

  return defenderCombatantRequests(force).map((request) => {
    const monster: Monster = {
      name: request.bestiaryName,
      quantity: 1,
      cr: '1/8',
      description: `${request.roleLabel} sampled from ${force.source.regimentName}.`,
    };
    const combatant = createEnemyFromMonster(monster, request.globalIndex);
    const representativeIndex = request.roleIndex + 1;

    return {
      ...combatant,
      id: [
        'worldforge-defender',
        force.source.stateId,
        force.source.regimentIndex,
        request.sourceUnitType,
        representativeIndex,
      ].join(':'),
      name: `${force.source.stateName} ${request.roleLabel} ${representativeIndex}`,
      worldSource: {
        kind: 'worldforge-defender',
        burgId: force.source.burgId,
        stateId: force.source.stateId,
        regimentIndex: force.source.regimentIndex,
        unitType: request.sourceUnitType,
        representativeIndex,
      },
    };
  });
}
