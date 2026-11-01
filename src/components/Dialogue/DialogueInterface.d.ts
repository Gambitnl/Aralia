import React from 'react';
import { DialogueSession } from '../../types/dialogue';
import { GameState, NPC, PlayerCharacter } from '../../types';
import { ProcessTopicResult } from '../../services/dialogueService';
import { DialogueGraph, DialogueGraphContext, DialogueEffectOutcome } from '../../systems/dialogue/dialogueGraphTypes';
/**
 * This file renders the conversation window players use when talking to an NPC.
 *
 * The game opens it from GameModals after START_DIALOGUE_SESSION creates an
 * active dialogue session. It reads available topics from dialogueService,
 * sends selected topics back through reducer callbacks, and uses WindowFrame
 * for the draggable/resizable outer window.
 */
interface DialogueInterfaceProps {
    isOpen: boolean;
    session: DialogueSession | null;
    gameState: GameState;
    npc: NPC;
    playerCharacter: PlayerCharacter;
    onClose: () => void;
    onUpdateSession: (newSession: DialogueSession) => void;
    onTopicOutcome?: (result: ProcessTopicResult, topicId: string) => void;
    onGenerateResponse: (prompt: string, signal?: AbortSignal) => Promise<string>;
    /**
     * Invokes the "Invite to party" flow for an available companion opportunity.
     * Ordinary household residents need an established companion record;
     * the downstream consent gate still decides trust and willingness.
     */
    onInvite?: (npcId: string) => void;
    /**
     * Scripted-conversation mode (DIAL-001). Supply an already-loaded graph or
     * an id to fetch through the loader; when neither is present the existing
     * topic-pool behavior is unchanged.
     */
    dialogueGraph?: DialogueGraph;
    dialogueGraphId?: string;
    /** Initial gating context for graph conditions. */
    graphContext?: DialogueGraphContext;
    /** Receives resolved (not applied) effects fired by graph nodes. */
    onGraphEffects?: (outcomes: DialogueEffectOutcome[]) => void;
}
export declare const DialogueInterface: React.FC<DialogueInterfaceProps>;
export {};
