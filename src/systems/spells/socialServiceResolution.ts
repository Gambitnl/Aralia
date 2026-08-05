// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 02:04:30
 * Dependents: commands/effects/GrantedActionCommand.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves a service request made to a creature controlled by a social spell.
 *
 * Fast Friends stores the request rule on the target's live status, but the ordinary
 * combat turn engine has no generic "ask for a service" event. This adapter gives the
 * granted Request Service action one canonical owner and reuses the existing save,
 * penalty, and concentration-cleanup paths. It deliberately leaves free-form social
 * roleplay outside the combat state while recording the rules-facing outcome.
 *
 * Called by: GrantedActionCommand when a Fast Friends follow-up action is used.
 * Depends on: the live combat status mirror, SavePenaltySystem, saving-throw utilities,
 * and BreakConcentrationCommand for early spell termination and post-charm awareness.
 */
import type { CommandContext } from '../../commands/base/SpellCommand';
import { BreakConcentrationCommand } from '../../commands/effects/ConcentrationCommands';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { SavingThrowAbility } from '../../types/spells';
import { SavePenaltySystem } from '../combat/SavePenaltySystem';
import { calculateSpellDC, rollSavingThrow } from '../../utils/character/savingThrowUtils';
import { generateId } from '../../utils/combat';

// ============================================================================
// Request Shape
// ============================================================================
// These flags are the mechanical facts that matter to Fast Friends. The text of
// a request remains optional because the action may be driven by an AI or by a
// UI that only supplies the rules classification.
// ============================================================================
export interface SocialServiceRequest {
  description?: string;
  harmful?: boolean;
  conflictsWithDesires?: boolean;
  certainDeath?: boolean;
}

// ============================================================================
// Input Normalization
// ============================================================================
// Player input is still a string at the command boundary. Accept a small
// human-readable vocabulary so existing UI and AI callers can use the same
// action without inventing another serialized request object.
// ============================================================================
export const parseSocialServiceRequest = (input?: string): SocialServiceRequest => {
  const normalized = input?.trim().toLowerCase() ?? '';

  return {
    description: input?.trim() || undefined,
    certainDeath: /certain\s+death|sure\s+death|die\b|suicide/.test(normalized),
    harmful: /harm|damage|attack|fight|danger|risk|injur|kill/.test(normalized),
    conflictsWithDesires: /conflict|against\s+(?:its|your|their)\s+(?:normal\s+)?(?:activity|desire|wish)|unwilling|refuse/.test(normalized)
  };
};

// ============================================================================
// Shared Logging
// ============================================================================
// Combat fixtures from older scenarios sometimes omit a log array. Keeping the
// append operation defensive lets this social adapter remain usable in those
// fixtures while normal combat states continue to receive ordinary log entries.
// ============================================================================
const appendLog = (state: CombatState, entry: Omit<CombatLogEntry, 'id' | 'timestamp'>): CombatState => ({
  ...state,
  combatLog: [
    ...(state.combatLog ?? []),
    {
      ...entry,
      id: generateId(),
      timestamp: Date.now()
    }
  ]
});

// ============================================================================
// Status Lookup
// ============================================================================
// The status mirror is the runtime source of truth. The social-lifecycle kind
// is preferred, while the source spell fallback keeps older saved combats
// compatible until they are rehydrated with the newer metadata.
// ============================================================================
const findFastFriendsStatus = (target: CombatCharacter, casterId: string) => (
  target.statusEffects?.find(effect =>
    effect.sourceCasterId === casterId &&
    (
      effect.socialLifecycle?.kind === 'fast_friends' ||
      effect.sourceSpellId === 'fast-friends' ||
      effect.source?.toLowerCase() === 'fast friends'
    )
  )
);

// ============================================================================
// Service Request Resolution
// ============================================================================
// A friendly request is accepted without another save. Harmful or conflicting
// work prompts the source-backed repeat Wisdom save, with Advantage when the
// caster and target are currently on opposing combat teams. Certain-death work
// ends the concentration spell immediately, matching the authored rule.
// ============================================================================
export const resolveFastFriendsServiceRequest = (
  state: CombatState,
  context: CommandContext,
  request: SocialServiceRequest = parseSocialServiceRequest(context.playerInput)
): CombatState => {
  const caster = state.characters.find(character => character.id === context.caster.id);
  const targetId = context.targets[0]?.id;
  const target = targetId ? state.characters.find(character => character.id === targetId) : undefined;

  if (!caster || !target) {
    return appendLog(state, {
      type: 'status',
      message: `${context.spellName || 'Fast Friends'} needs one living target for the service request.`,
      characterId: context.caster.id,
      data: { socialServiceRequest: 'fast_friends', outcome: 'missing_target' }
    });
  }

  const status = findFastFriendsStatus(target, caster.id);
  if (!status) {
    return appendLog(state, {
      type: 'status',
      message: `${target.name} is not currently bound by ${context.spellName || 'Fast Friends'}.`,
      characterId: caster.id,
      targetIds: [target.id],
      data: { socialServiceRequest: 'fast_friends', outcome: 'not_charmed' }
    });
  }

  const requestDescription = request.description || 'the requested service';
  const baseLogData = {
    socialServiceRequest: 'fast_friends',
    targetId: target.id,
    description: requestDescription,
    harmful: request.harmful === true,
    conflictsWithDesires: request.conflictsWithDesires === true,
    certainDeath: request.certainDeath === true
  };

  if (request.certainDeath) {
    const breakCommand = new BreakConcentrationCommand({
      ...context,
      caster,
      spellId: 'fast-friends',
      spellName: status.source || context.spellName || 'Fast Friends',
      targets: []
    });
    const endedState = breakCommand.execute(state);

    return appendLog(endedState, {
      type: 'status',
      message: `${status.source || 'Fast Friends'} ends because ${target.name} was asked to undertake certain death.`,
      characterId: target.id,
      targetIds: [target.id],
      data: { ...baseLogData, outcome: 'spell_ended_certain_death' }
    });
  }

  if (!request.harmful && !request.conflictsWithDesires) {
    return appendLog(state, {
      type: 'action',
      message: `${target.name} undertakes ${requestDescription} in a friendly manner to the best of its ability.`,
      characterId: caster.id,
      targetIds: [target.id],
      data: { ...baseLogData, outcome: 'service_accepted' }
    });
  }

  const repeatSave = status.repeatSave;
  if (!repeatSave || !repeatSave.saveType || repeatSave.timing !== 'on_social_service_request') {
    return appendLog(state, {
      type: 'status',
      message: `${target.name} cannot resolve the harmful or conflicting service request because its repeat-save rule is missing.`,
      characterId: target.id,
      targetIds: [target.id],
      data: { ...baseLogData, outcome: 'missing_repeat_save' }
    });
  }

  const savePenaltySystem = new SavePenaltySystem();
  const saveModifiers = savePenaltySystem.getActivePenalties(target);
  const dc = repeatSave.dc ?? calculateSpellDC(caster);
  const saveType = repeatSave.saveType as SavingThrowAbility;
  const firstRoll = rollSavingThrow(target, saveType, dc, saveModifiers);
  const targetIsFightingCasterOrCompanions = Boolean(caster.team && target.team && caster.team !== target.team);
  const hasFightingAdvantage = repeatSave.modifiers?.advantageWhenCasterOrCompanionsFightingTarget === true && targetIsFightingCasterOrCompanions;
  const secondRoll = hasFightingAdvantage
    ? rollSavingThrow(target, saveType, dc, saveModifiers)
    : undefined;
  const saveSucceeded = secondRoll ? firstRoll.success || secondRoll.success : firstRoll.success;
  const consumedState = savePenaltySystem.consumeNextSavePenalties(state, target.id);

  const rolledState = appendLog(consumedState, {
    type: 'status',
    message: `${target.name} ${saveSucceeded ? 'succeeds' : 'fails'} the repeat ${saveType} save against ${status.source || 'Fast Friends'} (${firstRoll.total}${secondRoll ? ` / ${secondRoll.total}` : ''} vs DC ${dc}).`,
    characterId: target.id,
    targetIds: [target.id],
    data: {
      ...baseLogData,
      outcome: saveSucceeded ? 'repeat_save_succeeded' : 'repeat_save_failed',
      repeatSaveTiming: repeatSave.timing,
      advantageFromCombat: hasFightingAdvantage,
      dc,
      firstRoll: firstRoll.total,
      secondRoll: secondRoll?.total
    }
  });

  if (!saveSucceeded || !repeatSave.successEnds) {
    return appendLog(rolledState, {
      type: 'action',
      message: `${target.name} continues the requested service after resisting the repeat save.`,
      characterId: caster.id,
      targetIds: [target.id],
      data: { ...baseLogData, outcome: 'service_accepted_after_failed_save' }
    });
  }

  const breakCommand = new BreakConcentrationCommand({
    ...context,
    caster,
    spellId: 'fast-friends',
    spellName: status.source || context.spellName || 'Fast Friends',
    targets: []
  });
  const endedState = breakCommand.execute(rolledState);

  return appendLog(endedState, {
    type: 'status',
    message: `${status.source || 'Fast Friends'} ends because ${target.name} succeeds on the repeat save.`,
    characterId: target.id,
    targetIds: [target.id],
    data: { ...baseLogData, outcome: 'spell_ended_repeat_save' }
  });
};
