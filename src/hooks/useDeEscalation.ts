/**
 * @file src/hooks/useDeEscalation.ts
 * Orchestrates a hostile opening's resolution: intent → (roll) → route to
 * peaceful resolution or combat. `runDeEscalationFlow` is the pure, injectable
 * core; the hook binds it to useDice + the real encounter launcher.
 */
import type React from 'react';
import { useCallback } from 'react';
import type { AppAction } from '../state/actionTypes';
import type { PlayerCharacter } from '../types';
import type { SituationThreat } from '../systems/gameEntry/types';
import type { IntentResolution } from '../systems/gameEntry/resolveDeEscalationIntent';
import { threatToMonsters } from '../systems/gameEntry/deEscalationToCombat';
import { computeSkillModifier, resolveCheck, getActiveCheckBoosts } from '../systems/gameEntry/runDeEscalationCheck';
import { handleStartBattleMapEncounter } from './actions/handleEncounter';
import { generateId } from '../utils/core/idGenerator';
import { useDice } from '../contexts/DiceContext';

/** A bonus die owed to the check by an active boost (Guidance's 1d4 etc.). */
export interface CheckDiceRequest {
  source: string;
  notation: string;
}

/** Everything the player physically rolled for one check. */
export interface CheckDiceResult {
  d20: number;
  bonuses: Array<{ source: string; value: number }>;
}

export interface DeEscalationFlowArgs {
  intent: IntentResolution;
  character: PlayerCharacter;
  threat: SituationThreat;
  dispatch: React.Dispatch<AppAction>;
  /**
   * Rolls the whole check: the d20 (best of two on advantage) plus any active
   * bonus dice, as ONE dice-tray sequence. Injected so the pure core stays
   * deterministic under test.
   */
  rollCheckDice: (advantage: boolean, bonusDice: CheckDiceRequest[]) => Promise<CheckDiceResult>;
  /** Injectable for tests; defaults to the real encounter launcher. */
  startEncounter?: typeof handleStartBattleMapEncounter;
}

export async function runDeEscalationFlow(args: DeEscalationFlowArgs): Promise<void> {
  const { intent, character, threat, dispatch, rollCheckDice } = args;
  const startEncounter = args.startEncounter ?? handleStartBattleMapEncounter;

  // Every terminal route below resolves the standoff for good, so the opening
  // threat must be cleared: leaving it in place let the conversation re-trigger
  // the SAME fight after the battle ended (verified live — an infinite XP loop).
  const clearThreat = () => dispatch({ type: 'SKIP_OPENING_SITUATION' });

  // Only skill/flee intents produce a check. Attack — and an unresolved
  // ambiguous intent that reached this point — go straight to combat.
  if (intent.kind === 'attack' || intent.kind === 'ambiguous') {
    await startEncounter(dispatch, { monsters: threatToMonsters(threat) });
    clearThreat();
    return;
  }

  const boosts = getActiveCheckBoosts(character, intent.skill);
  const advantage = boosts.some((b) => b.advantage);
  const modifier = computeSkillModifier(character, intent.ability, intent.skill);

  // Active bonus dice are part of the check: Guidance's 1d4 was previously
  // collected here and then silently dropped, so the buff never helped.
  const bonusRequests: CheckDiceRequest[] = boosts
    .filter((b) => !!b.bonusDice)
    .map((b) => ({ source: b.source, notation: b.bonusDice as string }));

  const rolled = await rollCheckDice(advantage, bonusRequests);
  const bonusTotal = rolled.bonuses.reduce((sum, b) => sum + b.value, 0);
  const { success } = resolveCheck({ d20: rolled.d20, modifier: modifier + bonusTotal, dc: threat.deEscalationDC });

  // Surface the mechanical outcome in the conversation. Without this line the
  // player sees dice settle and then the world just changes — on a success the
  // banner vanished with no explanation at all (verified live).
  const bonusText = rolled.bonuses.map((b) => ` + ${b.value} (${b.source})`).join('');
  dispatch({
    type: 'ADD_CONVERSATION_MESSAGE',
    payload: {
      id: generateId(),
      speakerId: 'narrator',
      text: `${intent.skill} check: ${rolled.d20} ${modifier < 0 ? '−' : '+'} ${Math.abs(modifier)}${bonusText} = ${rolled.d20 + modifier + bonusTotal} vs DC ${threat.deEscalationDC} — ${success ? 'success' : 'failure'}.`,
      timestamp: Date.now(),
    },
  });

  if (success) {
    clearThreat();
  } else {
    await startEncounter(dispatch, { monsters: threatToMonsters(threat) });
    clearThreat();
  }
}

export function useDeEscalation() {
  const { visualRoll, hideOverlay } = useDice();
  const rollCheckDice = useCallback(async (
    advantage: boolean,
    bonusDice: CheckDiceRequest[],
  ): Promise<CheckDiceResult> => {
    try {
      // Roll two d20s and take the better face on advantage.
      const a = await visualRoll('1d20');
      let d20 = a.rolls[0]?.value ?? a.total;
      if (advantage) {
        const b = await visualRoll('1d20');
        d20 = Math.max(d20, b.rolls[0]?.value ?? b.total);
      }
      // Then each active bonus die (Guidance's 1d4 …), sequentially — the dice
      // service rolls one at a time.
      const bonuses: CheckDiceResult['bonuses'] = [];
      for (const req of bonusDice) {
        const r = await visualRoll(req.notation);
        bonuses.push({ source: req.source, value: r.total });
      }
      return { d20, bonuses };
    } finally {
      // Hide only after the WHOLE sequence: dismissing between rolls unmounts
      // the dice canvas and a roll on a dead canvas never settles. The delay
      // gives the player a beat to read the final face.
      window.setTimeout(() => hideOverlay(), 1500);
    }
  }, [visualRoll, hideOverlay]);
  return { runDeEscalationFlow, rollCheckDice };
}
