/**
 * @file recruitConsent.ts — disposition-gated consent for party recruitment (P5).
 *
 * A "join the party" offer must be CONSENTED to by the NPC before the recruit
 * reducer mutates state. This module is the single decision point. It is PURE:
 * it reads the candidate NPC and a read-only `GameState`, and returns a verdict
 * `{ willJoin, reason, requiresApproval? }`. It NEVER mutates anything.
 *
 * DESIGN (decision #3 — consent is disposition-gated):
 *   Accept only when disposition / relationship clears a threshold; otherwise
 *   decline with a human-readable `reason`. Two signals gate a "yes":
 *
 *   1. Relationship level — if the NPC already has a `Companion` record (a
 *      previously-met / re-recruitable companion such as seeded Kaelen/Elara, or
 *      a former member who left with `inParty:false`), the player's relationship
 *      LEVEL is the authority. We reuse {@link RelationshipManager} thresholds:
 *      anyone at `friend` or above will join. A standing relationship outranks a
 *      cold disposition number.
 *
 *   2. NPC disposition — for a first-time recruit with no companion record, we
 *      fall back to the NPC's `disposition` (NpcMemory, scale -100..100, neutral
 *      0, default 50). A disposition at or above {@link DISPOSITION_JOIN_THRESHOLD}
 *      (warm / friendly) consents; below it declines.
 *
 * `opts.autoAccept` short-circuits both gates with an always-yes verdict — the
 * encounter-rescue trigger (P10) passes it for a grateful rescuee who has just
 * been saved and owes the party. The reason still reflects the rescue framing.
 */
import type { GameState } from '@/types/state';
import type { RichNPC } from '@/types/world';
import type { RelationshipLevel } from '@/types/companions';
/**
 * Minimum relationship LEVEL at which an already-met companion will join.
 * `friend` (approval 200–299) is the first level that reads as a positive,
 * trust-bearing bond — `acquaintance` is merely "getting to know you".
 */
export declare const RELATIONSHIP_JOIN_THRESHOLD: RelationshipLevel;
/**
 * Minimum NPC disposition (NpcMemory scale, -100..100) at which a first-time
 * recruit — one with no `Companion` record — consents to join for FREE.
 *
 * TUNING (2026-07-04): raised from 50 to 65. NpcMemory records default to
 * disposition 50, so at 50 a complete stranger the player had never charmed
 * auto-joined the party ("likes you well enough") — seen live with a roster
 * merchant. 65 requires warmth the player has actually EARNED above the
 * neutral default before a stranger throws in their lot with the party.
 * Paid hires use {@link DISPOSITION_HIRE_THRESHOLD} instead.
 */
export declare const DISPOSITION_JOIN_THRESHOLD = 65;
/**
 * Minimum disposition for a PAID hire (`opts.hire`, the tavern-hire surface).
 * Coin is its own persuasion: a neutral stranger (default disposition 50)
 * legitimately signs on when the player is paying, so the hire gate keeps the
 * old neutral-friendly bar. Below 50 (soured/hostile) they still refuse — no
 * amount of ale money buys a companion who dislikes you.
 */
export declare const DISPOSITION_HIRE_THRESHOLD = 50;
/**
 * Numeric ordering of relationship levels (mirrors RelationshipManager's internal
 * weighting) so we can compare "is this level at or above the threshold?". Kept
 * local and exported for tests; RelationshipManager does not expose this map.
 */
export declare const LEVEL_WEIGHT: Record<RelationshipLevel, number>;
/** Options influencing the consent decision. */
export interface RecruitOfferOptions {
    /**
     * When true, bypass the disposition/relationship gates and always consent.
     * Used by the encounter-rescue trigger for a grateful rescuee (decision #3).
     */
    autoAccept?: boolean;
    /**
     * When true, the offer is a PAID hire (tavern-hire surface). The disposition
     * gate uses {@link DISPOSITION_HIRE_THRESHOLD} (neutral-or-better) instead of
     * the stricter free-join {@link DISPOSITION_JOIN_THRESHOLD}.
     */
    hire?: boolean;
}
/**
 * The verdict returned by {@link evaluateRecruitOffer}. Consumed by the trigger
 * handlers (dialogue / tavern / rescue) and the roster UI — never mutated here.
 */
export interface RecruitVerdict {
    /** Whether the NPC accepts the invitation to join the party. */
    willJoin: boolean;
    /** Human-readable explanation, shown to the player on accept OR decline. */
    reason: string;
    /**
     * The relationship approval value still required to flip a decline into an
     * accept, when the decline was caused by an insufficient relationship LEVEL.
     * Present only on a relationship-gated "no" so callers can hint progress
     * (e.g. "needs to be a friend first"). Absent on yes verdicts and on
     * disposition-gated declines for never-met NPCs.
     */
    requiresApproval?: number;
}
/**
 * Decide whether `npc` will accept an invitation to join the party.
 *
 * Pure — reads `npc` and `state`, mutates nothing, returns a {@link RecruitVerdict}.
 *
 * Evaluation order:
 *   1. `opts.autoAccept` → always join (rescue short-circuit).
 *   2. Existing `Companion` record → gate on relationship LEVEL vs
 *      {@link RELATIONSHIP_JOIN_THRESHOLD}. An active party member declines
 *      (already with you). A standing `friend`+ bond joins.
 *   3. No record → gate on disposition vs {@link DISPOSITION_JOIN_THRESHOLD}.
 *
 * @param npc   The candidate NPC (RichNPC in practice; only `id`/`name` are read).
 * @param state Read-only game state (companions + npcMemory).
 * @param opts  Optional flags ({@link RecruitOfferOptions}).
 */
export declare function evaluateRecruitOffer(npc: Pick<RichNPC, 'id' | 'name'>, state: GameState, opts?: RecruitOfferOptions): RecruitVerdict;
