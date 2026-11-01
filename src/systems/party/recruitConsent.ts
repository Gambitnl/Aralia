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
 * A source-bound sharedGoal offer has its own limited consent: Elara must have
 * received the real report and supplies, offered explicit expedition terms,
 * and still be present when the player accepts. It grants neither general
 * friendship nor unrestricted loyalty. Ordinary gates remain unchanged.
 *
 * `opts.autoAccept` short-circuits both gates with an always-yes verdict — the
 * encounter-rescue trigger (P10) passes it for a grateful rescuee who has just
 * been saved and owes the party. The reason still reflects the rescue framing.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 07:13:28
 * Dependents: components/Dialogue/DialogueInterface.tsx, hooks/actions/handleEncounter.ts, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleNpcInteraction.ts, state/reducers/companionTravelReducer.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { RichNPC, NPC } from '@/types/world';
import type { Companion, RelationshipLevel } from '@/types/companions';
import { RelationshipManager } from '@/systems/companions/RelationshipManager';
import { isInParty } from './recruitTypes';
import { companionJourneyReadiness } from '@/systems/companions/companionJourneyReadiness';

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
 * recruit — one with no `Companion` record — consents to join for FREE.
 *
 * TUNING (2026-07-04): raised from 50 to 65. NpcMemory records default to
 * disposition 50, so at 50 a complete stranger the player had never charmed
 * auto-joined the party ("likes you well enough") — seen live with a roster
 * merchant. 65 requires warmth the player has actually EARNED above the
 * neutral default before a stranger throws in their lot with the party.
 * Paid hires use {@link DISPOSITION_HIRE_THRESHOLD} instead.
 */
export const DISPOSITION_JOIN_THRESHOLD = 65;

/**
 * Minimum disposition for a PAID hire (`opts.hire`, the tavern-hire surface).
 * Coin is its own persuasion: a neutral stranger (default disposition 50)
 * legitimately signs on when the player is paying, so the hire gate keeps the
 * old neutral-friendly bar. Below 50 (soured/hostile) they still refuse — no
 * amount of ale money buys a companion who dislikes you.
 */
export const DISPOSITION_HIRE_THRESHOLD = 50;

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
  /** A particular shared purpose needs an actual offered agreement and its
   * earned source evidence. It never grants general friendship or auto-accept. */
  sharedGoal?: {worldSeed:number;goalId:string;sitePath:string};
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

/** Household projection establishes a person's home and work, not an offer
 * to become an adventurer. A companion record is the existing source for a
 * developed opportunity; adding one keeps that resident's future story open.
 * Untagged authored/legacy NPCs retain their established recruitment behavior. */
export function canOfferPartyInvitation(
  npc: Pick<NPC, 'id'>,
  state: Pick<GameState, 'companions' | 'generatedNpcs'>,
): boolean {
  if (state.companions?.[npc.id]) return true;
  const candidate = state.generatedNpcs?.[npc.id] ?? npc;
  return !(candidate as { worldforgeHousehold?: unknown }).worldforgeHousehold;
}

/**
 * Decide whether `npc` will accept an invitation to join the party.
 *
 * Pure — reads `npc` and `state`, mutates nothing, returns a {@link RecruitVerdict}.
 *
 * Evaluation order:
 *   1. `opts.autoAccept` → always join (rescue short-circuit).
 *   2. Projected household residents need an established companion opportunity.
 *   3. Existing `Companion` record → gate on relationship LEVEL vs
 *      {@link RELATIONSHIP_JOIN_THRESHOLD}. An active party member declines
 *      (already with you). A standing `friend`+ bond joins.
 *   4. No record → gate on disposition vs {@link DISPOSITION_JOIN_THRESHOLD}.
 *
 * @param npc   The candidate NPC (RichNPC in practice; only `id`/`name` are read).
 * @param state Read-only game state (companions, NPC provenance and npcMemory).
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

  // Warmth or a hire payment cannot turn an ordinary household resident into
  // an adventurer. Explicit rescue consent above keeps its authored route.
  if (!canOfferPartyInvitation(npc, state)) {
    return { willJoin: false, reason: `${name} is not available to travel with your party.` };
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

    if(opts.sharedGoal){
      const ready=companionJourneyReadiness(state,npc.id),agreement=companion.travelAgreement;
      const offered=!!ready&&agreement?.response==='offered'&&agreement.worldSeed===state.worldSeed
        &&agreement.worldSeed===opts.sharedGoal.worldSeed&&agreement.sourceId===ready.destination.sourceId
        &&agreement.goalId===opts.sharedGoal.goalId&&agreement.goalId===ready.goalId
        &&agreement.sitePath===opts.sharedGoal.sitePath&&agreement.sitePath===ready.destination.sitePath;
      return offered
        ?{willJoin:true,reason:`${name} agrees to travel with you to inspect the ${ready!.destination.name}, on the terms you discussed.`}
        :{willJoin:false,reason:`${name} has not agreed to this expedition on those terms.`};
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

  // 3. First-time recruit → disposition gate. A paid hire clears at neutral;
  // a free join demands warmth earned above the neutral default.
  const disposition = readDisposition(npc, state);
  const threshold = opts.hire ? DISPOSITION_HIRE_THRESHOLD : DISPOSITION_JOIN_THRESHOLD;
  if (disposition >= threshold) {
    return {
      willJoin: true,
      reason: opts.hire
        ? `${name} accepts your coin and agrees to join the party.`
        : `${name} likes you well enough and agrees to join the party.`,
    };
  }

  return {
    willJoin: false,
    reason: `${name} isn't friendly enough toward you to join the party.`,
  };
}
