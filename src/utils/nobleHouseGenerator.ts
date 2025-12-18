/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/nobleHouseGenerator.ts
 * Procedural generation for Noble Houses, including names, mottos, and relationships.
 */

import { Faction, FactionRank } from '../types/factions';
import { SeededRandom } from './seededRandom';

// -----------------------------------------------------------------------------
// Data Tables
// -----------------------------------------------------------------------------

const HOUSE_NAME_PREFIXES = [
  'Black', 'Iron', 'Gold', 'Silver', 'Red', 'Green', 'Blue', 'White',
  'Storm', 'Winter', 'Summer', 'Night', 'Day', 'Sun', 'Moon', 'Star',
  'Lion', 'Wolf', 'Bear', 'Stag', 'Dragon', 'Serpent', 'Hawk', 'Crow',
  'High', 'Low', 'Deep', 'Dark', 'Light', 'Bright', 'Swift', 'Strong',
  'Old', 'New', 'Grand', 'Fair', 'Cold', 'Warm', 'Hard', 'Soft'
];

const HOUSE_NAME_SUFFIXES = [
  'wood', 'guard', 'ford', 'field', 'stone', 'water', 'hall', 'keep',
  'tower', 'bridge', 'gate', 'watch', 'rock', 'cliff', 'dale', 'vale',
  'hill', 'mountain', 'river', 'sea', 'lake', 'pool', 'garden', 'forest',
  'grove', 'mead', 'star', 'sun', 'moon', 'flame', 'sword', 'shield'
];

const SURNAMES = [
  'Vane', 'Xorlarrin', 'Stark', 'Lannister', 'Baratheon', 'Tyrell', 'Martell',
  'Tully', 'Arryn', 'Greyjoy', 'Targaryen', 'Hightower', 'Dayne', 'Blackwood',
  'Bracken', 'Redwyne', 'Tarly', 'Florent', 'Rowan', 'Oakheart', 'Swann',
  'Caron', 'Dondarrion', 'Selmy', 'Tarth', 'Estermont', 'Seaworth', 'Velaryon',
  'Celtigar', 'Sunglass', 'Bar Emmon', 'Massey', 'Ryne', 'Corbray', 'Hunter',
  'Royce', 'Waynwood', 'Redfort', 'Belmore', 'Templeton', 'Manderly', 'Glover',
  'Tallhart', 'Mormont', 'Karstark', 'Umber', 'Bolton', 'Dustin', 'Ryswell'
];

const MOTTOS_PART_1 = [
  'Winter', 'Summer', 'Family', 'Honor', 'Duty', 'Strength', 'Courage', 'Wisdom',
  'Justice', 'Truth', 'Faith', 'Hope', 'Love', 'Peace', 'War', 'Victory',
  'Death', 'Life', 'Blood', 'Fire', 'Ice', 'Stone', 'Iron', 'Steel', 'Gold'
];

const MOTTOS_PART_2 = [
  'is Coming', 'is Here', 'Above All', 'Before All', 'Forever', 'Eternal',
  'Never Dies', 'Never Fails', 'Prevails', 'Endures', 'Remembers', 'Forgets',
  'Waits', 'Awakens', 'Rises', 'Falls', 'Burns', 'Freezes', 'Breaks', 'Bends'
];

const MOTTOS_FULL = [
  'Winter is Coming', 'Hear Me Roar', 'Ours is the Fury', 'Growing Strong',
  'Unbowed, Unbent, Unbroken', 'Family, Duty, Honor', 'As High as Honor',
  'We Do Not Sow', 'Fire and Blood', 'We Light the Way', 'The Sun of Winter',
  'Iron from Ice', 'Though All Men Do Despise Us', 'Righteous in Wrath',
  'Our Blades are Sharp', 'Ever Vigilant', 'None so Loyal', 'True to the End'
];

const COLORS = [
  '#DC2626', // Red
  '#FCD34D', // Gold
  '#6D28D9', // Violet
  '#000000', // Black
  '#FFFFFF', // White
  '#2563EB', // Blue
  '#059669', // Green
  '#D97706', // Amber
  '#4B5563', // Grey
  '#7C3AED', // Purple
  '#DB2777', // Pink
  '#EA580C', // Orange
  '#0891B2', // Cyan
  '#78350F'  // Brown
];

const VALUES = [
  'honor', 'strength', 'tradition', 'wealth', 'piety', 'knowledge',
  'loyalty', 'courage', 'justice', 'freedom', 'ambition', 'power',
  'family', 'purity', 'order', 'chaos', 'nature', 'technology'
];

const HATES = [
  'cowardice', 'treachery', 'weakness', 'poverty', 'heresy', 'ignorance',
  'disloyalty', 'fear', 'injustice', 'tyranny', 'laziness', 'submission',
  'betrayal', 'corruption', 'chaos', 'order', 'industry', 'magic'
];

// -----------------------------------------------------------------------------
// Generator Logic
// -----------------------------------------------------------------------------

export interface NobleHouseGenerationOptions {
  seed: number;
  region?: string;
  isAncient?: boolean;
}

const DEFAULT_RANKS: FactionRank[] = [
  {
    id: 'commoner',
    name: 'Retainer',
    level: 1,
    description: 'A servant or soldier sworn to the house.',
    perks: ['protection', 'lodging']
  },
  {
    id: 'knight',
    name: 'Household Knight',
    level: 2,
    description: 'A sworn sword of the house.',
    perks: ['command_soldiers', 'better_lodging']
  },
  {
    id: 'scion',
    name: 'Scion',
    level: 3,
    description: 'A blood relative of the ruling family.',
    perks: ['political_immunity', 'family_funds']
  }
];

export function generateNobleHouseName(rng: SeededRandom): string {
  // 30% chance of compound name (e.g. Blackwood), 70% chance of existing surname
  if (rng.next() < 0.3) {
    const prefix = rng.pick(HOUSE_NAME_PREFIXES);
    const suffix = rng.pick(HOUSE_NAME_SUFFIXES);
    return `House ${prefix}${suffix}`;
  } else {
    return `House ${rng.pick(SURNAMES)}`;
  }
}

export function generateMotto(rng: SeededRandom): string {
  if (rng.next() < 0.4) {
    return rng.pick(MOTTOS_FULL);
  }
  const part1 = rng.pick(MOTTOS_PART_1);
  const part2 = rng.pick(MOTTOS_PART_2);
  return `${part1} ${part2}`;
}

export function generateColors(rng: SeededRandom): { primary: string, secondary: string } {
  const primary = rng.pick(COLORS);
  let secondary = rng.pick(COLORS);
  while (secondary === primary) {
    secondary = rng.pick(COLORS);
  }
  return { primary, secondary };
}

export function generateNobleHouse(options: NobleHouseGenerationOptions): Faction {
  const rng = new SeededRandom(options.seed);

  const name = generateNobleHouseName(rng);
  const motto = generateMotto(rng);
  const colors = generateColors(rng);

  const numValues = Math.floor(rng.next() * 2) + 2; // 2-3 values
  const values = new Set<string>();
  while (values.size < numValues) {
    values.add(rng.pick(VALUES));
  }

  const numHates = Math.floor(rng.next() * 2) + 1; // 1-2 hates
  const hates = new Set<string>();
  while (hates.size < numHates) {
    const hate = rng.pick(HATES);
    if (!values.has(hate)) { // Don't hate what you value
        hates.add(hate);
    }
  }

  const age = options.isAncient ? 'ancient' : rng.next() > 0.7 ? 'old' : 'new';
  const wealth = rng.next() > 0.8 ? 'vastly wealthy' : rng.next() > 0.4 ? 'wealthy' : 'struggling';

  const description = `A ${age} noble house, known to be ${wealth}. Their motto is "${motto}".`;

  return {
    id: `generated_house_${rng.nextInt(10000, 99999)}`,
    name,
    description,
    type: 'NOBLE_HOUSE',
    motto,
    colors,
    ranks: DEFAULT_RANKS,
    allies: [],
    enemies: [],
    rivals: [],
    values: Array.from(values),
    hates: Array.from(hates),
    services: ['patronage', 'political_favor']
  };
}

/**
 * Generates a set of noble houses with relationships between them.
 */
export function generateRegionalPolitics(
  seed: number,
  numHouses: number
): Faction[] {
  const rng = new SeededRandom(seed);
  const houses: Faction[] = [];

  // Generate houses
  for (let i = 0; i < numHouses; i++) {
    houses.push(generateNobleHouse({ seed: seed + i }));
  }

  // Assign relationships
  // Each house has 1-2 connections (ally/enemy/rival)
  houses.forEach((house, index) => {
    const otherHouses = houses.filter((_, i) => i !== index);
    if (otherHouses.length === 0) return;

    const numConnections = Math.floor(rng.next() * 2) + 1;

    for (let i = 0; i < numConnections; i++) {
        const target = rng.pick(otherHouses);
        const relType = rng.next();

        if (relType < 0.3) {
            // Ally
            if (!house.allies.includes(target.id) && !house.enemies.includes(target.id) && !house.rivals.includes(target.id)) {
                house.allies.push(target.id);
                target.allies.push(house.id); // Reciprocal
            }
        } else if (relType < 0.6) {
            // Enemy
            if (!house.allies.includes(target.id) && !house.enemies.includes(target.id) && !house.rivals.includes(target.id)) {
                house.enemies.push(target.id);
                target.enemies.push(house.id); // Reciprocal
            }
        } else {
             // Rival
             if (!house.allies.includes(target.id) && !house.enemies.includes(target.id) && !house.rivals.includes(target.id)) {
                house.rivals.push(target.id);
                target.rivals.push(house.id); // Reciprocal
            }
        }
    }
  });

  return houses;
}
