/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:29:01
 * Dependents: ollama/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ollama/facts.ts
 * Extracts discovered character facts from banter conversations.
 */
import type { DiscoveredFact } from '../../types/companions';
import type { OllamaResult } from '../../types/ollama';
import { OllamaClient } from './client';
interface ParticipantData {
    id: string;
    name: string;
    knownFacts: string[];
}
/**
 * Extracts new personal facts about companions from a banter conversation.
 * Compares against known facts to only return genuinely new information.
 */
export declare function extractDiscoveredFacts(conversation: {
    speakerId: string;
    speakerName: string;
    text: string;
}[], participants: ParticipantData[], client?: OllamaClient): Promise<OllamaResult<DiscoveredFact[]>>;
export {};
