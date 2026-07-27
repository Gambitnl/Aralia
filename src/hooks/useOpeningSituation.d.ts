/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 01:42:00
 * Dependents: components/gameEntry/OpeningSituationGate.tsx
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import type { ConversationMessage, ConversationNpcParticipant } from '../types/conversation';
import { type GenerateOpeningSituationDeps } from '../systems/gameEntry/generateOpeningSituation';
import type { OpeningSituation, OpeningSituationCharacter, OpeningSituationLocation } from '../systems/gameEntry/types';
export interface UseOpeningSituationOptions {
    /** Inject the generator (tests). Defaults to the real Ollama generator. */
    generate?: (character: OpeningSituationCharacter, location: OpeningSituationLocation, deps?: GenerateOpeningSituationDeps) => Promise<OpeningSituation>;
    /** Inject the scene-image generator (tests). Defaults to the real SceneService. */
    generateScene?: (prompt: string) => Promise<string>;
    /**
     * Whether to attempt the opening-scene illustration. Defaults to the portrait
     * feature flag (image gen is a local-only dev capability).
     */
    enableScene?: boolean;
}
/**
 * Read the dev-only `?openingMood=peaceful|hostile` QA knob. Returns undefined
 * outside dev, when the param is absent, or when it is not a recognized value —
 * so production and normal play are never steered.
 */
export declare function readOpeningMoodHint(): 'peaceful' | 'hostile' | undefined;
/**
 * Build the character context fed to the generator from the player party head.
 */
export declare function buildSituationCharacter(state: GameState): OpeningSituationCharacter | null;
/**
 * Build the location context from the current/starting location.
 */
export declare function buildSituationLocation(state: GameState): OpeningSituationLocation;
/**
 * Translate a generated situation into the conversation seed: a narration
 * message (the predicament) followed by the NPC's opening utterance.
 */
export declare function buildConversationSeed(situation: OpeningSituation): {
    initialMessages: ConversationMessage[];
    npcParticipants: ConversationNpcParticipant[];
    participantIds: string[];
};
export declare function useOpeningSituation(gameState: GameState, dispatch: React.Dispatch<AppAction>, options?: UseOpeningSituationOptions): void;
