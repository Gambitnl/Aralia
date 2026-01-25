/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/NobleHouseGenerator.ts
 * Generates Noble Houses with members, relationships, and secrets.
 */

import { v4 as uuidv4 } from 'uuid';
import { NobleHouse, NobleMember, NobleRole } from '../../types/noble';
import { Faction } from '../../types/factions';
import { SecretGenerator } from './SecretGenerator';
import { SeededRandom } from '@/utils/random';

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
// TODO(lint-intent): 'kingdomId' is an unused parameter, which suggests a planned input for this flow.
// TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
// TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
export const generateNobleHouse = (_kingdomId: string = 'default', seed: number = Date.now()): NobleHouse => {
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
    const mockFaction: Faction = {
        id: houseId,
        name: `House ${houseName}`,
        description: `The noble house of ${houseName}.`,
        type: 'NOBLE_HOUSE',
        colors: { primary: rng.pick(COLORS), secondary: rng.pick(COLORS) },
        ranks: [],
        allies: [],
        enemies: [],
        rivals: [],
        relationships: {},
        values: [],
        hates: [],
        power: Math.floor(rng.next() * 100),
        assets: []
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

  const wealth = Math.floor(rng.next() * 10) + 1;
  const militaryPower = Math.floor(rng.next() * 10) + 1;
  const politicalInfluence = Math.floor(rng.next() * 10) + 1;
  const power = Math.min(100, Math.floor(((wealth + militaryPower + politicalInfluence) / 3) * 10));

  return {
    id: houseId,
    name: `House ${houseName}`,
    description: `The noble house of ${houseName}.`,
    type: 'NOBLE_HOUSE',
    familyName: houseName,
    motto: rng.pick(MOTTOS),
    // TODO(2026-01-03 pass 4 Codex-CLI): Heraldry collapsed into colors/symbolIcon; reintroduce once NobleHouse formalizes heraldry metadata.
    colors: { primary: rng.pick(COLORS), secondary: rng.pick(COLORS) },
    symbolIcon: rng.pick(SYMBOLS),
    // TODO(2026-01-03 pass 4 Codex-CLI): Was missing required NobleHouse fields; add minimal placeholders until generator is unified.
    heraldry: {
      fieldColor: rng.pick(COLORS),
      chargeColor: rng.pick(COLORS),
      sigil: 'lion',
      pattern: 'solid'
    },
    seat: `${houseName} Keep`,
    origin: `Founded by ${houseName} ancestors.`,
    specialty: 'Political influence',
    ranks: [],
    allies: [],
    enemies: [],
    rivals: [],
    relationships: {},
    values: [],
    hates: [],
    power,
    assets: [],
    wealth,
    militaryPower,
    politicalInfluence,
    members,
    heldSecrets: [],
    houseSecrets
  };
};
