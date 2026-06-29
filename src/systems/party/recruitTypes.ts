/**
 * @file recruitTypes.ts — shared types for the party-member recruitment flow.
 *
 * A "join the party" event spans TWO unlinked stores (see DISCOVERY §1):
 *   - `state.party: PlayerCharacter[]`     — the playable roster (stats, HP, XP).
 *   - `state.companions: Record<id, Companion>` — the relationship/loyalty layer.
 * A correct recruit writes BOTH under one shared `id`; a correct leave clears
 * (or deactivates) BOTH. To keep those two halves in lockstep, every producer
 * (NPC→member converter, dialogue/tavern/rescue triggers) and every consumer
 * (the reducer, the action-type union) speak the SAME payload shape.
 *
 * This module is the single source of truth for that shape. It is PURE — types
 * plus a couple of trivial constructors. No React, no game-state, no reducers.
 * `RecruitPayload` is imported by P3 (reducer), P4 (action types), P5 (consent),
 * P6/P8/P9 (triggers/UI) so the contract never drifts.
 */
import type { Companion } from '@/types/companions';
import type { PlayerCharacter } from '@/types/character';

/**
 * Where a recruit offer originated. Each variant maps to one v1 trigger surface:
 *   - `dialogue` — an "Invite to party" outcome in NPC conversation.
 *   - `tavern`   — a hire affordance on a tavern/innkeeper merchant.
 *   - `rescue`   — a grateful rescuee auto-joining after an encounter.
 *   - `promote`  — an already-met authored companion (Kaelen/Elara) joining the
 *                  playable roster ("met → joined").
 */
export type RecruitSource = 'dialogue' | 'tavern' | 'rescue' | 'promote';

/**
 * The complete, self-consistent result of converting an NPC (or promoting an
 * authored companion) into a party member. `character.id === companion.id` is an
 * invariant — the two halves are joined by that shared id in `PartyPane`.
 *
 * Producers (the converter / promote helper) MUST set both ids equal; consumers
 * (the reducer) MAY rely on it.
 */
export interface RecruitPayload {
  /** Playable roster entry appended to `state.party`. */
  character: PlayerCharacter;
  /** Relationship-layer record stored at `state.companions[companion.id]`. */
  companion: Companion;
  /** Trigger that produced this offer (for logging / flavour). */
  source: RecruitSource;
}

/**
 * Active-membership marker for a {@link Companion}.
 *
 * Per DESIGN §5, leaving the party does NOT delete the relationship record: the
 * `Companion` is kept and marked inactive so loyalty/approval persist and the
 * character is re-recruitable. The actual `inParty` field lives on the
 * `Companion` interface in `src/types/companions.ts` (added there, NOT here).
 *
 * This module owns the canonical default + a light accessor so P3 (reducer) and
 * P5 (consent) agree on what "currently in the party" means without re-deriving
 * the convention. Written as an `Omit`-free structural extension so it does not
 * require the field to already exist on `Companion`.
 */
export type WithInParty = { inParty?: boolean };

/** A newly recruited companion is, by definition, in the party. */
export const IN_PARTY_DEFAULT = true as const;

/**
 * Canonical default for the `inParty` flag on a freshly recruited companion.
 * Producers should spread this onto the `Companion` they build so the flag is
 * never accidentally omitted: `{ ...makeInPartyFlag(), ...rest }`.
 */
export function makeInPartyFlag(inParty: boolean = IN_PARTY_DEFAULT): WithInParty {
  return { inParty };
}

/**
 * Read whether a companion is currently an active party member. Treats a missing
 * flag as `false` (a record with no `inParty` set is a relationship-only entry,
 * e.g. seeded Kaelen/Elara before they join). Use this everywhere instead of
 * touching `companion.inParty` directly so the "undefined ⇒ not in party"
 * convention lives in exactly one place.
 */
export function isInParty(companion: WithInParty): boolean {
  return companion.inParty === true;
}
