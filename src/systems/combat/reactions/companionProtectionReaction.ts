// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 06:57:12
 * Dependents: components/DesignPreview/steps/scenarioControls/companionReactionsScenarioControls.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves one ally protecting another with the Interception Fighting Style.
 *
 * It exists because the ordinary damage command currently asks only the damaged
 * creature about its own reactions. A caller that has already identified a possible
 * protector can use this transaction to validate ownership, team, range, sight,
 * equipment, condition, and Reaction state before reducing the incoming damage.
 * The result applies final damage through the shared downing helper and reports every
 * fact needed by a future combat reaction chooser or the Tactical Sandbox.
 *
 * Called by: companionReactionsScenarioControls and future damage-event arbitration.
 * Depends on: canonical feat data, combat distance/sight, action economy, and HP helpers.
 */

import { FEATS_DATA } from '../../../data/feats/featsData';
import type { BattleMapData, CombatCharacter } from '../../../types/combat';
import { calculateProficiencyBonus } from '../../../utils/character/savingThrowUtils';
import { canAffordActionCost, consumeActionCost } from '../../../utils/combat/actionEconomyUtils';
import { getCharacterDistance, rollDamage } from '../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned, isIncapacitated } from '../../../utils/combat/deathSaveUtils';
import { hasLineOfSight } from '../../../utils/spatial/lineOfSight';

// ============================================================================
// Canonical Interception Facts
// ============================================================================
// The runtime reads the existing fighting-style record instead of teaching this
// resolver a second name or description. The 5-foot ally distance and 1d10 roll
// are the structured form of the same rule text and are exported for live proof.
// ============================================================================

export const INTERCEPTION_STYLE_ID = 'interception_style';
export const INTERCEPTION_RANGE_FEET = 5;
export const INTERCEPTION_REDUCTION_DICE = '1d10';

const INTERCEPTION_STYLE = FEATS_DATA.find(feat => feat.id === INTERCEPTION_STYLE_ID);

export const INTERCEPTION_STYLE_NAME = INTERCEPTION_STYLE?.name ?? 'Interception Fighting Style';
export const INTERCEPTION_STYLE_DESCRIPTION = INTERCEPTION_STYLE?.description ?? '';

// ============================================================================
// Resolution Contract
// ============================================================================
// A rejected result returns the original actors and zero reduction. This makes
// it impossible for a range, sight, ownership, or resource failure to partially
// spend a Reaction or alter HP before a caller sees the reason.
// ============================================================================

export type CompanionProtectionReactionReason =
  | 'resolved'
  | 'canonical_rule_unavailable'
  | 'attack_missed'
  | 'no_incoming_damage'
  | 'not_distinct_actors'
  | 'protector_not_owned_by_owner'
  | 'protected_target_not_allied'
  | 'attacker_not_hostile'
  | 'protector_missing_interception'
  | 'protector_missing_weapon_or_shield'
  | 'protected_target_out_of_range'
  | 'protected_target_not_visible'
  | 'protector_incapacitated'
  | 'protector_reaction_unavailable';

export interface CompanionProtectionReactionInput {
  owner: CombatCharacter;
  protector: CombatCharacter;
  protectedTarget: CombatCharacter;
  attacker: CombatCharacter;
  mapData: BattleMapData;
  attack: {
    isHit: boolean;
    damage: number;
    damageType: string;
  };
  /** Tests and deterministic previews inject a die source; normal combat uses Math.random. */
  reductionRng?: () => number;
}

export interface CompanionProtectionReactionReceipt {
  outcome: 'resolved' | 'rejected';
  reason: CompanionProtectionReactionReason;
  owner: CombatCharacter;
  protector: CombatCharacter;
  protectedTarget: CombatCharacter;
  attacker: CombatCharacter;
  distanceFeet: number;
  lineOfSight: boolean;
  incomingDamage: number;
  reductionRoll: number;
  proficiencyBonus: number;
  totalReduction: number;
  finalDamage: number;
  protectedHPBefore: number;
  protectedHPAfter: number;
  summary: string;
}

// ============================================================================
// Eligibility Helpers
// ============================================================================
// Ownership uses the same summon/controlled-ally seam that initiative and
// command handling already trust. Equipment accepts a projected shield or any
// authored weapon ability, matching the canonical "weapon or shield" gate.
// ============================================================================

function isOwnedCompanion(owner: CombatCharacter, protector: CombatCharacter): boolean {
  return protector.isSummon === true && protector.summonMetadata?.casterId === owner.id;
}

function hasInterceptionEquipment(protector: CombatCharacter): boolean {
  const carriesShield = Boolean(protector.equipment?.shield);
  const carriesWeapon = protector.abilities.some(ability => Boolean(ability.weapon));
  return carriesShield || carriesWeapon;
}

function readLineOfSight(
  protector: CombatCharacter,
  protectedTarget: CombatCharacter,
  mapData: BattleMapData,
): boolean {
  const protectorTile = mapData.tiles.get(`${protector.position.x}-${protector.position.y}`);
  const targetTile = mapData.tiles.get(`${protectedTarget.position.x}-${protectedTarget.position.y}`);
  if (!protectorTile || !targetTile) return false;
  return hasLineOfSight(protectorTile, targetTile, mapData);
}

function reject(
  input: CompanionProtectionReactionInput,
  reason: CompanionProtectionReactionReason,
  distanceFeet: number,
  lineOfSight: boolean,
): CompanionProtectionReactionReceipt {
  return {
    outcome: 'rejected',
    reason,
    owner: input.owner,
    protector: input.protector,
    protectedTarget: input.protectedTarget,
    attacker: input.attacker,
    distanceFeet,
    lineOfSight,
    incomingDamage: Math.max(0, input.attack.damage),
    reductionRoll: 0,
    proficiencyBonus: calculateProficiencyBonus(input.protector.level),
    totalReduction: 0,
    finalDamage: 0,
    protectedHPBefore: input.protectedTarget.currentHP,
    protectedHPAfter: input.protectedTarget.currentHP,
    summary: `${INTERCEPTION_STYLE_NAME} rejected: ${reason}. No Reaction, HP, or damage effect changed.`,
  };
}

// ============================================================================
// Ordered Protection Transaction
// ============================================================================
// Eligibility is fully checked before payment. A legal response then spends the
// protector's Reaction, rolls 1d10 plus proficiency, reduces no more than the
// incoming damage, and sends only the remainder through canonical HP/downing.
// ============================================================================

export function resolveCompanionProtectionReaction(
  input: CompanionProtectionReactionInput,
): CompanionProtectionReactionReceipt {
  // The shared footprint helper reports grid cells. Interception rule text is
  // written in feet, so convert one adjacent cell to the canonical 5 feet.
  const distanceFeet = getCharacterDistance(input.protector, input.protectedTarget) * 5;
  const lineOfSight = readLineOfSight(input.protector, input.protectedTarget, input.mapData);

  if (!INTERCEPTION_STYLE || !INTERCEPTION_STYLE_DESCRIPTION) {
    return reject(input, 'canonical_rule_unavailable', distanceFeet, lineOfSight);
  }
  if (!input.attack.isHit) {
    return reject(input, 'attack_missed', distanceFeet, lineOfSight);
  }
  if (input.attack.damage <= 0) {
    return reject(input, 'no_incoming_damage', distanceFeet, lineOfSight);
  }
  // The owner witnesses who controls the companion, so the owner may also be
  // the ally receiving protection. The three combat roles must still be
  // different people, and the owner cannot be the protector or the attacker.
  const hasInvalidActorOverlap =
    input.protector.id === input.protectedTarget.id
    || input.protector.id === input.attacker.id
    || input.protectedTarget.id === input.attacker.id
    || input.owner.id === input.protector.id
    || input.owner.id === input.attacker.id;
  if (hasInvalidActorOverlap) {
    return reject(input, 'not_distinct_actors', distanceFeet, lineOfSight);
  }
  if (!isOwnedCompanion(input.owner, input.protector)) {
    return reject(input, 'protector_not_owned_by_owner', distanceFeet, lineOfSight);
  }
  if (input.protector.team !== input.protectedTarget.team || input.owner.team !== input.protector.team) {
    return reject(input, 'protected_target_not_allied', distanceFeet, lineOfSight);
  }
  if (input.attacker.team === input.protectedTarget.team) {
    return reject(input, 'attacker_not_hostile', distanceFeet, lineOfSight);
  }
  if (!input.protector.feats?.includes(INTERCEPTION_STYLE_ID)) {
    return reject(input, 'protector_missing_interception', distanceFeet, lineOfSight);
  }
  if (!hasInterceptionEquipment(input.protector)) {
    return reject(input, 'protector_missing_weapon_or_shield', distanceFeet, lineOfSight);
  }
  if (distanceFeet > INTERCEPTION_RANGE_FEET) {
    return reject(input, 'protected_target_out_of_range', distanceFeet, lineOfSight);
  }
  if (!lineOfSight) {
    return reject(input, 'protected_target_not_visible', distanceFeet, lineOfSight);
  }
  if (isIncapacitated(input.protector)) {
    return reject(input, 'protector_incapacitated', distanceFeet, lineOfSight);
  }
  if (!canAffordActionCost(input.protector, { type: 'reaction' })) {
    return reject(input, 'protector_reaction_unavailable', distanceFeet, lineOfSight);
  }

  // Pay only after every rule gate succeeds. The owner never subsidizes or
  // mirrors this payment; controlled companions keep independent economies.
  const paidProtector = consumeActionCost(input.protector, { type: 'reaction' });
  const reductionRoll = rollDamage(
    INTERCEPTION_REDUCTION_DICE,
    false,
    1,
    input.reductionRng ?? Math.random,
  );
  const proficiencyBonus = calculateProficiencyBonus(input.protector.level);
  const totalReduction = Math.min(input.attack.damage, reductionRoll + proficiencyBonus);
  const finalDamage = Math.max(0, input.attack.damage - totalReduction);
  const protectedTarget = applyDamageAndCheckDowned(input.protectedTarget, finalDamage);

  // When the owner is also the protected ally, both receipt roles must point
  // to the same damaged character. This keeps HP, downing state, and the
  // owner's still-ready Reaction from splitting into contradictory copies.
  const owner = input.owner.id === protectedTarget.id ? protectedTarget : input.owner;

  return {
    outcome: 'resolved',
    reason: 'resolved',
    owner,
    protector: paidProtector,
    protectedTarget,
    attacker: input.attacker,
    distanceFeet,
    lineOfSight,
    incomingDamage: input.attack.damage,
    reductionRoll,
    proficiencyBonus,
    totalReduction,
    finalDamage,
    protectedHPBefore: input.protectedTarget.currentHP,
    protectedHPAfter: protectedTarget.currentHP,
    summary: `${INTERCEPTION_STYLE_NAME} resolved: ${input.attack.damage} ${input.attack.damageType} incoming - ${reductionRoll} (${INTERCEPTION_REDUCTION_DICE}) - ${proficiencyBonus} proficiency = ${finalDamage} damage. ${input.protector.name} spends its Reaction; ${input.owner.name} keeps its own Reaction.`,
  };
}
