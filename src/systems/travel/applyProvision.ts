/**
 * @file applyProvision.ts — translate a trip's provisioning outcome into reducer
 * actions. Keeping this mapping pure lets App apply gated-travel consequences
 * (spend food/water, mark conditions, drain companion morale) through one tested
 * function instead of a hand-rolled dispatch list at the call site.
 *
 * The note (a player-facing message) is NOT an action — App surfaces it via
 * `addMessage` separately.
 */
import type { AppAction } from '../../state/actionTypes';
import type { TravelProvisionEffect } from '../../types/travelMeta';
import { RATIONS_ITEM_ID, WATER_ITEM_ID } from './provisioning';

/** A companion's id + current loyalty, for the march/desertion decision. */
export interface CompanionLoyaltyView {
  id: string;
  loyalty: number;
}

/** A party member's id + current HP, for the starving-march HP drain. */
export interface PartyHealthView {
  id: string;
  hp: number;
}

/**
 * Loyalty at or below which a starving-march drain makes a companion abandon the
 * party rather than merely grumble. Loyalty is 0–100 ("will they leave/betray").
 */
export const DESERT_LOYALTY_THRESHOLD = 20;

/**
 * HP each member loses on a march that ends (or continues) starving. The drain is
 * NON-LETHAL: it never takes a member below 1 HP — starvation wears the party
 * down (spec: "exhaustion / HP or ability penalty"), it doesn't quietly kill them
 * on the world map.
 */
export const STARVATION_HP_DAMAGE = 2;

/**
 * The reducer actions a committed trip's provisioning effect produces, in apply
 * order: spend rations, spend water, set each party condition, then resolve the
 * companion fallout of a starving march — a companion whose loyalty would drop
 * to/under {@link DESERT_LOYALTY_THRESHOLD} DESERTS; otherwise their loyalty is
 * just drained.
 */
export function buildProvisionActions(
  provision: TravelProvisionEffect,
  companions: readonly CompanionLoyaltyView[],
  partyHealth: readonly PartyHealthView[] = [],
): AppAction[] {
  const actions: AppAction[] = [];
  const conditions = provision.conditions ?? [];
  const endsStarving = conditions.includes('starving');

  if (provision.rationsToSpend > 0) {
    actions.push({ type: 'REMOVE_ITEM', payload: { itemId: RATIONS_ITEM_ID, count: provision.rationsToSpend } });
  }
  if (provision.waterToSpend > 0) {
    actions.push({ type: 'REMOVE_ITEM', payload: { itemId: WATER_ITEM_ID, count: provision.waterToSpend } });
  }
  // Recovery (PRV9): a leg on which the party actually ate AND drank the whole
  // way — both resources spent, not ending starving — is a proper meal cadence,
  // so it clears the travel hardships. Clears go BEFORE the sets below so a
  // half-rations leg re-applies its own 'fatigued' and stays fatigued.
  if (!endsStarving && provision.rationsToSpend > 0 && provision.waterToSpend > 0) {
    actions.push({ type: 'CLEAR_PARTY_CONDITION', payload: { condition: 'starving' } });
    actions.push({ type: 'CLEAR_PARTY_CONDITION', payload: { condition: 'fatigued' } });
  }
  for (const condition of conditions) {
    actions.push({ type: 'SET_PARTY_CONDITION', payload: { condition } });
  }
  // Starvation bite (PRV9): a starving march drains HP, clamped so it never
  // drops a member below 1 HP (non-lethal wear-down, not a map-screen death).
  if (endsStarving) {
    for (const member of partyHealth) {
      const damage = Math.min(STARVATION_HP_DAMAGE, member.hp - 1);
      if (damage > 0) {
        actions.push({ type: 'MODIFY_PARTY_HEALTH', payload: { amount: -damage, characterIds: [member.id] } });
      }
    }
  }
  const delta = provision.companionLoyaltyDelta;
  if (delta) {
    for (const c of companions) {
      if (c.loyalty + delta <= DESERT_LOYALTY_THRESHOLD) {
        actions.push({ type: 'COMPANION_DESERT', payload: { companionId: c.id, reason: 'starvation' } });
      } else {
        actions.push({ type: 'ADJUST_COMPANION_LOYALTY', payload: { companionId: c.id, delta } });
      }
    }
  }

  return actions;
}
