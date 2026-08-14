// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 10:58:35
 * Dependents: commands/effects/DamageCommand.ts, components/DesignPreview/steps/scenarioControls/companionReactionsScenarioControls.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file opens the normal pre-damage window for allied Interception.
 *
 * It discovers owned companions from live combat state, qualifies every
 * possible protector with the canonical transaction, orders responders by the
 * current initiative sequence and stable id, asks the player to choose or
 * decline, and spends only the selected protector's Reaction. The caller owns
 * the stable claim receipt and applies the returned damage to HP afterward.
 *
 * Called by: DamageCommand and the Companion Reactions scenario adapter.
 * Depends on: companionProtectionReaction for all rule qualification/payment.
 */

import type { BattleMapData, CombatCharacter } from '../../../types/combat';
import {
  INTERCEPTION_STYLE_DESCRIPTION,
  INTERCEPTION_STYLE_NAME,
  qualifyCompanionProtectionReaction,
  resolveCompanionProtectionReduction,
  type CompanionProtectionReactionReason,
} from './companionProtectionReaction';

// ============================================================================
// Public Window Contract
// ============================================================================
// The option only needs the fields read by the shared ReactionPrompt. Its id
// encodes the exact responder, so two companions never collapse into one style.
// ============================================================================

export interface AlliedProtectionReactionOption {
  id: string;
  name: string;
  description: string;
}

export interface AlliedProtectionCandidate {
  optionId: string;
  ownerId: string;
  protectorId: string;
  protectorName: string;
  eligible: boolean;
  reason: CompanionProtectionReactionReason;
  order: number;
}

export type AlliedProtectionReactionOutcome =
  | 'duplicate_event'
  | 'no_eligible_responder'
  | 'prompt_unavailable'
  | 'declined'
  | 'invalid_selection'
  | 'resolved';

export interface AlliedProtectionReactionWindowInput {
  characters: CombatCharacter[];
  turnOrder: string[];
  mapData?: BattleMapData;
  attacker: CombatCharacter;
  protectedTarget: CombatCharacter;
  hitEventId: string;
  claimedEventIds: ReadonlySet<string>;
  attack: {
    isHit: boolean;
    damage: number;
    damageType: string;
  };
  requestReaction?: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_take_damage',
    options: AlliedProtectionReactionOption[],
  ) => Promise<string | null>;
  /** Tests and deterministic scenarios can pin only the Interception die. */
  reductionRng?: () => number;
}

export interface AlliedProtectionReactionWindowResult {
  outcome: AlliedProtectionReactionOutcome;
  claimId: string;
  characters: CombatCharacter[];
  candidates: AlliedProtectionCandidate[];
  selectedProtectorId: string | null;
  incomingDamage: number;
  finalDamage: number;
  totalReduction: number;
  summary: string;
}

/** Explicit decision supplied by a deterministic controller after showing the same ordered options. */
export type AlliedProtectionReactionSelection = string | null;

export function getAlliedProtectionClaimId(hitEventId: string): string {
  return `${hitEventId}:allied-protection-claim`;
}

// ============================================================================
// Deterministic Discovery
// ============================================================================
// Initiative order is the player-facing arbitration order. Unknown actors sort
// after current initiative entries, then stable ids break all remaining ties.
// ============================================================================

function candidateOrder(character: CombatCharacter, turnOrder: string[]): number {
  const initiativeIndex = turnOrder.indexOf(character.id);
  return initiativeIndex >= 0 ? initiativeIndex : Number.MAX_SAFE_INTEGER;
}

function optionId(protectorId: string): string {
  return `interception:${protectorId}`;
}

function discoverCandidates(
  input: AlliedProtectionReactionWindowInput,
): AlliedProtectionCandidate[] {
  if (!input.mapData) return [];

  return input.characters
    .filter(character => character.isSummon === true && Boolean(character.summonMetadata?.casterId))
    .map(protector => {
      const ownerId = protector.summonMetadata!.casterId;
      const owner = input.characters.find(character => character.id === ownerId);
      if (!owner) {
        return {
          optionId: optionId(protector.id),
          ownerId,
          protectorId: protector.id,
          protectorName: protector.name,
          eligible: false,
          reason: 'protector_not_owned_by_owner' as const,
          order: candidateOrder(protector, input.turnOrder),
        };
      }

      const qualification = qualifyCompanionProtectionReaction({
        owner,
        protector,
        protectedTarget: input.protectedTarget,
        attacker: input.attacker,
        mapData: input.mapData!,
        attack: input.attack,
      });
      return {
        optionId: optionId(protector.id),
        ownerId,
        protectorId: protector.id,
        protectorName: protector.name,
        eligible: qualification.eligible,
        reason: qualification.reason,
        order: candidateOrder(protector, input.turnOrder),
      };
    })
    .sort((left, right) => left.order - right.order || left.protectorId.localeCompare(right.protectorId));
}

function unchanged(
  input: AlliedProtectionReactionWindowInput,
  outcome: AlliedProtectionReactionOutcome,
  candidates: AlliedProtectionCandidate[],
  summary: string,
): AlliedProtectionReactionWindowResult {
  return {
    outcome,
    claimId: getAlliedProtectionClaimId(input.hitEventId),
    characters: input.characters,
    candidates,
    selectedProtectorId: null,
    incomingDamage: Math.max(0, input.attack.damage),
    finalDamage: Math.max(0, input.attack.damage),
    totalReduction: 0,
    summary,
  };
}

function resolveSelectedCandidate(
  input: AlliedProtectionReactionWindowInput,
  candidates: AlliedProtectionCandidate[],
  choice: AlliedProtectionReactionSelection,
): AlliedProtectionReactionWindowResult {
  const claimId = getAlliedProtectionClaimId(input.hitEventId);
  const eligible = candidates.filter(candidate => candidate.eligible);
  if (choice === null) {
    return unchanged(
      input,
      'declined',
      candidates,
      `${INTERCEPTION_STYLE_NAME} declined; no protector spent its Reaction and damage remains ${input.attack.damage}.`,
    );
  }

  const selected = eligible.find(candidate => candidate.optionId === choice);
  if (!selected || !input.mapData) {
    return unchanged(
      input,
      'invalid_selection',
      candidates,
      `${INTERCEPTION_STYLE_NAME} selection ${choice} was not an eligible ordered responder; no cost or reduction applied.`,
    );
  }

  const owner = input.characters.find(character => character.id === selected.ownerId);
  const protector = input.characters.find(character => character.id === selected.protectorId);
  if (!owner || !protector) {
    return unchanged(
      input,
      'invalid_selection',
      candidates,
      `${INTERCEPTION_STYLE_NAME} selected responder disappeared before payment; no cost or reduction applied.`,
    );
  }

  // Re-run qualification at the payment boundary so asynchronous UI time cannot
  // spend a Reaction after the selected protector became invalid.
  const receipt = resolveCompanionProtectionReduction({
    owner,
    protector,
    protectedTarget: input.protectedTarget,
    attacker: input.attacker,
    mapData: input.mapData,
    attack: input.attack,
    reductionRng: input.reductionRng,
  });
  if (receipt.outcome === 'rejected') {
    return unchanged(
      input,
      'invalid_selection',
      candidates,
      `${INTERCEPTION_STYLE_NAME} selected responder became invalid: ${receipt.reason}; no cost or reduction applied.`,
    );
  }

  return {
    outcome: 'resolved',
    claimId,
    characters: input.characters.map(character => (
      character.id === receipt.protector.id ? receipt.protector : character
    )),
    candidates,
    selectedProtectorId: receipt.protector.id,
    incomingDamage: receipt.incomingDamage,
    finalDamage: receipt.finalDamage,
    totalReduction: receipt.totalReduction,
    summary: `${receipt.summary} Ordered responders: ${eligible.map(candidate => candidate.protectorName).join(' → ')}; selected ${receipt.protector.name}.`,
  };
}

// ============================================================================
// Pre-Damage Choice And Payment
// ============================================================================
// A claim is checked before discovery or prompting. DamageCommand writes the
// returned claim before HP application, so replaying the same command/hit id is
// an entire-hit no-op rather than a second opportunity or second HP change.
// ============================================================================

export async function resolveAlliedProtectionReactionWindow(
  input: AlliedProtectionReactionWindowInput,
): Promise<AlliedProtectionReactionWindowResult> {
  const claimId = getAlliedProtectionClaimId(input.hitEventId);
  if (input.claimedEventIds.has(claimId)) {
    return unchanged(
      input,
      'duplicate_event',
      [],
      `Duplicate hit ${input.hitEventId}: no prompt, reduction, Reaction payment, or HP effect may repeat.`,
    );
  }

  const candidates = discoverCandidates(input);
  const eligible = candidates.filter(candidate => candidate.eligible);
  if (eligible.length === 0) {
    const rejectionFacts = candidates.length > 0
      ? candidates.map(candidate => `${candidate.protectorName}: ${candidate.reason}`).join('; ')
      : 'no owned companion/protector was present';
    return unchanged(
      input,
      'no_eligible_responder',
      candidates,
      `${INTERCEPTION_STYLE_NAME} not offered: ${rejectionFacts}.`,
    );
  }

  if (!input.requestReaction) {
    return unchanged(
      input,
      'prompt_unavailable',
      candidates,
      `${INTERCEPTION_STYLE_NAME} eligible but no reaction-choice surface was available; damage remains unchanged.`,
    );
  }

  const options = eligible.map(candidate => ({
    id: candidate.optionId,
    name: `${candidate.protectorName} — ${INTERCEPTION_STYLE_NAME}`,
    description: `${INTERCEPTION_STYLE_DESCRIPTION} Responder order ${candidate.order + 1}.`,
  }));
  const choice = await input.requestReaction(
    input.attacker.id,
    input.protectedTarget.id,
    'on_take_damage',
    options,
  );
  return resolveSelectedCandidate(input, candidates, choice);
}

export function resolveAlliedProtectionReactionSelection(
  input: AlliedProtectionReactionWindowInput,
  choice: AlliedProtectionReactionSelection,
): AlliedProtectionReactionWindowResult {
  const claimId = getAlliedProtectionClaimId(input.hitEventId);
  if (input.claimedEventIds.has(claimId)) {
    return unchanged(
      input,
      'duplicate_event',
      [],
      `Duplicate hit ${input.hitEventId}: no prompt, reduction, Reaction payment, or HP effect may repeat.`,
    );
  }

  const candidates = discoverCandidates(input);
  const eligible = candidates.filter(candidate => candidate.eligible);
  if (eligible.length === 0) {
    const rejectionFacts = candidates.length > 0
      ? candidates.map(candidate => `${candidate.protectorName}: ${candidate.reason}`).join('; ')
      : 'no owned companion/protector was present';
    return unchanged(
      input,
      'no_eligible_responder',
      candidates,
      `${INTERCEPTION_STYLE_NAME} not offered: ${rejectionFacts}.`,
    );
  }

  return resolveSelectedCandidate(input, candidates, choice);
}
