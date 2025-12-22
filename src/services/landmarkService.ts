
import { createSeededRandom } from '../utils/submapUtils';
import { DiscoveryReward, DiscoveryConsequence } from '../types/exploration';
import { LANDMARK_ORIGINS, LANDMARK_TYPES, LANDMARK_STATES, LandmarkOrigin, LandmarkType, LandmarkState } from '../data/landmarkGenData';

export interface GeneratedLandmark {
  id: string;
  name: string;
  description: string;
  type: string;
  rewards: DiscoveryReward[];
  consequences: DiscoveryConsequence[];
}

/**
 * Generates a landmark for a given world location if one exists.
 * This is deterministic based on world seed and coordinates.
 *
 * Uses a combinatorial approach (Origin + Type + State) to generate varied content.
 */
export function generateLandmark(
  worldSeed: number,
  coordinates: { x: number; y: number },
  biomeId: string
): GeneratedLandmark | null {
  // Use a specific seed suffix for landmarks to ensure separation from other generation
  const rng = createSeededRandom(worldSeed, coordinates, biomeId, 'landmark_gen_v2');

  // 15% chance to have a landmark in any wilderness tile (increased from 10% because they are cooler now)
  if (rng() > 0.15) {
    return null;
  }

  // 1. Select Origin based on Biome and Rarity
  const validOrigins = LANDMARK_ORIGINS.filter(o => o.commonBiomes.includes('all') || o.commonBiomes.includes(biomeId));
  if (validOrigins.length === 0) return null; // Should not happen given 'Ancient' exists
  const origin = validOrigins[Math.floor(rng() * validOrigins.length)];

  // 2. Select Type
  // Use baseWeight for weighted selection
  const totalWeight = LANDMARK_TYPES.reduce((sum, t) => sum + t.baseWeight, 0);
  let randomVal = rng() * totalWeight;
  let type = LANDMARK_TYPES[LANDMARK_TYPES.length - 1];

  for (const t of LANDMARK_TYPES) {
    randomVal -= t.baseWeight;
    if (randomVal <= 0) {
      type = t;
      break;
    }
  }

  // 3. Select State
  const state = LANDMARK_STATES[Math.floor(rng() * LANDMARK_STATES.length)];

  // 4. Construct Name
  // e.g. "Overgrown Elven Shrine", "Haunted Ancient Tower"
  // Format: "{State.Suffix} {Origin.Name} {Type.Name}" or "{Origin.Name} {Type.Name}"
  // Let's make it natural.
  let name = `${origin.name} ${type.name}`;
  if (rng() > 0.5 && state.id !== 'pristine') {
     // Use adjective form roughly
     name = `${state.nameSuffix} ${name}`;
  }

  // 5. Construct Description
  const descTemplate = type.descriptionTemplates[Math.floor(rng() * type.descriptionTemplates.length)];
  let description = descTemplate.replace('{origin}', origin.name.toLowerCase());
  description += ` ${state.descriptionModifier}`;

  // Add flavor adjective
  const flavorAdj = origin.descriptionPrefix[Math.floor(rng() * origin.descriptionPrefix.length)];
  description = description.replace(origin.name.toLowerCase(), `${flavorAdj.toLowerCase()} ${origin.name.toLowerCase()}`);


  // 6. Generate Rewards (Based on Origin & State)
  const rewards: DiscoveryReward[] = [];

  // If state is 'looted', reduce rewards significantly
  const isLooted = state.id === 'looted';
  const rewardChance = isLooted ? 0.2 : 0.8;

  if (rng() < rewardChance) {
      // Pick a reward type appropriate for the origin
      const rewardType = origin.rewardTypes[Math.floor(rng() * origin.rewardTypes.length)];

      switch (rewardType) {
          case 'gold':
              const goldAmount = Math.floor(rng() * 50) + 10 + (state.riskLevel * 10);
              rewards.push({
                  type: 'gold',
                  amount: goldAmount,
                  description: `You find ${goldAmount} gold coins hidden in the structure.`
              });
              break;
          case 'xp':
              const xpAmount = 25 + (state.riskLevel * 25);
              rewards.push({
                  type: 'xp',
                  amount: xpAmount,
                  description: `Investigating the site grants ${xpAmount} XP.`
              });
              break;
          case 'health':
              const healAmount = 10 + Math.floor(rng() * 10);
              rewards.push({
                  type: 'health',
                  amount: healAmount,
                  description: `A lingering aura of restoration heals you for ${healAmount} HP.`
              });
              break;
          case 'item':
              // Simple item placeholder - ideally would pull from a loot table
              // For now, give a potion or generic item
              const itemId = rng() > 0.5 ? 'healing_potion' : 'torch';
              const itemName = itemId === 'healing_potion' ? 'Healing Potion' : 'Torch';
              rewards.push({
                  type: 'item',
                  resourceId: itemId,
                  amount: 1,
                  description: `You discover a ${itemName}.`
              });
              break;
      }
  }

  // 7. Generate Consequences (Based on State)
  const consequences: DiscoveryConsequence[] = [];

  state.consequenceTypes.forEach(cType => {
      if (rng() < 0.6) { // Not every consequence happens
          if (cType === 'map_reveal') {
              const radius = 1 + Math.floor(rng() * 2);
              consequences.push({
                  type: 'map_reveal',
                  value: radius,
                  description: 'The high vantage point allows you to chart the surrounding area.'
              });
          } else if (cType === 'reputation') {
              // Pick a random faction or guild?
              // For now, let's say 'explorers_guild' or similar
              consequences.push({
                  type: 'reputation',
                  targetId: 'explorers_guild',
                  value: 5,
                  description: 'Mapping this location impresses the Explorers Guild.'
              });
          } else if (cType === 'buff') {
              // Placeholder for buff system
              // We haven't fully implemented the reducer for buffs, but we can log it.
              // Or use 'health' reward instead if buffs are hard.
              // But handleMovement ignores 'buff' type in consequences currently (Wait, did I add it? No, I added gold/xp to REWARDS/EFFECTS, not Consequences)
              // Actually DiscoveryConsequence uses 'buff', but applyDiscoveryConsequences in handleMovement.ts ignores it.
              // I should update handleMovement.ts to handle 'buff' if I want it.
              // For now, let's skip adding it to avoid "nothing happens" bugs, unless I fixed it.
              // I did NOT fix applyDiscoveryConsequences for buffs yet.
              // So I will map 'buff' to a direct health heal for now or skip.
              // Let's skip.
          }
      }
  });

  return {
    id: `landmark_${origin.id}_${type.id}_${coordinates.x}_${coordinates.y}`,
    name: name,
    description: description,
    type: 'procedural_landmark',
    rewards,
    consequences
  };
}
