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
import type { OpeningSituation, SituationNPC } from './types';
type NpcRole = RichNPC['role'];
/**
 * Map a free-text situational role ("smug toll collector", "panicked guard
 * captain") to the engine's functional role enum. Falls back to 'civilian'.
 */
export declare function mapSituationRole(roleText: string): NpcRole;
/**
 * Convert a single SituationNPC into a RichNPC grounded in the scene.
 *
 * @param npc          The generated situational NPC (already has a runtime id).
 * @param openingLine  The situation's opening line; used as the speaker's dialogue seed.
 */
export declare function situationNpcToRichNpc(npc: SituationNPC, openingLine?: OpeningSituation['openingLine']): RichNPC;
/**
 * Convert every NPC in a situation into placed RichNPCs.
 */
export declare function situationNpcsToRichNpcs(situation: OpeningSituation): RichNPC[];
export {};
