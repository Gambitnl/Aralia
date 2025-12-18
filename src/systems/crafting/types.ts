
import { CharacterStats } from '@/types'; // Using CharacterStats for now, or just plain interface

// Use existing types where possible
export type CraftingSkill = 'arcana' | 'history' | 'investigation' | 'nature' | 'religion' | 'animal_handling' | 'insight' | 'medicine' | 'perception' | 'survival' | 'deception' | 'intimidation' | 'performance' | 'persuasion';

export interface MaterialRequirement {
  itemId: string;
  quantity: number;
  consumed: boolean;
  qualityMin?: string;
}

export interface CraftingOutput {
  itemId: string;
  quantity: number;
  qualityFromRoll: boolean;
  bonusOnCrit?: string;
}

export interface SkillRequirement {
  skill: string; // Should match a key in AbilityScores or Skill type if strictly typed
  difficultyClass: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  inputs: MaterialRequirement[];
  outputs: CraftingOutput[];
  station?: string;
  skillCheck?: SkillRequirement;
  timeMinutes: number;
}

export interface CraftResult {
  success: boolean;
  quality: 'poor' | 'standard' | 'superior';
  details: string;
  materialsLost: boolean;
  // In a full implementation, we would return the actual items to add/remove
  outputs?: { itemId: string; quantity: number }[];
}

export interface Crafter {
    name: string;
    stats: CharacterStats;
    // We might need a method to get skill modifier.
    // For now, let's assume the crafter object has a method or we pass a helper.
    // To keep it simple and decoupled, we can pass a function to get the roll.
}
