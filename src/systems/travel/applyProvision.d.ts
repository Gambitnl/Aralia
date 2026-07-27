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
export declare const DESERT_LOYALTY_THRESHOLD = 20;
/**
 * HP each member loses on a march that ends (or continues) starving. The drain is
 * NON-LETHAL: it never takes a member below 1 HP — starvation wears the party
 * down (spec: "exhaustion / HP or ability penalty"), it doesn't quietly kill them
 * on the world map.
 */
export declare const STARVATION_HP_DAMAGE = 2;
/**
 * The reducer actions a committed trip's provisioning effect produces, in apply
 * order: spend rations, spend water, set each party condition, then resolve the
 * companion fallout of a starving march — a companion whose loyalty would drop
 * to/under {@link DESERT_LOYALTY_THRESHOLD} DESERTS; otherwise their loyalty is
 * just drained.
 */
export declare function buildProvisionActions(provision: TravelProvisionEffect, companions: readonly CompanionLoyaltyView[], partyHealth?: readonly PartyHealthView[]): AppAction[];
