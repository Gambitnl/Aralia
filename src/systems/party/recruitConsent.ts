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
import type { RichNPC, NPC } from '@/types/world';
import type { Companion, RelationshipLevel } from '@/types/companions';
import { RelationshipManager } from '@/systems/companions/RelationshipManager';
import { isInParty } from './recruitTypes';

/** Relationship key under which a companion stores its bond with the player. */
const PLAYER_RELATIONSHIP_KEY = 'player';

/**
 * Minimum relationship LEVEL at which an already-met companion will join.
 * `friend` (approval 200–299) is the first level that reads as a positive,
 * trust-bearing bond — `acquaintance` is merely "getting to know you".
 */
export const RELATIONSHIP_JOIN_THRESHOLD: RelationshipLevel = 'friend';

/**
 * Minimum NPC disposition (NpcMemory scale, -100..100) at which a first-time
 * recruit — one with no `Companion` record — consents to join. 50 is the
 * "Friendly" tier used elsewhere (socialUtils/contextUtils treat >50 as warm).
 */
export const DISPOSITION_JOIN_THRESHOLD = 50;

/**
 * Numeric ordering of relationship levels (mirrors RelationshipManager's internal
 * weighting) so we can compare "is this level at or above the threshold?". Kept
 * local and exported for tests; RelationshipManager does not expose this map.
 */
export const LEVEL_WEIGHT: Record<RelationshipLevel, number> = {
  hated: -5,
  enemy: -4,
  rival: -3,
  distrusted: -2,
  wary: -1,
  stranger: 0,
  acquaintance: 1,
  friend: 2,
  close: 3,
  devoted: 4,
  romance: 5,
};

/** Options influencing the consent decision. */
export interface RecruitOfferOptions {
  /**
   * When true, bypass the disposition/relationship gates and always consent.
   * Used by the encounter-rescue trigger for a grateful rescuee (decision #3).
   */
  autoAccept?: boolean;
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

/** Lowest approval (inclusive) for the {@link RELATIONSHIP_JOIN_THRESHOLD} level. */
const FRIEND_MIN_APPROVAL = 200;

/**
 * Look up the player-facing `Companion` record for a candidate NPC, if one
 * exists. Match is by shared id — the recruit invariant is
 * `companion.id === npc.id` (see recruitTypes). Returns `undefined` for a
 * never-met NPC.
 */
function findCompanionRecord(npc: Pick<NPC, 'id'>, state: GameState): Companion | undefined {
  return state.companions?.[npc.id];
}

/**
 * Read the NPC's disposition toward the player from NpcMemory. Defaults to 0
 * (neutral) when the NPC has no memory record yet — a stranger the player has
 * never interacted with is, by default, neutral and will NOT clear the warm
 * threshold.
 */
function readDisposition(npc: Pick<NPC, 'id'>, state: GameState): number {
  return state.npcMemory?.[npc.id]?.disposition ?? 0;
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
export function evaluateRecruitOffer(
  npc: Pick<RichNPC, 'id' | 'name'>,
  state: GameState,
  opts: RecruitOfferOptions = {},
): RecruitVerdict {
  const name = npc.name || 'They';

  // 1. Rescue / explicit auto-accept short-circuit.
  if (opts.autoAccept) {
    return {
      willJoin: true,
      reason: `${name} owes you their life and gladly joins the party.`,
    };
  }

  const companion = findCompanionRecord(npc, state);

  // 2. Already-met companion → relationship-level gate.
  if (companion) {
    // Already an active member — nothing to consent to.
    if (isInParty(companion)) {
      return {
        willJoin: false,
        reason: `${name} is already travelling with you.`,
      };
    }

    const relationship = companion.relationships?.[PLAYER_RELATIONSHIP_KEY];
    const approval = relationship?.approval ?? 0;
    // Derive level from approval so a record with a stale `level` cannot diverge
    // from its approval; falls back to the stored level only if no approval.
    const level: RelationshipLevel = relationship
      ? RelationshipManager.getRelationshipLevel(approval)
      : 'stranger';

    if (LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[RELATIONSHIP_JOIN_THRESHOLD]) {
      return {
        willJoin: true,
        reason: `${name} trusts you (${level}) and agrees to join the party.`,
      };
    }

    return {
      willJoin: false,
      reason: `${name} doesn't know you well enough yet (${level}) to join you.`,
      requiresApproval: FRIEND_MIN_APPROVAL - approval,
    };
  }

  // 3. First-time recruit → disposition gate.
  const disposition = readDisposition(npc, state);
  if (disposition >= DISPOSITION_JOIN_THRESHOLD) {
    return {
      willJoin: true,
      reason: `${name} likes you well enough and agrees to join the party.`,
    };
  }

  return {
    willJoin: false,
    reason: `${name} isn't friendly enough toward you to join the party.`,
  };
}
