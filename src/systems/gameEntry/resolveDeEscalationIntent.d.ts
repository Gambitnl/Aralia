/**
 * @file src/systems/gameEntry/resolveDeEscalationIntent.ts
 * Structured Ollama call: read the player's free-text response to a hostile
 * opening and classify it as an attack, a concrete skill attempt, or ambiguous.
 * NO FALLBACK: transport/parse failure throws (caller surfaces an honest retry).
 */
import type { OllamaClient } from '../../services/ollama/client';
import type { AbilityScoreName } from '../../types';
export interface IntentSkillInfo {
    name: string;
    ability: AbilityScoreName;
    proficient: boolean;
    modifier: number;
}
export type IntentResolution = {
    kind: 'attack';
} | {
    kind: 'skill' | 'flee';
    skill: string;
    ability: AbilityScoreName;
    rationale: string;
} | {
    kind: 'ambiguous';
    candidateSkills: string[];
};
interface Deps {
    client?: OllamaClient;
}
export declare function resolveDeEscalationIntent(playerText: string, tension: string, skills: IntentSkillInfo[], deps?: Deps): Promise<IntentResolution>;
export {};
