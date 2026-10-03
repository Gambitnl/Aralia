// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 05:18:19
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Multiattack & Attack Riders actions.
 *
 * After Reset, each button prepares one Venom Drake and two authored targets,
 * then asks the shared Multiattack resolver to spend one Action and resolve Bite
 * and Claw separately. The resolver delegates attack rolls, damage, HP, poison
 * immunity, and the hit-gated venom rider to canonical combat helpers. The host
 * renders the returned characters in 2D and 3D, so the control keeps no parallel
 * browser-only hit, rider, action-economy, or health state. This is an isolated
 * deterministic transaction; normal monster-data dispatch remains a separate path.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: shared stat/proficiency, action-economy, Multiattack, and rider types.
 */

import type {
  ActiveRider,
  CombatCharacter,
  CombatState,
} from '../../../../types/combat';
import { getAbilityModifierValue } from '../../../../utils/character/statUtils';
import { calculateProficiencyBonus } from '../../../../utils/character/savingThrowUtils';
import { canAffordActionCost } from '../../../../utils/combat/actionEconomyUtils';
import {
  resolveMultiattackSequence,
  type MultiattackSequenceResolution,
  type MultiattackStrikeRequest,
  type MultiattackStrikeResolution,
} from '../../../../utils/combat/multiattackUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Auditable Board Facts
// ============================================================================
// Both targets use AC 16 and 40 HP. The level-5, Strength-16 drake derives +6,
// so d20 12 hits at 18 while d20 7 misses at 13. Midpoint damage rolls produce
// Bite 9, Claw 8, and the first-hit Venom Rider 4 Poison.
// ============================================================================

export const MULTIATTACK_RIDERS_ATTACKER_ID = 'multiattack_riders-attacker';
export const MULTIATTACK_RIDERS_GUARD_ID = 'multiattack_riders-guard';
export const MULTIATTACK_RIDERS_WARD_ID = 'multiattack_riders-ward';

export const MULTIATTACK_RIDERS_ATTACKER_START = { x: 5, y: 5 } as const;
export const MULTIATTACK_RIDERS_GUARD_START = { x: 8, y: 4 } as const;
export const MULTIATTACK_RIDERS_WARD_START = { x: 8, y: 6 } as const;

export const MULTIATTACK_RIDERS_TARGET_AC = 16;
export const MULTIATTACK_RIDERS_TARGET_HP = 40;
export const MULTIATTACK_RIDERS_ATTACK_BONUS = 6;
export const MULTIATTACK_RIDERS_BITE_DAMAGE = 9;
export const MULTIATTACK_RIDERS_CLAW_DAMAGE = 8;
export const MULTIATTACK_RIDERS_VENOM_DAMAGE = 4;

const FIXED_DAMAGE_RNG = (): number => 0.5;

interface MultiattackActors {
  attacker: CombatCharacter;
  guard: CombatCharacter;
  ward: CombatCharacter;
}

interface ScenarioSequenceRequest {
  biteTargetId: string;
  biteRoll: number;
  clawTargetId: string;
  clawRoll: number;
  venomTargetId: string;
  poisonImmuneTargetId?: string;
}

// ============================================================================
// Reset-Isolated Actor And Rider Setup
// ============================================================================
// Reset Board supplies the unspent Action and full target HP. A control adds the
// authored Venom record without refreshing resources itself, so clicking again
// proves canonical repeat rejection instead of silently beginning a new turn.
// ============================================================================

function requireActors(
  application: PreviewCombatScenarioControlApplication,
): MultiattackActors | null {
  const attacker = application.snapshot.characters.find(
    character => character.id === MULTIATTACK_RIDERS_ATTACKER_ID,
  );
  const guard = application.snapshot.characters.find(
    character => character.id === MULTIATTACK_RIDERS_GUARD_ID,
  );
  const ward = application.snapshot.characters.find(
    character => character.id === MULTIATTACK_RIDERS_WARD_ID,
  );

  return attacker && guard && ward ? { attacker, guard, ward } : null;
}

function createVenomRider(targetId: string): ActiveRider {
  return {
    id: 'multiattack-riders-venom',
    spellId: 'venomous-bite',
    casterId: MULTIATTACK_RIDERS_ATTACKER_ID,
    sourceName: 'Venom Rider',
    targetId,
    effect: {
      type: 'DAMAGE',
      trigger: {
        type: 'on_attack_hit',
        frequency: 'every_time',
        consumption: 'first_hit',
        attackFilter: { attackType: 'weapon', weaponType: 'melee' },
      },
      condition: { type: 'hit' },
      damage: { dice: '1d6', type: 'Poison' },
    },
    consumption: 'first_hit',
    attackFilter: { attackType: 'weapon', weaponType: 'melee' },
    usedThisTurn: false,
    duration: { type: 'special' },
  };
}

function prepareTarget(
  target: CombatCharacter,
  name: string,
  position: { x: number; y: number },
  poisonImmune: boolean,
): CombatCharacter {
  return {
    ...target,
    name,
    position: { ...position },
    team: 'player',
    currentHP: MULTIATTACK_RIDERS_TARGET_HP,
    maxHP: MULTIATTACK_RIDERS_TARGET_HP,
    tempHP: 0,
    armorClass: MULTIATTACK_RIDERS_TARGET_AC,
    baseAC: MULTIATTACK_RIDERS_TARGET_AC,
    damagedThisTurn: false,
    resistances: [],
    immunities: poisonImmune ? ['Poison'] : [],
    vulnerabilities: [],
  };
}

function prepareActors(
  actors: MultiattackActors,
  request: ScenarioSequenceRequest,
): MultiattackActors {
  const preparedAttacker: CombatCharacter = {
    ...actors.attacker,
    name: 'Venom Drake (Multiattack · +6)',
    level: 5,
    team: 'enemy',
    creatureTypes: ['Dragon'],
    position: { ...MULTIATTACK_RIDERS_ATTACKER_START },
    stats: { ...actors.attacker.stats, strength: 16, size: 'Large' },
    riders: [createVenomRider(request.venomTargetId)],
  };

  return {
    attacker: preparedAttacker,
    guard: prepareTarget(
      actors.guard,
      'Iron Guard (AC 16 · 40 HP)',
      MULTIATTACK_RIDERS_GUARD_START,
      request.poisonImmuneTargetId === MULTIATTACK_RIDERS_GUARD_ID,
    ),
    ward: prepareTarget(
      actors.ward,
      request.poisonImmuneTargetId === MULTIATTACK_RIDERS_WARD_ID
        ? 'Venom Ward (POISON IMMUNE)'
        : 'Venom Ward (AC 16 · 40 HP)',
      MULTIATTACK_RIDERS_WARD_START,
      request.poisonImmuneTargetId === MULTIATTACK_RIDERS_WARD_ID,
    ),
  };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: MultiattackActors,
): CombatCharacter[] {
  const replacements = new Map<string, CombatCharacter>([
    [actors.attacker.id, actors.attacker],
    [actors.guard.id, actors.guard],
    [actors.ward.id, actors.ward],
  ]);

  return characters.map(character => replacements.get(character.id) ?? character);
}

// ============================================================================
// Canonical Resolution State
// ============================================================================
// The shared sequence resolver needs the same compact CombatState envelope used
// by command execution. Only the board, characters, and rider-relevant fields
// are populated; no hidden scenario state is created outside that envelope.
// ============================================================================

function createResolutionState(
  application: PreviewCombatScenarioControlApplication,
  actors: MultiattackActors,
): CombatState {
  return {
    isActive: true,
    characters: replaceActors(application.snapshot.characters, actors),
    turnState: {
      currentTurn: 1,
      turnOrder: [actors.attacker.id, actors.guard.id, actors.ward.id],
      currentCharacterId: actors.attacker.id,
      phase: 'action',
      actionsThisTurn: [],
    },
    selectedCharacterId: actors.attacker.id,
    selectedAbilityId: 'multiattack',
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: application.snapshot.reactiveTriggers,
    activeLightSources: application.snapshot.activeLightSources,
    spellZones: application.snapshot.spellZones,
    mapData: application.snapshot.mapData ?? undefined,
  };
}

function createStrike(
  id: 'bite' | 'claw',
  targetId: string,
  d20Roll: number,
  attackBonus: number,
): MultiattackStrikeRequest {
  return {
    id,
    label: id === 'bite' ? 'Bite' : 'Claw',
    targetId,
    d20Roll,
    attackBonus,
    damageFormula: id === 'bite' ? '1d8+4' : '1d6+4',
    damageType: id === 'bite' ? 'Piercing' : 'Slashing',
    attackType: 'weapon',
    weaponType: 'melee',
    damageRng: FIXED_DAMAGE_RNG,
  };
}

// ============================================================================
// Reasoned Combat Log
// ============================================================================
// The panel log narrates the structured resolver result. HP, hit state, and
// rider damage all come from that result rather than being recalculated here.
// ============================================================================

function formatStrike(outcome: MultiattackStrikeResolution): string {
  const attackMath = `${outcome.label} → ${outcome.targetName}: d20 ${outcome.d20Roll} + ${outcome.attackBonus} = ${outcome.attackTotal} vs AC ${outcome.targetArmorClass}`;

  if (!outcome.isHit) {
    return `${attackMath}, MISS; no base damage and no Venom Rider`;
  }

  const baseDamage = `${outcome.baseDamageRolled} base damage`;
  if (outcome.triggeredRiderNames.length === 0) {
    return `${attackMath}, HIT; ${baseDamage}; HP ${outcome.targetHpBefore} → ${outcome.targetHpAfter}`;
  }

  const riderDamage = outcome.riderDamageApplied === 0 && outcome.riderDamageRolled > 0
    ? `Venom Rider ${outcome.riderDamageRolled} Poison → 0 (immune)`
    : `Venom Rider ${outcome.riderDamageRolled} Poison`;
  return `${attackMath}, HIT; ${baseDamage} + ${riderDamage}; HP ${outcome.targetHpBefore} → ${outcome.targetHpAfter}`;
}

function formatSequenceLog(resolution: MultiattackSequenceResolution): string {
  if (!resolution.attempted) {
    return `Multiattack did not resolve: ${resolution.failure ?? 'unknown failure'}.`;
  }

  const attacker = resolution.state.characters.find(
    character => character.id === MULTIATTACK_RIDERS_ATTACKER_ID,
  );
  const actionState = attacker?.actionEconomy.action.used ? 'SPENT once' : 'not spent';
  return `Multiattack Action ${actionState}: ${resolution.strikes.map(formatStrike).join(' | ')}. Each authored attack kept its own target and hit result.`;
}

// ============================================================================
// Control Routing And Registration
// ============================================================================
// Four inert buttons isolate opposite hit/miss orders, two-target success, and
// poison immunity. Reset Board remains the host-level reset to authored state.
// ============================================================================

function resolveScenarioSequence(
  application: PreviewCombatScenarioControlApplication,
  request: ScenarioSequenceRequest,
): PreviewCombatScenarioControlPatch {
  const foundActors = requireActors(application);
  if (!foundActors) {
    return { logMessage: 'Multiattack control skipped because its drake or two authored targets are unavailable.' };
  }

  // A second click in the same turn is a real rejected attempt. Only the host's
  // Reset Board action restores the fixture and its Action; this control must not
  // refill resources, rebuild riders, or touch target HP on a failed repeat.
  if (!canAffordActionCost(foundActors.attacker, { type: 'action' })) {
    return {
      logMessage: 'Multiattack did not resolve: action_unavailable. Use Reset Board to begin a fresh isolated transaction.',
    };
  }

  const actors = prepareActors(foundActors, request);
  const attackBonus = getAbilityModifierValue(actors.attacker.stats.strength)
    + calculateProficiencyBonus(actors.attacker.level || 1);
  const resolution = resolveMultiattackSequence({
    state: createResolutionState(application, actors),
    attackerId: actors.attacker.id,
    strikes: [
      createStrike('bite', request.biteTargetId, request.biteRoll, attackBonus),
      createStrike('claw', request.clawTargetId, request.clawRoll, attackBonus),
    ],
  });

  return {
    characters: resolution.state.characters,
    logMessage: formatSequenceLog(resolution),
  };
}

function applyMultiattackRidersControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Multiattack control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'bite-hit-claw-miss') {
    return resolveScenarioSequence(application, {
      biteTargetId: MULTIATTACK_RIDERS_GUARD_ID,
      biteRoll: 12,
      clawTargetId: MULTIATTACK_RIDERS_WARD_ID,
      clawRoll: 7,
      venomTargetId: MULTIATTACK_RIDERS_GUARD_ID,
    });
  }

  if (application.controlId === 'bite-miss-claw-hit') {
    return resolveScenarioSequence(application, {
      biteTargetId: MULTIATTACK_RIDERS_GUARD_ID,
      biteRoll: 7,
      clawTargetId: MULTIATTACK_RIDERS_WARD_ID,
      clawRoll: 12,
      venomTargetId: MULTIATTACK_RIDERS_GUARD_ID,
    });
  }

  if (application.controlId === 'split-target-hits') {
    return resolveScenarioSequence(application, {
      biteTargetId: MULTIATTACK_RIDERS_GUARD_ID,
      biteRoll: 12,
      clawTargetId: MULTIATTACK_RIDERS_WARD_ID,
      clawRoll: 12,
      venomTargetId: MULTIATTACK_RIDERS_GUARD_ID,
    });
  }

  if (application.controlId === 'poison-immunity') {
    return resolveScenarioSequence(application, {
      biteTargetId: MULTIATTACK_RIDERS_WARD_ID,
      biteRoll: 12,
      clawTargetId: MULTIATTACK_RIDERS_GUARD_ID,
      clawRoll: 12,
      venomTargetId: MULTIATTACK_RIDERS_WARD_ID,
      poisonImmuneTargetId: MULTIATTACK_RIDERS_WARD_ID,
    });
  }

  return { logMessage: `Unknown Multiattack control: ${application.controlId}.` };
}

const multiattackRidersScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'multiattack_riders',
  controls: [
    {
      id: 'bite-hit-claw-miss',
      label: 'Bite hits · Claw misses',
      description: 'Spend one action, hit the Iron Guard with Bite and venom, then miss the Venom Ward with Claw.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'bite-miss-claw-hit',
      label: 'Bite misses · Claw hits',
      description: 'Reverse the rolls: the Bite rider stays dormant while the independent Claw damages its target.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'split-target-hits',
      label: 'Both hit split targets',
      description: 'Resolve Bite against the Iron Guard and Claw against the Venom Ward within the same action.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'poison-immunity',
      label: 'Venom vs immunity',
      description: 'Hit the Poison-immune ward: Bite still damages it, but the hit-gated 1d6 Poison rider applies 0.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyMultiattackRidersControl,
};

export default multiattackRidersScenarioControls;
