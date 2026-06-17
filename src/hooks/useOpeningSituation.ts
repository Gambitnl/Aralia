/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useOpeningSituation.ts
 *
 * Orchestrates the opening-situation entry flow. When the entry state machine
 * enters `generating` (fired once by startGame for a brand-new game), this hook
 * runs the non-deterministic Ollama generator, then drops the player straight
 * into a conversation seeded with the predicament + the NPC's opening line.
 *
 * NO FALLBACK: if generation throws (model down / unparseable), the hook moves
 * the machine to `model-unavailable`. The entry gate surfaces the honest
 * dependency block + retry — it never invents a scene.
 */

import { useEffect, useRef, useCallback } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
import { LOCATIONS, STARTING_LOCATION_ID } from '../data/world/locations';
import { generateId } from '../utils/core/idGenerator';
import type { ConversationMessage, ConversationNpcParticipant } from '../types/conversation';
import {
    generateOpeningSituation,
    type GenerateOpeningSituationDeps,
} from '../systems/gameEntry/generateOpeningSituation';
import { situationNpcsToRichNpcs } from '../systems/gameEntry/situationNpcToRichNpc';
import type {
    OpeningSituation,
    OpeningSituationCharacter,
    OpeningSituationLocation,
} from '../systems/gameEntry/types';

export interface UseOpeningSituationOptions {
    /** Inject the generator (tests). Defaults to the real Ollama generator. */
    generate?: (
        character: OpeningSituationCharacter,
        location: OpeningSituationLocation,
        deps?: GenerateOpeningSituationDeps,
    ) => Promise<OpeningSituation>;
}

/**
 * Build the character context fed to the generator from the player party head.
 */
export function buildSituationCharacter(state: GameState): OpeningSituationCharacter | null {
    const pc = state.party?.[0];
    if (!pc) return null;
    return {
        name: pc.name,
        race: pc.race?.name ?? 'unknown',
        characterClass: pc.class?.name ?? 'adventurer',
        background: pc.background ?? 'wanderer',
    };
}

/**
 * Build the location context from the current/starting location.
 */
export function buildSituationLocation(state: GameState): OpeningSituationLocation {
    const locId = state.currentLocationId || STARTING_LOCATION_ID;
    const loc = LOCATIONS[locId];
    return {
        name: loc?.name ?? locId,
        biome: loc?.biomeId,
    };
}

/**
 * Translate a generated situation into the conversation seed: a narration
 * message (the predicament) followed by the NPC's opening utterance.
 */
export function buildConversationSeed(situation: OpeningSituation): {
    initialMessages: ConversationMessage[];
    npcParticipants: ConversationNpcParticipant[];
    participantIds: string[];
} {
    const now = Date.now();
    const narration: ConversationMessage = {
        id: generateId(),
        speakerId: 'narrator',
        text: `${situation.setting.place} — ${situation.setting.timeOfDay}, ${situation.setting.weather}. ${situation.predicament}`,
        timestamp: now,
    };
    const utterance: ConversationMessage = {
        id: generateId(),
        speakerId: situation.openingLine.speakerId,
        text: situation.openingLine.text,
        timestamp: now + 1,
    };

    const npcParticipants: ConversationNpcParticipant[] = situation.npcs.map((n) => ({
        id: n.id,
        name: n.name,
        personality: `${n.role}. Disposition toward the player: ${n.disposition}. Immediate goal: ${n.goal}.`,
    }));

    // The speaker responds first when the player replies, so order it first.
    const speakerId = situation.openingLine.speakerId;
    const participantIds = [
        speakerId,
        ...situation.npcs.map((n) => n.id).filter((id) => id !== speakerId),
    ];

    return { initialMessages: [narration, utterance], npcParticipants, participantIds };
}

export function useOpeningSituation(
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>,
    options: UseOpeningSituationOptions = {},
): void {
    const generate = options.generate ?? generateOpeningSituation;
    // Guard so a single `generating` window fires exactly one model call even
    // across re-renders. Reset whenever we leave the generating state.
    const runningRef = useRef(false);
    const status = gameState.gameEntry?.status ?? 'idle';

    const run = useCallback(async () => {
        const character = buildSituationCharacter(gameState);
        if (!character) {
            dispatch({ type: 'FAIL_OPENING_SITUATION', payload: 'No player character to ground the situation.' });
            return;
        }
        const location = buildSituationLocation(gameState);

        try {
            const situation = await generate(character, location);

            // Place the generated strangers into the scene as real, interactable
            // NPCs (not just chat voices) before opening the conversation.
            const placedNpcs = situationNpcsToRichNpcs(situation);
            dispatch({ type: 'PLACE_SITUATION_NPCS', payload: { npcs: placedNpcs } });

            const { initialMessages, npcParticipants, participantIds } = buildConversationSeed(situation);
            dispatch({
                type: 'START_CONVERSATION',
                payload: {
                    companionIds: participantIds,
                    initialMessages,
                    kind: 'situation',
                    npcParticipants,
                },
            });
            dispatch({ type: 'RESOLVE_OPENING_SITUATION', payload: situation });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            dispatch({ type: 'FAIL_OPENING_SITUATION', payload: message });
        }
    }, [gameState, dispatch, generate]);

    useEffect(() => {
        if (status === 'generating' && !runningRef.current) {
            runningRef.current = true;
            void run();
        } else if (status !== 'generating') {
            runningRef.current = false;
        }
        // `run` intentionally omitted: we only want to fire on the status edge,
        // not on every gameState change while a generation is already in flight.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);
}
