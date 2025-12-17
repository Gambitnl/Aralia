/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/shipFactory.ts
 * Factory for creating fully-crewed ships with personality.
 */

import { Ship, CrewRole, CrewMember } from '../types/naval';
import { createShip } from './navalUtils';
import { SHIP_TEMPLATES } from '../data/ships';

const NAMES = [
  'Barnacle', 'Storm', 'Wave', 'Salt', 'Iron', 'Golden', 'Silver', 'Black', 'Red', 'White',
  'Mist', 'Fog', 'Gale', 'Wind', 'Tide', 'Current', 'Deep', 'Reef', 'Shark', 'Whale'
];

const SUFFIXES = [
  'Runner', 'Rider', 'Breaker', 'Hunter', 'Seeker', 'Voyager', 'Spirit', 'Ghost', 'Shadow', 'Star',
  'Moon', 'Sun', 'Dragon', 'Serpent', 'Hawk', 'Falcon', 'Wolf', 'Bear', 'Lion', 'Eagle'
];

const FIRST_NAMES = [
  'Jack', 'Anne', 'Edward', 'Mary', 'William', 'Elizabeth', 'Thomas', 'Sarah', 'James', 'Grace',
  'Henry', 'Margaret', 'Robert', 'Jane', 'Charles', 'Catherine', 'George', 'Isabella', 'Samuel', 'Rose'
];

const LAST_NAMES = [
  'Sparrow', 'Bonny', 'Teach', 'Read', 'Kidd', 'Morgan', 'Drake', 'Hawkins', 'Rogers', 'Rackham',
  'Vane', 'Bellamy', 'Low', 'Roberts', 'Davis', 'England', 'Taylor', 'Every', 'Fly', 'Lewis'
];

const TRAITS = [
  'Superstitious', 'Drunkard', 'Brave', 'Cowardly', 'Loyal', 'Greedy', 'Honest', 'Deceptive',
  'Skilled', 'Clumsy', 'Strong', 'Weak', 'Lucky', 'Cursed', 'Musical', 'Quiet', 'Loud', 'Funny'
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateShipName(): string {
  return `The ${randomElement(NAMES)} ${randomElement(SUFFIXES)}`;
}

export function generateCrewMember(role: CrewRole): CrewMember {
  return {
    id: `crew-${Math.random().toString(36).slice(2, 9)}`,
    name: `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}`,
    role,
    skills: {
      'Sailing': Math.floor(Math.random() * 5) + 1,
      'Combat': Math.floor(Math.random() * 5) + 1,
    },
    morale: Math.floor(Math.random() * 40) + 60, // 60-100 initial morale
    loyalty: Math.floor(Math.random() * 40) + 60,
    dailyWage: role === 'Captain' ? 10 : role === 'FirstMate' ? 5 : 1,
    traits: [randomElement(TRAITS)],
  };
}

export function createFullShip(type: keyof typeof SHIP_TEMPLATES, name?: string): Ship {
  const finalName = name || generateShipName();
  const ship = createShip(finalName, type);

  // Populate Crew based on size
  const template = SHIP_TEMPLATES[type];
  const idealCrewSize = Math.floor((template.baseStats.crewMin + template.baseStats.crewMax) / 2);

  const crewMembers: CrewMember[] = [];

  // Essential Roles
  crewMembers.push(generateCrewMember('Captain'));
  if (idealCrewSize > 5) crewMembers.push(generateCrewMember('FirstMate'));
  if (idealCrewSize > 10) crewMembers.push(generateCrewMember('Bosun'));
  if (idealCrewSize > 15) crewMembers.push(generateCrewMember('Navigator'));
  if (idealCrewSize > 20) crewMembers.push(generateCrewMember('Surgeon'));
  if (idealCrewSize > 25) crewMembers.push(generateCrewMember('Cook'));

  // Fill the rest with Sailors
  while (crewMembers.length < idealCrewSize) {
    crewMembers.push(generateCrewMember('Sailor'));
  }

  ship.crew.members = crewMembers;
  ship.crew.quality = 'Average';
  ship.crew.averageMorale = Math.round(crewMembers.reduce((sum, m) => sum + m.morale, 0) / crewMembers.length);

  return ship;
}
