/**
 * @file src/hooks/useDialogueSystem.ts
 * @description
 * This hook acts as the central controller for the Dialogue System.
 * It connects the Game State (Redux), the Dialogue Service (Business Logic),
 * and the AI Service (Gemini) to the UI components.
 *
 * It handles:
 * 1. Generating AI responses.
 * 2. Processing side effects of dialogue choices (XP, Reputation, Unlocks, Costs).
 * 3. Managing the dialogue session lifecycle.
 */
import { GameState, Action } from '../types';
import { AppAction } from '../state/actionTypes';
import { ProcessTopicResult } from '../services/dialogueService';
export declare const useDialogueSystem: (gameState: GameState, dispatch: React.Dispatch<AppAction>, 
/**
 * The interaction-action processor (`processAction` from useGameActions).
 * Required to make {@link inviteToParty} work end-to-end: the `talk` action
 * is routed through the action handlers (handleNpcInteraction → handleRecruitOffer),
 * NOT the Redux reducer, so a raw `dispatch` would be inert for it. When omitted
 * (e.g. in unit tests of the side-effect callbacks), `inviteToParty` falls back
 * to `dispatch` so the action is still emitted and assertable.
 */
processAction?: (action: Action) => void) => {
    generateResponse: (prompt: string) => Promise<string>;
    handleTopicOutcome: (result: ProcessTopicResult, topicId: string) => void;
    inviteToParty: (npcId: string) => void;
};
