import { describe, it, expect } from 'vitest';
import { createFullShip } from '../shipFactory';
import { resolveNavalRound, generateWeather } from '../navalUtils';
import { NavalCombatState, Ship } from '../../types/naval';

describe('Naval System', () => {
  describe('Ship Factory', () => {
    it('should create a ship with a generated name if none provided', () => {
      const ship = createFullShip('Sloop');
      expect(ship.name).toContain('The');
      expect(ship.type).toBe('Sloop');
    });

    it('should populate crew with unique names and roles', () => {
      const ship = createFullShip('Galleon'); // Needs large crew
      expect(ship.crew.members.length).toBeGreaterThan(10);

      const captain = ship.crew.members.find(m => m.role === 'Captain');
      expect(captain).toBeDefined();
      expect(captain?.name).toBeTruthy();
      expect(captain?.traits.length).toBeGreaterThan(0);
    });
  });

  describe('Naval Combat', () => {
    it('should resolve a round of combat', () => {
      const ship1 = createFullShip('Frigate', 'HMS Victory');
      const ship2 = createFullShip('Frigate', 'La Concorde');

      // Set teams
      // In our simple resolution, we just need them in the participants list with different roles
      // But the resolution logic relies on 'role' property in the participant wrapper

      const combatState: NavalCombatState = {
        id: 'combat-1',
        participants: [
          { ship: ship1, initiative: 15, role: 'player', distanceToTarget: 500 },
          { ship: ship2, initiative: 10, role: 'enemy', distanceToTarget: 500 }
        ],
        range: 'Medium',
        weather: 'Calm',
        windDirection: 'N',
        round: 1,
        log: []
      };

      const nextState = resolveNavalRound(combatState);

      expect(nextState.round).toBe(2);
      expect(nextState.log.length).toBeGreaterThan(0);

      // Check if damage was dealt or logged
      // Since it's random, we can't guarantee a hit, but we can check the log
      const logContent = nextState.log.join(' ');
      expect(logContent).toContain('Round 2');
      expect(logContent).toContain('attempts');
    });

    it('should apply weather effects', () => {
        const { condition, windDirection } = generateWeather();
        expect(['Calm', 'Breezy', 'Stormy', 'Gale', 'Foggy']).toContain(condition);
        expect(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']).toContain(windDirection);
    });
  });
});
