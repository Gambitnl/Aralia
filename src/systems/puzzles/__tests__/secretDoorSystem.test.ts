/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/__tests__/secretDoorSystem.test.ts
 * Tests for the Secret Door system logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchForSecretDoor,
  investigateMechanism,
  operateSecretDoor
} from '../secretDoorSystem';
import { SecretDoor } from '../types';
import * as combatUtils from '../../../utils/combatUtils';

// Mock the dice roller
vi.mock('../../../utils/combatUtils', () => ({
  rollDice: vi.fn()
}));
// TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
const mockCharacter: unknown = {
  id: 'char-1',
  name: 'Test Rogue',
  stats: {
    strength: 10,
    dexterity: 16,
    constitution: 14,
    intelligence: 14, // +2
    wisdom: 16, // +3
    charisma: 10
  },
  classes: [{ name: 'Rogue', level: 1 }],
  proficiencyBonus: 2,
  inventory: []
};

describe('SecretDoor System', () => {
  let mockDoor: SecretDoor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoor = {
      id: 'sd-001',
      name: 'Library Passage',
      tileId: '10-10',
      detectionDC: 15,
      mechanismDC: 12,
      mechanismDescription: 'pull the fake book',
      isLocked: false,
      state: 'hidden'
    };
  });

  describe('searchForSecretDoor', () => {
    it('detects the door on a high roll', () => {
      // Wis +3, Prof +2 = +5 bonus. DC 15. Need roll >= 10.
      vi.mocked(combatUtils.rollDice).mockReturnValue(10);

      const result = searchForSecretDoor(mockCharacter, mockDoor);

      expect(result.success).toBe(true);
      expect(result.state).toBe('detected');
      expect(mockDoor.state).toBe('detected');
      expect(result.xpAward).toBe(50);
    });

    it('fails to detect on a low roll', () => {
      // Wis +3, Prof +2 = +5 bonus. DC 15. Roll 2 -> Total 7.
      vi.mocked(combatUtils.rollDice).mockReturnValue(2);

      const result = searchForSecretDoor(mockCharacter, mockDoor);

      expect(result.success).toBe(false);
      expect(result.state).toBe('hidden');
      expect(mockDoor.state).toBe('hidden');
    });

    it('returns success immediately if already detected', () => {
      mockDoor.state = 'detected';
      const result = searchForSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('clearly see');
    });
  });

  describe('investigateMechanism', () => {
    it('succeeds on high roll', () => {
      mockDoor.state = 'detected';
      // Int +2, Prof +2 = +4. DC 12. Need roll >= 8.
      vi.mocked(combatUtils.rollDice).mockReturnValue(10);

      const result = investigateMechanism(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.message).toContain('pull the fake book');
    });

    it('fails if door is hidden', () => {
      mockDoor.state = 'hidden';
      const result = investigateMechanism(mockCharacter, mockDoor);
      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot investigate');
    });
  });

  describe('operateSecretDoor', () => {
    it('opens the door if detected and unlocked', () => {
      mockDoor.state = 'detected';
      mockDoor.isLocked = false;

      const result = operateSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.state).toBe('open');
      expect(mockDoor.state).toBe('open');
    });

    it('fails if locked', () => {
      mockDoor.state = 'detected';
      mockDoor.isLocked = true;

      const result = operateSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(false);
      expect(result.message).toContain('stuck or locked');
    });

    it('closes the door if already open', () => {
      mockDoor.state = 'open';
      const result = operateSecretDoor(mockCharacter, mockDoor);
      expect(result.success).toBe(true);
      expect(result.state).toBe('closed');
      expect(mockDoor.state).toBe('closed');
    });
  });
});
