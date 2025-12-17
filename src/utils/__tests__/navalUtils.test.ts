
import { describe, it, expect } from 'vitest';
import { createShip, calculateShipStats, addCrewMember, calculateTravelTime, checkMutinyRisk, installModification } from '../navalUtils';
import { CrewMember } from '../../types/naval';
import { SHIP_MODIFICATIONS } from '../../data/shipModifications';

describe('Naval Utils', () => {
  it('should create a ship with correct base stats', () => {
    const ship = createShip('The Black Pearl', 'Sloop');
    expect(ship.name).toBe('The Black Pearl');
    expect(ship.type).toBe('Sloop');
    expect(ship.stats.speed).toBe(60);
    expect(ship.stats.crewMin).toBe(4);
  });

  it('should calculate stats with crew penalties', () => {
    let ship = createShip('Lonely Boat', 'Sloop');
    // Sloop min crew is 4. Let's add 0 crew members (default).
    // Speed should be 0 or penalized heavily? Logic says speed * (0/4) = 0
    let stats = calculateShipStats(ship);
    expect(stats.speed).toBe(0);

    // Add 1 crew member (25% capacity)
    const sailor: CrewMember = {
      id: '1', name: 'Jack', role: 'Sailor', skills: {}, morale: 50, loyalty: 50, dailyWage: 1, traits: []
    };
    ship = addCrewMember(ship, sailor);
    stats = calculateShipStats(ship);

    // 60 * (1/4) = 15
    expect(stats.speed).toBe(15);
  });

  it('should calculate stats with high morale bonus', () => {
    let ship = createShip('Happy Boat', 'Sloop');
    // Add full crew with high morale
    for (let i = 0; i < 4; i++) {
      ship = addCrewMember(ship, {
        id: `${i}`, name: `Sailor ${i}`, role: 'Sailor', skills: {}, morale: 90, loyalty: 90, dailyWage: 1, traits: []
      });
    }

    const stats = calculateShipStats(ship);
    // Base 60 * 1.1 = 66
    expect(stats.speed).toBeCloseTo(66);
    // Maneuverability base 6 + 1 = 7
    expect(stats.maneuverability).toBe(7);
  });

  it('should calculate travel time correctly', () => {
    let ship = createShip('Fast Boat', 'Sloop'); // Speed 60 = 6 mph
    // Add min crew to avoid penalty
    for (let i = 0; i < 4; i++) {
      ship = addCrewMember(ship, {
        id: `${i}`, name: `Sailor ${i}`, role: 'Sailor', skills: {}, morale: 50, loyalty: 50, dailyWage: 1, traits: []
      });
    }

    // Distance 60 miles, Speed 6 mph -> 10 hours
    const time = calculateTravelTime(ship, 60);
    expect(time).toBeCloseTo(10);

    // With wind factor 0.5 -> 3 mph -> 20 hours
    const slowTime = calculateTravelTime(ship, 60, 0.5);
    expect(slowTime).toBeCloseTo(20);
  });

  it('should detect mutiny risk', () => {
    let ship = createShip('Mutinous Boat', 'Sloop');
    ship.crew.unrest = 80;
    ship.crew.averageMorale = 20;
    expect(checkMutinyRisk(ship)).toBe(true);

    ship.crew.unrest = 20;
    ship.crew.averageMorale = 20;
    expect(checkMutinyRisk(ship)).toBe(false);
  });

  // NEW TESTS FOR MODIFICATIONS
  describe('Ship Modifications', () => {
    it('should install a modification correctly', () => {
      let ship = createShip('Test Sloop', 'Sloop');
      const mod = SHIP_MODIFICATIONS.REINFORCED_HULL;

      const result = installModification(ship, mod);
      expect(result.success).toBe(true);
      expect(result.ship).toBeDefined();
      expect(result.ship!.modifications).toHaveLength(1);
      expect(result.ship!.modifications[0].id).toBe(mod.id);
    });

    it('should correctly apply additive modifiers (Reinforced Hull)', () => {
      let ship = createShip('Tanky Sloop', 'Sloop');
      // Base: AC 13, HP 150, Speed 60
      const mod = SHIP_MODIFICATIONS.REINFORCED_HULL;
      const result = installModification(ship, mod);
      let moddedShip = result.ship!;

      // Add crew properly to ensure morale is set correctly (default createShip is 100, we want neutral 50)
      moddedShip.crew.averageMorale = 50;
      // Also ensure we have enough crew to avoid penalty
      for (let i = 0; i < 4; i++) {
         moddedShip.crew.members.push({ id: `${i}`, name: 'x', role: 'Sailor', skills: {}, morale: 50, loyalty: 50, dailyWage: 1, traits: [] });
      }

      const stats = calculateShipStats(moddedShip);

      // HP + 50 = 200
      expect(stats.maxHullPoints).toBe(200);
      // AC + 2 = 15
      expect(stats.armorClass).toBe(15);
      // Base Speed 60 - 5 = 55
      expect(stats.speed).toBe(55);
    });

    it('should correctly apply multiplicative modifiers (Silk Sails)', () => {
        let ship = createShip('Fast Sloop', 'Sloop');
        const mod = SHIP_MODIFICATIONS.SILK_SAILS;
        const result = installModification(ship, mod);
        let moddedShip = result.ship!;

        // Add crew and set neutral morale
        moddedShip.crew.averageMorale = 50;
        for (let i = 0; i < 4; i++) {
          moddedShip.crew.members.push({ id: `${i}`, name: 'x', role: 'Sailor', skills: {}, morale: 50, loyalty: 50, dailyWage: 1, traits: [] });
        }

        const stats = calculateShipStats(moddedShip);
        // Base Speed 60 * 1.1 = 66
        expect(stats.speed).toBeCloseTo(66);
    });

    it('should prevent installing the same modification twice', () => {
        let ship = createShip('Double Sloop', 'Sloop');
        const mod = SHIP_MODIFICATIONS.REINFORCED_HULL;

        const result1 = installModification(ship, mod);
        expect(result1.success).toBe(true);

        const result2 = installModification(result1.ship!, mod);
        expect(result2.success).toBe(false);
        expect(result2.reason).toContain('already installed');
    });

    it('should enforce size requirements (Extended Hold)', () => {
        let tinyShip = createShip('Tiny Boat', 'Rowboat'); // Size: Small
        const mod = SHIP_MODIFICATIONS.EXTENDED_HOLD; // Requires Large+

        const result = installModification(tinyShip, mod);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('not supported');

        let bigShip = createShip('Big Boat', 'SailingShip'); // Size: Huge
        const result2 = installModification(bigShip, mod);
        expect(result2.success).toBe(true);
    });
  });
});
