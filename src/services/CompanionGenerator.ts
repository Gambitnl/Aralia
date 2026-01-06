/**
 * @file src/services/CompanionGenerator.ts
 * Service for procedurally generating full companion characters.
 * This combines deterministic mechanical generation ("the skeleton")
 * with AI-driven narrative generation ("the soul").
 */

import { PlayerCharacter } from '../types';
import { generateCharacterFromConfig, CharacterGenerationConfig } from './characterGenerator';
import { OllamaClient } from './ollama/client';
import { parseJsonRobustly } from './ollama/jsonParser';
import { CompanionSoulSchema, CompanionSoul } from '../types/companion';

/**
 * Configuration for generating a companion's skeleton.
 * We can expand this later to allow for more specific requests.
 */
export interface CompanionSkeletonConfig {
  level: number; // For now, we'll stick to level 1
  classId: string;
  raceId: string;
}

/**
 * Generates the "skeleton" of a companion.
 * This function is responsible for creating a mechanically valid PlayerCharacter
 * with all the necessary stats, skills, and equipment, but with placeholder
 * narrative details.
 *
 * @param config The configuration for the skeleton.
 * @returns A PlayerCharacter object or null if generation fails.
 */
export function generateSkeleton(config: CompanionSkeletonConfig): PlayerCharacter | null {
  const characterConfig: CharacterGenerationConfig = {
    name: "Generated Character", // Placeholder name
    raceId: config.raceId,
    classId: config.classId,
  };

  const skeleton = generateCharacterFromConfig(characterConfig);

  if (skeleton) {
    // We can add any additional post-processing here if needed.
    // For now, the characterGenerator does a good job.
  }

  return skeleton;
}

// Simple in-memory cache to avoid re-generating souls during development.
const soulCache = new Map<string, CompanionSoul>();

/**
 * Generates the "soul" of a companion.
 * This function is responsible for creating the narrative details of a character
 * by calling the Ollama service.
 *
 * @param skeleton The character skeleton to generate a soul for.
 * @returns A CompanionSoul object or null if generation fails.
 */
export async function generateSoul(skeleton: PlayerCharacter): Promise<CompanionSoul | null> {
  const cacheKey = `${skeleton.race.id}-${skeleton.class.id}`;
  if (soulCache.has(cacheKey)) {
    return soulCache.get(cacheKey) || null;
  }

  const client = new OllamaClient();
  const model = await client.getModel();

  if (!model) {
    console.error("No Ollama model available.");
    return null;
  }

  const prompt = `
    You are a character writer for a gritty high-fantasy RPG.
    Create a complex, believable personality for this character archetype:
    [RACE]: ${skeleton.race.name}
    [CLASS]: ${skeleton.class.name}
    [BACKGROUND]: Criminal

    Return ONLY valid JSON matching this structure:
    {
      "name": "String (Name)",
      "physicalDescription": "String (2 sentences visual description)",
      "personality": {
        "values": ["String", "String", "String"],
        "fears": ["String", "String"],
        "quirks": ["String", "String"]
      },
      "goals": [
        { "description": "String (Public Goal)", "isSecret": false },
        { "description": "String (Secret Goal/Debt/Shame)", "isSecret": true }
      ],
      "reactionStyle": "cynical | hopeful | aggressive | religious"
    }
  `;

  for (let i = 0; i < 3; i++) { // Retry logic
    const result = await client.generate({
      model,
      prompt,
      format: 'json',
    });

    if (result.ok) {
      console.log(`[CompanionGenerator] Attempt ${i + 1} Raw Output:`, result.data.response);
      const parsed = parseJsonRobustly<CompanionSoul>(result.data.response);
      
      if (!parsed) {
        console.error(`[CompanionGenerator] Attempt ${i + 1} JSON Parsing Failed.`);
        window.alert(`Generation Attempt ${i + 1} Failed: JSON Parsing`);
      } else {
        const validation = CompanionSoulSchema.safeParse(parsed);
        if (validation.success) {
          soulCache.set(cacheKey, validation.data);
          return validation.data;
        } else {
          console.error(`[CompanionGenerator] Attempt ${i + 1} Validation Failed:`, validation.error);
          window.alert(`Generation Attempt ${i + 1} Failed: Validation\n${JSON.stringify(validation.error.format(), null, 2)}`);
        }
      }
    } else {
      console.error(`[CompanionGenerator] Attempt ${i + 1} Ollama Error:`, result.error);
      window.alert(`Generation Attempt ${i + 1} Failed: API Error\n${JSON.stringify(result.error)}`);
    }
  }

  console.error("Failed to generate and validate a companion soul after 3 attempts.");
  return null;
}

/**
 * Generates a full companion by creating a skeleton and a soul,
 * and then assembling them into a single PlayerCharacter object.
 *
 * @param config The configuration for the companion.
 * @returns A complete PlayerCharacter object or null if generation fails.
 */
export async function generateCompanion(config: CompanionSkeletonConfig): Promise<PlayerCharacter | null> {
  const skeleton = generateSkeleton(config);
  if (!skeleton) {
    console.error("Failed to generate skeleton.");
    return null;
  }

  const soul = await generateSoul(skeleton);
  if (!soul) {
    console.error("Failed to generate soul.");
    return null;
  }

  // Assemble the full character
  const companion: PlayerCharacter = {
    ...skeleton,
    name: soul.name,
    soul: soul,
  };

  return companion;
}
