/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/__tests__/CrewManager.test.ts
 * Tests for the CrewManager system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrewManager } from '../CrewManager';
import { Ship, CrewRole } from '../../../types/naval';

// Mock Ship Factory
const createMockShip = (): Ship => ({
  id: 'ship-1',
  name: 'The Rusty Tub',
  type: 'Sloop',
  size: 'Medium',
  description: 'A test ship',
  stats: {
    speed: 30,
    maneuverability: 5,
    hullPoints: 100,
    maxHullPoints: 100,
    armorClass: 12,
    cargoCapacity: 20,
    crewMin: 2,
    crewMax: 10
  },
  crew: {
    members: [],
    averageMorale: 50,
    unrest: 0,
    quality: 'Average'
  },
  cargo: { items: [], totalWeight: 0, capacityUsed: 0 },
  modifications: [],
  weapons: [],
  flags: {}
});

describe('CrewManager', () => {
  it('should generate a crew member with valid properties', () => {
    const member = CrewManager.generateCrewMember('Sailor', 1);

    expect(member.id).toBeDefined();
    expect(member.name).toBeTruthy();
    expect(member.role).toBe('Sailor');
    expect(member.skills).toBeDefined();
    expect(member.morale).toBeGreaterThanOrEqual(0);
    expect(member.morale).toBeLessThanOrEqual(100);
    expect(member.loyalty).toBeGreaterThanOrEqual(0);
    expect(member.loyalty).toBeLessThanOrEqual(100);
    expect(member.dailyWage).toBeGreaterThan(0);
    expect(member.traits.length).toBeGreaterThan(0);
  });

  it('should calculate crew stats correctly', () => {
    let ship = createMockShip();
    ship = CrewManager.recruitCrew(ship, 'Captain', 5);
    ship = CrewManager.recruitCrew(ship, 'Sailor', 1);

    const stats = CrewManager.calculateCrewStats(ship.crew.members);

    expect(stats.members.length).toBe(2);
    expect(stats.averageMorale).toBeGreaterThan(0);

    // Check unrest calculation logic (approximate check as formula is complex)
    // Unrest depends on morale and loyalty
    expect(stats.unrest).toBeGreaterThanOrEqual(0);
    expect(stats.unrest).toBeLessThanOrEqual(100);
  });

  it('should process daily wages correctly', () => {
    let ship = createMockShip();
    ship = CrewManager.recruitCrew(ship, 'Sailor', 1);

    const initialWage = ship.crew.members[0].dailyWage;
    const initialLoyalty = ship.crew.members[0].loyalty;
    const funds = 100;

    const result = CrewManager.processDailyCrewUpdate(ship, funds);

    expect(result.remainingFunds).toBe(funds - initialWage);
    expect(result.logs[0]).toContain('Paid');
    expect(result.mutinyTriggered).toBe(false);

    // Verify loyalty increased
    expect(result.ship.crew.members[0].loyalty).toBeGreaterThan(initialLoyalty);
  });

  it('should trigger unrest when wages are unpaid', () => {
    let ship = createMockShip();
    ship = CrewManager.recruitCrew(ship, 'Captain', 10);
    const initialLoyalty = ship.crew.members[0].loyalty;

    const funds = 0; // Broke

    const result = CrewManager.processDailyCrewUpdate(ship, funds);

    expect(result.remainingFunds).toBe(0);
    expect(result.logs.some(l => l.includes('Insufficient funds'))).toBe(true);
    expect(result.ship.crew.unrest).toBeGreaterThan(0);

    // Verify loyalty decreased
    expect(result.ship.crew.members[0].loyalty).toBeLessThan(initialLoyalty);
  });

  it('should modify morale based on traits', () => {
    const member = CrewManager.generateCrewMember('Sailor');
    member.traits = ['Loyal']; // Takes half morale damage
    member.morale = 50;

    const crew = {
        members: [member],
        averageMorale: 50,
        unrest: 0,
        quality: 'Average' as const
    };

    CrewManager.modifyCrewMorale(crew, -10, 'Bad food');

    // Expected: 50 - (10 * 0.5) = 45
    expect(member.morale).toBe(45);
  });
});
