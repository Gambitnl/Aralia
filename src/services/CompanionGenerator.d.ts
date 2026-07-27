/**
 * @file src/services/CompanionGenerator.ts
 * Service for procedurally generating full companion characters.
 * This combines deterministic mechanical generation ("the skeleton")
 * with AI-driven narrative generation ("the soul").
 */
import { PlayerCharacter } from '../types';
import { CompanionSoul } from '../types/companion';
/**
 * Configuration for generating a companion's skeleton.
 * We can expand this later to allow for more specific requests.
 */
export interface CompanionSkeletonConfig {
    level: number;
    classId: string;
    raceId: string;
    /** Optional gender for consistent name/description generation */
    gender?: 'male' | 'female';
}
/**
 * Generates the "skeleton" of a companion.
 * This function is responsible for creating a mechanically valid PlayerCharacter
 * with all the necessary stats, skills, and equipment, but with placeholder
 * narrative details. Also generates rich NPC data for biography/family info.
 *
 * @param config The configuration for the skeleton.
 * @returns A PlayerCharacter object or null if generation fails.
 */
export declare function generateSkeleton(config: CompanionSkeletonConfig): PlayerCharacter | null;
/**
 * Generates the "soul" of a companion.
 * This function is responsible for creating the narrative details of a character
 * by calling the Ollama service.
 *
 * @param skeleton The character skeleton to generate a soul for.
 * @returns A CompanionSoul object or null if generation fails.
 */
export declare function generateSoul(skeleton: PlayerCharacter): Promise<CompanionSoul | null>;
/**
 * Generates a full companion by creating a skeleton and a soul,
 * and then assembling them into a single PlayerCharacter object.
 *
 * @param config The configuration for the companion.
 * @returns A complete PlayerCharacter object or null if generation fails.
 */
export declare function generateCompanion(config: CompanionSkeletonConfig): Promise<PlayerCharacter | null>;
