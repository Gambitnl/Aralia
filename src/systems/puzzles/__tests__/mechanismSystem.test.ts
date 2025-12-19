/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/__tests__/mechanismSystem.test.ts
 * Tests for the Mechanism System.
 */

import { describe, it, expect } from 'vitest';
import { interactWithMechanism, detectMechanism } from '../mechanismSystem';
import { Mechanism, Trap } from '../types';
import { createMockPlayerCharacter } from '../../../utils/factories';

describe('Mechanism System', () => {
  const char = createMockPlayerCharacter({
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    }
  });

  const baseMechanism: Mechanism = {
    id: 'm1',
    name: 'Rusty Lever',
    description: 'A rusty iron lever.',
    type: 'lever',
    currentState: 'off',
    states: ['off', 'on'],
    isHidden: false,
    detectionDC: 10,
    isStuck: false,
    isLocked: false
  };

  it('toggles state on interaction', () => {
    const mech = { ...baseMechanism };
    const result = interactWithMechanism(char, mech, []);

    expect(result.success).toBe(true);
    expect(result.newState).toBe('on');
    expect(result.message).toContain('pull');
    expect(mech.currentState).toBe('on');

    // Toggle back
    const result2 = interactWithMechanism(char, mech, []);
    expect(result2.newState).toBe('off');
  });

  it('fails if mechanism is hidden', () => {
    const mech = { ...baseMechanism, isHidden: true };
    const result = interactWithMechanism(char, mech, []);

    expect(result.success).toBe(false);
    expect(result.message).toContain('see nothing');
  });

  it('fails if mechanism is stuck and check fails', () => {
    // High DC, low stats
    const mech = { ...baseMechanism, isStuck: true, stuckDC: 30 };
    const result = interactWithMechanism(char, mech, []);

    expect(result.success).toBe(false);
    expect(result.message).toContain('stuck');
  });

  it('triggers linked lock update', () => {
    const mech = { ...baseMechanism, linkedLockId: 'lock1' };
    const result = interactWithMechanism(char, mech, []);

    expect(result.lockUpdate).toBeDefined();
    expect(result.lockUpdate?.lockId).toBe('lock1');
    expect(result.lockUpdate?.action).toBe('unlock'); // on = unlock
  });

  it('sends puzzle signal', () => {
    const mech = { ...baseMechanism, linkedPuzzleId: 'puzzle1', puzzleSignal: 'lever_A' };
    const result = interactWithMechanism(char, mech, []);

    expect(result.puzzleUpdate).toBeDefined();
    expect(result.puzzleUpdate?.puzzleId).toBe('puzzle1');
    expect(result.puzzleUpdate?.signal).toBe('lever_A:on');
  });

  it('detects hidden mechanism with high roll', () => {
      // Mock stats to ensure success? Or simple math.
      // DC 0 ensures success
      const mech = { ...baseMechanism, isHidden: true, detectionDC: 0 };
      const result = detectMechanism(char, mech);

      expect(result.detected).toBe(true);
      expect(mech.isHidden).toBe(false);
  });
});
