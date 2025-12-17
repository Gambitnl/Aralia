
import { LANDMARK_TEMPLATES } from '../data/landmarks';
import { createSeededRandom } from '../utils/submapUtils'; // Reusing existing seeded RNG utility

export interface GeneratedLandmark {
  id: string;
  name: string;
  description: string;
  type: string;
}

/**
 * Generates a landmark for a given world location if one exists.
 * This is deterministic based on world seed and coordinates.
 */
export function generateLandmark(
  worldSeed: number,
  coordinates: { x: number; y: number },
  biomeId: string
): GeneratedLandmark | null {
  // Use a specific seed suffix for landmarks to ensure separation from other generation
  const rng = createSeededRandom(worldSeed, coordinates, biomeId, 'landmark_gen_v1');

  // 10% chance to have a landmark in any wilderness tile
  if (rng() > 0.1) {
    return null;
  }

  // Filter templates by biome
  const validTemplates = LANDMARK_TEMPLATES.filter(t => t.biomes.includes(biomeId) || t.biomes.includes('all'));

  if (validTemplates.length === 0) {
    return null;
  }

  // Select template based on weight
  const totalWeight = validTemplates.reduce((sum, t) => sum + t.weight, 0);
  let randomVal = rng() * totalWeight;
  let selectedTemplate = validTemplates[validTemplates.length - 1];

  for (const template of validTemplates) {
    randomVal -= template.weight;
    if (randomVal <= 0) {
      selectedTemplate = template;
      break;
    }
  }

  // Generate details
  const nameIndex = Math.floor(rng() * selectedTemplate.nameTemplate.length);
  const descIndex = Math.floor(rng() * selectedTemplate.descriptionTemplate.length);

  return {
    id: `${selectedTemplate.id}_${coordinates.x}_${coordinates.y}`,
    name: selectedTemplate.nameTemplate[nameIndex],
    description: selectedTemplate.descriptionTemplate[descIndex],
    type: selectedTemplate.id,
  };
}
