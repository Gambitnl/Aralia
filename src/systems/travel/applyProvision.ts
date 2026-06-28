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

/**
 * Loyalty at or below which a starving-march drain makes a companion abandon the
 * party rather than merely grumble. Loyalty is 0–100 ("will they leave/betray").
 */
export const DESERT_LOYALTY_THRESHOLD = 20;

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
): AppAction[] {
  const actions: AppAction[] = [];

  if (provision.rationsToSpend > 0) {
    actions.push({ type: 'REMOVE_ITEM', payload: { itemId: RATIONS_ITEM_ID, count: provision.rationsToSpend } });
  }
  if (provision.waterToSpend > 0) {
    actions.push({ type: 'REMOVE_ITEM', payload: { itemId: WATER_ITEM_ID, count: provision.waterToSpend } });
  }
  for (const condition of provision.conditions ?? []) {
    actions.push({ type: 'SET_PARTY_CONDITION', payload: { condition } });
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
