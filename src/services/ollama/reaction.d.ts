/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/reaction.ts
 * Companion reaction generation for in-game events.
 */
import type { BanterContext, ReactionCompanion, ReactionEvent, ReactionResponse, OllamaResult } from '../../types/ollama';
import { OllamaClient } from './client';
/**
 * Generates a short, contextual reaction for a companion based on an event.
 * This is used for dynamic in-game reactions (e.g., looting, crimes, combat).
 */
export declare function generateReaction(companion: ReactionCompanion, event: ReactionEvent, contextData: BanterContext, client?: OllamaClient): Promise<OllamaResult<ReactionResponse>>;
