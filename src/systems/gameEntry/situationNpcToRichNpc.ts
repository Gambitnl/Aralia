/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/situationNpcToRichNpc.ts
 *
 * Turns a generated {@link SituationNPC} into a full {@link RichNPC} so the
 * opening-situation strangers are not just chat-panel voices — they are placed
 * in the world as real, interactable entities (ActionPane "Talk to", dialogue
 * system, 3D/town rendering all resolve from `generatedNpcs`).
 *
 * The situation's free-text role drives a best-effort mapping to the engine's
 * functional role enum; the disposition + goal become the NPC's personality
 * prompt; the opening line (for the speaker) seeds their dialogue.
 */

import type { RichNPC } from '../../types/world';
import { generateNPC } from '../../services/npcGenerator';
import type { OpeningSituation, SituationNPC } from './types';

type NpcRole = RichNPC['role'];

/**
 * Map a free-text situational role ("smug toll collector", "panicked guard
 * captain") to the engine's functional role enum. Falls back to 'civilian'.
 */
export function mapSituationRole(roleText: string): NpcRole {
    const r = roleText.toLowerCase();
    if (/(guard|soldier|captain|watch|sentry|warden|knight|militia)/.test(r)) return 'guard';
    if (/(merchant|trader|shopkeep|apothecar|vendor|smith|innkeep|peddler|broker)/.test(r)) return 'merchant';
    if (/(priest|oracle|seer|stranger|wizard|witch|mystic|noble|spy)/.test(r)) return 'unique';
    return 'civilian';
}

/**
 * Convert a single SituationNPC into a RichNPC grounded in the scene.
 *
 * @param npc          The generated situational NPC (already has a runtime id).
 * @param openingLine  The situation's opening line; used as the speaker's dialogue seed.
 */
export function situationNpcToRichNpc(
    npc: SituationNPC,
    openingLine?: OpeningSituation['openingLine'],
): RichNPC {
    const role = mapSituationRole(npc.role);

    // generateNPC fills valid stats/biography/equipment/visuals; we then overlay
    // the situation-specific identity so the placed NPC matches the predicament.
    const rich = generateNPC({
        id: npc.id,
        name: npc.name,
        role,
        occupation: npc.role,
    });

    const isSpeaker = openingLine?.speakerId === npc.id;

    return {
        ...rich,
        baseDescription: `${npc.role}, ${npc.disposition}.`,
        initialPersonalityPrompt:
            `You are ${npc.name}, ${npc.role}. Right now you are part of a situation the player has just walked into. ` +
            `Your disposition toward them is: ${npc.disposition}. Your immediate goal is: ${npc.goal}. ` +
            `Stay in that moment and react accordingly.`,
        dialoguePromptSeed: isSpeaker && openingLine ? openingLine.text : rich.dialoguePromptSeed,
    };
}

/**
 * Convert every NPC in a situation into placed RichNPCs.
 */
export function situationNpcsToRichNpcs(situation: OpeningSituation): RichNPC[] {
    return situation.npcs.map((n) => situationNpcToRichNpc(n, situation.openingLine));
}
