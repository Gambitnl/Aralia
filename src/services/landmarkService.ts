
import { LANDMARK_TEMPLATES } from '../data/landmarks';
import { createSeededRandom } from '../utils/submapUtils'; // Reusing existing seeded RNG utility
import { DiscoveryReward, DiscoveryConsequence, DiscoveryOption } from '../types/exploration';

export interface GeneratedLandmark {
  id: string;
  name: string;
  description: string;
  type: string;
  rewards: DiscoveryReward[];
  consequences: DiscoveryConsequence[];
  interactions: DiscoveryOption[];
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

  // Helper to generate rewards
  const generateRewards = (templates: typeof selectedTemplate.possibleRewards): DiscoveryReward[] => {
    const rewards: DiscoveryReward[] = [];
    if (templates) {
        for (const rewardTemplate of templates) {
            if (rng() < rewardTemplate.chance) {
                const min = rewardTemplate.amountRange[0];
                const max = rewardTemplate.amountRange[1];
                const amount = Math.floor(rng() * (max - min + 1)) + min;
                const description = rewardTemplate.descriptionTemplate.replace('{amount}', amount.toString());
                rewards.push({
                    type: rewardTemplate.type,
                    resourceId: rewardTemplate.resourceId,
                    amount,
                    description
                });
            }
        }
    }
    return rewards;
  };

  // Helper to generate consequences
  const generateConsequences = (templates: typeof selectedTemplate.possibleConsequences): DiscoveryConsequence[] => {
      const consequences: DiscoveryConsequence[] = [];
      if (templates) {
          for (const consequenceTemplate of templates) {
              if (rng() < consequenceTemplate.chance) {
                  let description = consequenceTemplate.descriptionTemplate;
                  if (consequenceTemplate.value !== undefined) {
                      description = description.replace('{value}', consequenceTemplate.value.toString());
                  }
                  if (consequenceTemplate.duration !== undefined) {
                      description = description.replace('{duration}', consequenceTemplate.duration.toString());
                  }
                  consequences.push({
                      type: consequenceTemplate.type,
                      targetId: consequenceTemplate.targetId,
                      duration: consequenceTemplate.duration,
                      value: consequenceTemplate.value,
                      description
                  });
              }
          }
      }
      return consequences;
  };

  const baseRewards = generateRewards(selectedTemplate.possibleRewards);
  const baseConsequences = generateConsequences(selectedTemplate.possibleConsequences);

  // Generate Interactions
  const interactions: DiscoveryOption[] = [];
  if (selectedTemplate.possibleInteractions) {
      selectedTemplate.possibleInteractions.forEach(interactionTemplate => {
          // Calculate Difficulty (deterministic)
          let difficulty = 10;
          if (interactionTemplate.skillCheck) {
               const minDiff = interactionTemplate.skillCheck.difficultyRange[0];
               const maxDiff = interactionTemplate.skillCheck.difficultyRange[1];
               difficulty = Math.floor(rng() * (maxDiff - minDiff + 1)) + minDiff;
          }

          interactions.push({
              id: interactionTemplate.id,
              label: interactionTemplate.labelTemplate,
              description: interactionTemplate.descriptionTemplate,
              skillCheck: interactionTemplate.skillCheck ? {
                  skill: interactionTemplate.skillCheck.skill,
                  difficulty
              } : undefined,
              successRewards: generateRewards(interactionTemplate.successRewards),
              successConsequences: generateConsequences(interactionTemplate.successConsequences),
              failureConsequences: generateConsequences(interactionTemplate.failureConsequences)
          });
      });
  }

  return {
    id: `${selectedTemplate.id}_${coordinates.x}_${coordinates.y}`,
    name: selectedTemplate.nameTemplate[nameIndex],
    description: selectedTemplate.descriptionTemplate[descIndex],
    type: selectedTemplate.id,
    rewards: baseRewards,
    consequences: baseConsequences,
    interactions
  };
}
