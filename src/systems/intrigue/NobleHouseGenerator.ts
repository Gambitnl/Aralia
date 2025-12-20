/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/NobleHouseGenerator.ts
 * Generates Noble Houses with members, relationships, and secrets.
 */

import { v4 as uuidv4 } from 'uuid';
import { NobleHouse, NobleMember, NobleRole } from '../../types/noble';
import { SecretGenerator } from './SecretGenerator';
import { SeededRandom } from '../../utils/seededRandom';

const HOUSE_NAMES = [
  "Valerius", "Thorne", "Blackwood", "Hallow", "Sterling",
  "Grimm", "Vance", "Mercer", "Ashford", "Redgrave"
];

const MOTTOS = [
  "Honor Above All", "Victory through Sacrifice", "We Do Not Forget",
  "Iron and Blood", "Whispers Cut Deeper", "Always Watching",
  "Strength in Unity", "Coin Rules All", "Shadows Protect Us"
];

const COLORS = [
  "Red", "Blue", "Green", "Black", "White", "Gold", "Silver", "Purple"
];

const SYMBOLS = [
  "Lion", "Wolf", "Rose", "Sword", "Shield", "Raven", "Dragon", "Tower"
];

const FIRST_NAMES = {
  male: ["Adric", "Beric", "Cedric", "Dorian", "Edric", "Faren", "Godric"],
  female: ["Alanna", "Bess", "Catelyn", "Dana", "Elise", "Flora", "Gwen"]
};

const TRAITS = [
  "Ambitious", "Paranoid", "Hedonistic", "Honorable", "Greedy",
  "Pious", "Cruel", "Kind", "Tactical", "Reckless"
];

function generateStats(rng: SeededRandom) {
  return {
    intrigue: Math.floor(rng.next() * 10) + 1,
    warfare: Math.floor(rng.next() * 10) + 1,
    stewardship: Math.floor(rng.next() * 10) + 1,
    charm: Math.floor(rng.next() * 10) + 1
  };
}

function generateNoble(
  rng: SeededRandom,
  role: NobleRole,
  lastName: string,
  minAge: number,
  maxAge: number
): NobleMember {
  const isFemale = rng.next() > 0.5;
  const firstName = rng.pick(isFemale ? FIRST_NAMES.female : FIRST_NAMES.male);

  // 1-3 random traits
  const numTraits = Math.floor(rng.next() * 3) + 1;
  const traits: string[] = [];
  for(let i=0; i<numTraits; i++) {
    const trait = rng.pick(TRAITS);
    if (!traits.includes(trait)) traits.push(trait);
  }

  return {
    id: uuidv4(),
    firstName,
    lastName,
    role,
    age: Math.floor(rng.next() * (maxAge - minAge + 1)) + minAge,
    stats: generateStats(rng),
    traits,
    personalSecretIds: []
  };
}

export const generateNobleHouse = (kingdomId: string = 'default', seed: number = Date.now()): NobleHouse => {
  const rng = new SeededRandom(seed);
  const secretGen = new SecretGenerator(seed);

  const houseName = rng.pick(HOUSE_NAMES);
  const houseId = `house_${houseName.toLowerCase()}_${uuidv4().substring(0, 4)}`;

  // 1. Generate Members
  const head = generateNoble(rng, 'head', houseName, 40, 70);
  const spouse = generateNoble(rng, 'spouse', houseName, 35, 65);

  const numChildren = Math.floor(rng.next() * 4); // 0-3 children
  const children: NobleMember[] = [];

  for (let i = 0; i < numChildren; i++) {
    const role = i === 0 ? 'heir' : 'scion';
    children.push(generateNoble(rng, role, houseName, 16, 35));
  }

  // Chance for a bastard
  const hasBastard = rng.next() > 0.8;
  if (hasBastard) {
    children.push(generateNoble(rng, 'bastard', "Snow", 15, 30));
  }

  const members = [head, spouse, ...children];

  // 2. Generate Secrets
  const houseSecrets = [];

  // 50% chance the House itself has a major secret
  if (rng.next() > 0.5) {
    const mockFaction = {
        id: houseId,
        name: `House ${houseName}`,
        description: '',
        type: 'political' as const,
        relationships: {},
        playerStanding: 0,
        goals: [],
        enemies: [],
        allies: []
    };

    const secret = secretGen.generateFactionSecret(mockFaction, []);
    secret.tags.push('political');
    houseSecrets.push(secret);
  }

  // Each member has a 30% chance of a personal secret
  members.forEach(member => {
    if (rng.next() > 0.7) {
      const secret = secretGen.generateMemberSecret(member.id, `${member.firstName} ${member.lastName}`);
      member.personalSecretIds.push(secret.id);
      houseSecrets.push(secret);
    }
  });

  return {
    id: houseId,
    name: `House ${houseName}`,
    description: `The noble house of ${houseName}.`,
    type: 'political',
    houseName,
    motto: rng.pick(MOTTOS),
    heraldry: {
      colors: [rng.pick(COLORS), rng.pick(COLORS)],
      symbol: rng.pick(SYMBOLS)
    },
    wealth: Math.floor(rng.next() * 10) + 1,
    militaryPower: Math.floor(rng.next() * 10) + 1,
    politicalInfluence: Math.floor(rng.next() * 10) + 1,
    members,
    heldSecrets: [],
    houseSecrets,
    relationships: {},
    playerStanding: 0,
    goals: ['Increase wealth', 'Expand lands'],
    enemies: [],
    allies: []
  };
};
