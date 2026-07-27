/**
 * ARCHITECTURAL CONTEXT:
 * This service handles 'Banter Logic' via the local Ollama LLM. It focuses
 * on generating character-driven dialogue that responds to the environment,
 * recent events, and participants' specific personas.
 *
 * Recent updates introduce 'Player-Directed' and 'Escalation' modes.
 * Instead of just NPCs talking to each other, companions can now address
 * the player directly. The prompts have been refined to include the
 * player's equipment and class, allowing NPCs to comment on the player's
 * actual gear (e.g., 'Nice sword, where'd you find it?').
 *
 * It also includes 'Escalation' logic: if a player ignores a companion
 * for too long, the companion's next line is shaped by their
 * extraversion/neuroticism (e.g., pushing back vs. being resigned).
 *
 * @file src/services/ollama/banter.ts
 */
import type { BanterDefinition } from '../../types/companions';
import type { BanterContext, BanterParticipant, BanterLineData, OllamaResult } from '../../types/ollama';
import { OllamaClient } from './client';
export declare function buildBanterPrompt(participants: BanterParticipant[], contextData: BanterContext): string;
/**
 * Generates a dynamic banter definition using the local LLM.
 */
export declare function generateBanter(participants: BanterParticipant[], contextData: BanterContext, client?: OllamaClient): Promise<OllamaResult<BanterDefinition>>;
/**
 * Generates a single banter line for turn-by-turn conversation.
 */
export declare function generateBanterLine(participants: BanterParticipant[], conversationHistory: {
    speakerId: string;
    speakerName: string;
    text: string;
}[], contextData: BanterContext, turnNumber: number, onPending?: (id: string, prompt: string, model: string) => void, client?: OllamaClient): Promise<OllamaResult<BanterLineData>>;
/**
 * Generates a single banter line where the NPC speaks directly to the player.
 * Used for PLAYER_DIRECTED banter mode (1 NPC or 2+ NPCs addressing the player).
 */
export declare function generatePlayerDirectedLine(npc: BanterParticipant, context: BanterContext, conversationHistory: {
    speakerId: string;
    speakerName: string;
    text: string;
}[], turnNumber: number, onPending?: (id: string, prompt: string, model: string) => void, client?: OllamaClient): Promise<OllamaResult<BanterLineData>>;
/**
 * Generates an escalation/follow-up line from an NPC when the player hasn't responded.
 * Tone is driven by the NPC's extraversion and neuroticism personality values.
 */
export declare function generateEscalationLine(npc: BanterParticipant, context: BanterContext, conversationHistory: {
    speakerId: string;
    speakerName: string;
    text: string;
}[], ignoreCount: number, onPending?: (id: string, prompt: string, model: string) => void, client?: OllamaClient): Promise<OllamaResult<BanterLineData>>;
