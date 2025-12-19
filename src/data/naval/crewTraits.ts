/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/naval/crewTraits.ts
 * Static data for crew generation: names, traits, and role definitions.
 */

import { CrewRole } from '../../types/naval';

export const CREW_NAMES = [
  'Barnaby', 'Silas', 'Old Tom', 'Red Jack', 'Stumpy',
  'Fairweather', 'Grog', 'Whistling Pete', 'One-Eye', 'Blacktooth',
  'Isla', 'Marina', 'Storm', 'Coral', 'Pearl',
  'Sal', 'Finn', 'Moby', 'Drake', 'Hawkins',
  'Sparrow', 'Hook', 'Morgan', 'Vane', 'Bonny',
  'Read', 'Teach', 'Kidd', 'Roberts', 'Low'
];

export const CREW_SURNAMES = [
  'Waves', 'Tide', 'Salt', 'Fish', 'Gale',
  'Storm', 'Reef', 'Shoal', 'Crab', 'Shark',
  'Whale', 'Seagull', 'Mast', 'Deck', 'Anchor',
  'Rope', 'Sail', 'Knot', 'Plank', 'Barrel'
];

export const CREW_TRAITS: Record<string, { effect: string; moraleModifier?: number; skillBonus?: Record<string, number> }> = {
  'Superstitious': { effect: 'Morale drops faster in bad weather', moraleModifier: -10 },
  'Loyal': { effect: 'Morale drops slower', moraleModifier: 10 },
  'Drunkard': { effect: 'May be incapacitated', skillBonus: { 'Constitution': 2, 'Dexterity': -2 } },
  'Sea-Legs': { effect: 'Immune to sea sickness', skillBonus: { 'Acrobatics': 2 } },
  'Carpenter': { effect: 'Can repair ship', skillBonus: { 'Repair': 5 } },
  'Cook': { effect: 'Improves morale with food', skillBonus: { 'Cooking': 5 } },
  'Musician': { effect: 'Improves morale with songs', skillBonus: { 'Performance': 5 } },
  'Navigator': { effect: 'Bonus to navigation', skillBonus: { 'Survival': 5 } },
  'Veteran': { effect: 'Has seen battle', moraleModifier: 20, skillBonus: { 'Intimidation': 2 } },
  'Greenhorn': { effect: 'Inexperienced', moraleModifier: -10, skillBonus: { 'Athletics': -1 } },
  'Greedy': { effect: 'Demands higher share', moraleModifier: -5 },
  'Brave': { effect: 'Bonus in combat', moraleModifier: 15 },
  'Cowardly': { effect: 'Flees in combat', moraleModifier: -20 },
  'Strong': { effect: 'Good for heavy lifting', skillBonus: { 'Athletics': 4 } },
  'Eagle-Eyed': { effect: 'Good lookout', skillBonus: { 'Perception': 4 } }
};

export const ROLE_BASE_SKILLS: Record<CrewRole, Record<string, number>> = {
  'Captain': { 'Persuasion': 5, 'Intimidation': 5, 'Navigation': 3 },
  'FirstMate': { 'Intimidation': 5, 'Athletics': 3 },
  'Bosun': { 'Repair': 5, 'Athletics': 4 },
  'Quartermaster': { 'Investigation': 5, 'Insight': 4 },
  'Surgeon': { 'Medicine': 6, 'Nature': 3 },
  'Cook': { 'Cooking': 6, 'Survival': 2 },
  'Navigator': { 'Survival': 6, 'Nature': 4 },
  'Sailor': { 'Athletics': 2, 'Acrobatics': 2 }
};

export const ROLE_DAILY_WAGE: Record<CrewRole, number> = {
  'Captain': 10, // Usually takes a share, but base wage for system simplicity
  'FirstMate': 5,
  'Bosun': 3,
  'Quartermaster': 4,
  'Surgeon': 5,
  'Cook': 2,
  'Navigator': 4,
  'Sailor': 1
};
