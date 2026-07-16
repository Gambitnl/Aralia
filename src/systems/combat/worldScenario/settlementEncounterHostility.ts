// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 15/07/2026, 09:56:09
 * Dependents: systems/combat/fightInPlace/activeGroundCombatSession.ts, systems/combat/worldScenario/liveSettlementEncounter.ts, systems/combat/worldScenario/settlementDefenderProjection.ts, systems/combat/worldScenario/statePatrolWorldEvent.ts, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file decides whether a generated settlement patrol may become enemies.
 *
 * WorldForge supplies the settlement and controlling state, but those facts do
 * not say what the party has done. Combat therefore requires two independent
 * receipts: an explicit confrontation trigger and matching player-state
 * evidence (a witnessed local crime or a hostile state standing). Missing or
 * mismatched evidence keeps the patrol out of the enemy team.
 *
 * Called by: worldBattleScenario while attaching a defending force
 * Depends on: the existing crime-location and faction-standing semantics
 */
import type { Crime } from '@/types/crime';
import { CrimeType } from '@/types/crime';
import type { PlayerFactionStanding } from '@/types/factions';
import type {
  BattleMapSettlementHostility,
  BattleMapSettlementHostilityTrigger,
} from '@/types/combat';
import type { GroundSettlementDefense } from '@/systems/worldforge/bridge/settlementDefense';
import { makeCellLocationId } from '@/utils/location/cellLocationId';
import { isWantedInTown } from '@/systems/social/watchReaction';
import { getReputationTier, REPUTATION_THRESHOLDS } from '@/utils/world/factionUtils';

// ============================================================================
// Inputs And Durable Identity
// ============================================================================

export type SettlementEncounterTrigger = Exclude<
  BattleMapSettlementHostilityTrigger,
  { kind: 'none' }
>;

export interface SettlementEncounterHostilityInput {
  trigger?: SettlementEncounterTrigger;
  knownCrimes?: readonly Crime[];
  playerStanding?: Pick<PlayerFactionStanding, 'factionId' | 'publicStanding'>;
}

/** Stable faction key for an FMG state that is not part of the authored faction registry. */
export function worldforgeStateFactionId(stateId: number): string {
  return `worldforge-state:${stateId}`;
}

/** Crime and confrontation systems key procedural locations by atlas cell. */
export function settlementDefenseLocationId(defense: GroundSettlementDefense): string {
  return makeCellLocationId(defense.sourceCellId);
}

const noTrigger = (): BattleMapSettlementHostilityTrigger => ({
  kind: 'none',
  source: 'none',
  summary: 'No confrontation event asks this settlement force to engage the party.',
});

const withholdCombat = (
  trigger: BattleMapSettlementHostilityTrigger,
  relation: BattleMapSettlementHostility['relation'],
  detail: string,
): BattleMapSettlementHostility => ({
  rule: 'explicit-trigger-plus-matching-relation-v1',
  verdict: 'withhold-combat',
  trigger,
  relation,
  detail,
});

// ============================================================================
// Hostility Resolution
// ============================================================================

/**
 * Resolve patrol hostility without mutating WorldForge or player state.
 *
 * A bad standing or wanted record is not enough by itself: guards only enter
 * combat when a matching scene trigger says a confrontation is happening now.
 */
export function resolveSettlementEncounterHostility(
  defense: GroundSettlementDefense,
  input?: SettlementEncounterHostilityInput,
): BattleMapSettlementHostility {
  const trigger = input?.trigger ?? noTrigger();
  if (trigger.kind === 'none') {
    return withholdCombat(trigger, {
      kind: 'none',
      source: 'none',
      detail: 'Player-state relations were not evaluated because no confrontation was triggered.',
    }, 'Military presence is retained as context, but no combat is authorized.');
  }

  if (trigger.kind === 'watch-confrontation') {
    const expectedLocationId = settlementDefenseLocationId(defense);
    const witnessedCrimeIds = (input?.knownCrimes ?? [])
      .filter((crime) => crime.witnessed && crime.locationId === trigger.locationId)
      .map((crime) => crime.id);
    const relation: BattleMapSettlementHostility['relation'] = isWantedInTown(
      input?.knownCrimes,
      trigger.locationId,
    )
      ? {
          kind: 'wanted-in-location',
          source: 'player-crime-state',
          locationId: trigger.locationId,
          witnessedCrimeIds,
        }
      : {
          kind: 'none',
          source: 'none',
          detail: `No witnessed crime marks the party wanted in ${trigger.locationId}.`,
        };

    if (trigger.locationId !== expectedLocationId) {
      return withholdCombat(
        trigger,
        relation,
        `The confrontation targets ${trigger.locationId}, not this settlement's ${expectedLocationId} source cell.`,
      );
    }
    if (relation.kind !== 'wanted-in-location') {
      return withholdCombat(
        trigger,
        relation,
        'A watch confrontation was requested, but matching wanted evidence is absent.',
      );
    }

    return {
      rule: 'explicit-trigger-plus-matching-relation-v1',
      verdict: 'hostile',
      trigger,
      relation,
      detail: `${relation.witnessedCrimeIds.length} witnessed local crime record authorizes the watch confrontation.`,
    };
  }

  const expectedFactionId = worldforgeStateFactionId(defense.stateId);
  const standing = input?.playerStanding;
  if (!standing || standing.factionId !== trigger.factionId) {
    return withholdCombat(trigger, {
      kind: 'none',
      source: 'none',
      detail: `No player standing matches confrontation faction ${trigger.factionId}.`,
    }, 'A state confrontation was requested without a matching player-faction relation.');
  }

  const tier = getReputationTier(standing.publicStanding);
  const hostileThreshold = REPUTATION_THRESHOLDS.HOSTILE.max;
  const relation: BattleMapSettlementHostility['relation'] = {
    kind: 'state-standing',
    source: 'player-faction-standing',
    factionId: standing.factionId,
    publicStanding: standing.publicStanding,
    tier,
    hostileThreshold,
    qualifiesAsHostile: standing.publicStanding <= hostileThreshold,
  };

  if (trigger.factionId !== expectedFactionId) {
    return withholdCombat(
      trigger,
      relation,
      `The confrontation targets ${trigger.factionId}, not controlling state ${expectedFactionId}.`,
    );
  }
  if (!relation.qualifiesAsHostile) {
    return withholdCombat(
      trigger,
      relation,
      `${tier} standing (${standing.publicStanding}) does not meet the hostile threshold (${hostileThreshold}).`,
    );
  }

  return {
    rule: 'explicit-trigger-plus-matching-relation-v1',
    verdict: 'hostile',
    trigger,
    relation,
    detail: `${tier} standing (${standing.publicStanding}) authorizes the state confrontation.`,
  };
}

// ============================================================================
// Deterministic Visual-Harness Fixture
// ============================================================================

/**
 * Create the explicit player-state fixture used by the Legium visual scenario.
 * The fixture is labeled at every layer so it can prove the hostility bridge
 * without pretending a witnessed assault was generated by WorldForge.
 */
export function createVisualHarnessWantedWatchInput(
  defense: GroundSettlementDefense,
  fixtureId: string,
): SettlementEncounterHostilityInput {
  const locationId = settlementDefenseLocationId(defense);
  return {
    trigger: {
      kind: 'watch-confrontation',
      source: 'visual-harness',
      sourceId: fixtureId,
      locationId,
      summary: `A wanted party approaches ${defense.burgName}'s guarded gate and the watch moves to arrest.`,
    },
    knownCrimes: [{
      id: `${fixtureId}:witnessed-assault`,
      type: CrimeType.Assault,
      locationId,
      timestamp: 0,
      severity: 60,
      witnessed: true,
    }],
  };
}

/**
 * Create the explicitly labeled hostile-standing fixture used by the state
 * patrol visual scenario. The generated state and faction id still come from
 * the real settlement defense; only the player's hostile standing is synthetic.
 */
export function createVisualHarnessHostileStateInput(
  defense: GroundSettlementDefense,
  fixtureId: string,
): SettlementEncounterHostilityInput {
  const factionId = worldforgeStateFactionId(defense.stateId);
  return {
    trigger: {
      kind: 'state-confrontation',
      source: 'visual-harness',
      sourceId: fixtureId,
      factionId,
      summary: `${defense.stateFullName}'s patrol recognizes a publicly hostile party near ${defense.burgName}.`,
    },
    playerStanding: {
      factionId,
      publicStanding: -55,
    },
  };
}
