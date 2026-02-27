// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:09
 * Dependents: actionHandlers.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/actions/handleGeminiCustom.ts
 * Handles 'gemini_custom_action', including social skill checks.
 */
import React from 'react';
import { GameState, Action, SuspicionLevel, GoalStatus, KnownFact } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn, GetCurrentLocationFn, GetCurrentNPCsFn } from './actionHandlerTypes';
import { NPCS } from '../../constants';
import { SKILLS_DATA } from '../../data/skills';
import { getAbilityModifierValue } from '../../utils/characterUtils';
import { assessPlausibility } from '../../utils/socialUtils';
import { handleImmediateGossip } from './handleWorldEvents';
import { resolveAndRegisterEntities } from '../../utils/entityIntegrationUtils';
import { generateId } from '../../utils/core/idGenerator';

interface HandleGeminiCustomProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  generalActionContext: string;
  getCurrentLocation: GetCurrentLocationFn;
  getCurrentNPCs: GetCurrentNPCsFn;
}

export async function handleGeminiCustom({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  generalActionContext,
  getCurrentLocation,
  getCurrentNPCs,
}: HandleGeminiCustomProps): Promise<void> {
  const payload = (action as any).payload;
  let outcomeFact: KnownFact | null = null;
  const targetNpcIdForGossip = payload?.targetNpcId || null;

  // Check if it's a social skill check
  const checkSkill = payload?.check;
  if (checkSkill && payload.targetNpcId) {
    const player = gameState.party[0];
    const npc = NPCS[payload.targetNpcId];
    if (!player || !npc) {
      addMessage("Invalid target for social check.", "system");
      return;
    }

    const skillId = Object.keys(SKILLS_DATA).find(key => SKILLS_DATA[key].name.toLowerCase() === checkSkill.toLowerCase());
    const skill = skillId ? SKILLS_DATA[skillId] : null;

    if (!skill) {
      addMessage(`Unknown skill for check: ${payload.check}`, "system");
      return;
    }

    const npcMemory = gameState.npcMemory[npc.id];
    if (!npcMemory) {
      addMessage(`Error: Could not find memory for ${npc.name}.`, "system");
      return;
    }

    const baseDc = 12;
    const plausibilityModifier = assessPlausibility(action, player, npcMemory);
    const disposition = npcMemory.disposition;
    const dcModifier = Math.floor(-disposition / 10);
    const finalDc = baseDc + dcModifier + plausibilityModifier;

    const abilityScoreValue = player.finalAbilityScores[skill.ability];
    const abilityModifier = getAbilityModifierValue(abilityScoreValue);
    const isProficient = player.skills.some(s => s.id === skill.id);
    const proficiencyBonus = isProficient ? (player.proficiencyBonus || 2) : 0;

    const d20Roll = Math.floor(Math.random() * 20) + 1;
    const totalRoll = d20Roll + abilityModifier + proficiencyBonus;
    const wasSuccess = totalRoll >= finalDc;

    addMessage(`(DC ${finalDc}) You attempt to ${skill.name}... Rolled ${totalRoll} (${d20Roll} + ${abilityModifier} + ${proficiencyBonus})`, "system");

    const outcomeResult = await GeminiService.generateSocialCheckOutcome(
      npcMemory as any, // TODO(preserve-lint): reconcile NpcMemory vs NPCMemory shape
      null, // TODO(preserve-lint): thread real village context if available
      wasSuccess ? `${skill.name} success` : `${skill.name} fail`,
      gameState.devModelOverride ?? null,
    );

    addGeminiLog('generateSocialCheckOutcome', outcomeResult.data?.promptSent || outcomeResult.metadata?.promptSent || "", outcomeResult.data?.rawResponse || outcomeResult.metadata?.rawResponse || outcomeResult.error || "");

    if (outcomeResult.data?.rateLimitHit || outcomeResult.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (outcomeResult.data) {
      const outcomeText = outcomeResult.data.text || 'The NPC reacts subtly.';
      addMessage(outcomeText, "system");
      // [Linker] Ensure entities mentioned in social outcomes exist
      await resolveAndRegisterEntities(outcomeText, gameState, dispatch, addGeminiLog);
      dispatch({ type: 'UPDATE_NPC_DISPOSITION', payload: { npcId: npc.id, amount: outcomeResult.data.dispositionChange } });

      outcomeFact = {
        id: generateId(),
        text: outcomeResult.data.memoryFactText,
        source: 'direct',
        isPublic: true,
        timestamp: gameState.gameTime.getTime(),
        strength: wasSuccess ? 7 : 4,
        lifespan: 999,
      };
      dispatch({ type: 'ADD_NPC_KNOWN_FACT', payload: { npcId: npc.id, fact: outcomeFact } });

      if (outcomeResult.data.goalUpdate) {
        const { npcId, goalId, newStatus } = outcomeResult.data.goalUpdate;
        dispatch({ type: 'UPDATE_NPC_GOAL_STATUS', payload: { npcId, goalId, newStatus } });

        const dispositionBoost = newStatus === GoalStatus.Completed ? 50 : -50;
        dispatch({ type: 'UPDATE_NPC_DISPOSITION', payload: { npcId, amount: dispositionBoost } });
        addMessage(`${npc.name}'s goal has been updated to: ${newStatus}. Their disposition towards you changes dramatically.`, 'system');
      }
    }

    if (!wasSuccess && ['deception', 'intimidation', 'persuasion'].includes(skill.name.toLowerCase())) {
      let newSuspicion = npcMemory.suspicion;
      if (npcMemory.suspicion === SuspicionLevel.Unaware) {
        newSuspicion = SuspicionLevel.Suspicious;
      } else if (npcMemory.suspicion === SuspicionLevel.Suspicious) {
        newSuspicion = SuspicionLevel.Alert;
      }

      if (newSuspicion !== npcMemory.suspicion) {
        dispatch({ type: 'UPDATE_NPC_SUSPICION', payload: { npcId: npc.id, newLevel: newSuspicion } });
        addMessage(`${npc.name} seems more suspicious of you now.`, "system");
      }
    }

  } else if (payload?.geminiPrompt) {
    const outcomeResult = await GeminiService.generateActionOutcome(
      payload.geminiPrompt as string,
      generalActionContext,
      gameState.devModelOverride ?? null
    );

    addGeminiLog('generateActionOutcome (custom)', outcomeResult.data?.promptSent || outcomeResult.metadata?.promptSent || "", outcomeResult.data?.rawResponse || outcomeResult.metadata?.rawResponse || outcomeResult.error || "");

    if (outcomeResult.data?.rateLimitHit || outcomeResult.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (outcomeResult.data?.text) {
      addMessage(outcomeResult.data.text, 'system');
      outcomeFact = {
        id: generateId(),
        text: outcomeResult.data.text,
        source: 'direct',
        isPublic: true,
        timestamp: gameState.gameTime.getTime(),
        strength: 8,
        lifespan: 9999,
      };
      if (targetNpcIdForGossip) {
        dispatch({ type: 'ADD_NPC_KNOWN_FACT', payload: { npcId: targetNpcIdForGossip, fact: outcomeFact } });
      }

      // --- Linker Coherence Check ---
      await resolveAndRegisterEntities(outcomeResult.data.text, gameState, dispatch, addGeminiLog);

      // TODO(Linker): Enhance entity creation by linking new NPCs to the current location (e.g. location.npcIds.push(newNpc.id)) and establishing relationships.
      // -----------------------------

    } else {
      addMessage("You attempt the action, but the outcome is unclear or an error occurred.", "system");
    }
  } else {
    addMessage('Invalid custom action.', 'system');
  }

  if (payload?.eventResidue) {
    const residue = payload.eventResidue as { text?: string; discoveryDc?: number };
    const { text, discoveryDc } = residue;
    const location = getCurrentLocation();
    const residentNpcId = location.npcIds?.[0];

    if (residentNpcId && text && discoveryDc) {
      dispatch({
        type: 'ADD_LOCATION_RESIDUE',
        payload: {
          locationId: location.id,
          residue: {
            text,
            discoveryDc,
            discovererNpcId: residentNpcId
          }
        }
      });
      addMessage("You get the feeling you may have left some evidence behind.", "system");
    }
  }

  if (payload?.isEgregious && outcomeFact) {
    const allNpcsInLocation = getCurrentNPCs();
    const witnesses = allNpcsInLocation
      .map(n => n.id)
      .filter(id => id !== targetNpcIdForGossip);

    if (witnesses.length > 0) {
      addMessage(`Your actions have been witnessed by others in the area.`, 'system');
      await handleImmediateGossip(gameState, dispatch, addGeminiLog, witnesses, outcomeFact, targetNpcIdForGossip);
    }
  }

  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}
