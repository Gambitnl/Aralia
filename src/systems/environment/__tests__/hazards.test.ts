
import { describe, it, expect } from 'vitest';
import { evaluateHazard, NATURAL_HAZARDS } from '../hazards';
import { createMockCombatCharacter } from '../../../utils/factories';

describe('HazardSystem', () => {
  it('should correctly identify hazard triggers', () => {
    const char = createMockCombatCharacter({ name: 'Test Dummy' });
    const lava = NATURAL_HAZARDS.lava;

    // Lava triggers on 'enter'
    const resultEnter = evaluateHazard(lava, char, 'enter');
    expect(resultEnter.triggered).toBe(true);
    expect(resultEnter.damage?.type).toBe('fire');
    expect(resultEnter.damage?.dice).toBe('6d10');

    // Lava logic here assumes 'enter' for the test, but check other trigger types
    const resultEnd = evaluateHazard(lava, char, 'end_turn');
    expect(resultEnd.triggered).toBe(false);
  });

  it('should handle status effect hazards', () => {
    const char = createMockCombatCharacter({ name: 'Slider' });
    const ice = NATURAL_HAZARDS.slippery_ice;

    const result = evaluateHazard(ice, char, 'enter');
    expect(result.triggered).toBe(true);
    expect(result.statusEffect).toBeDefined();
    expect(result.statusEffect?.name).toBe('Prone');
    expect(result.statusEffect?.saveType).toBe('dex');
  });

  it('should handle razorvine damage', () => {
    const char = createMockCombatCharacter({ name: 'Cutter' });
    const vine = NATURAL_HAZARDS.razorvine;

    const result = evaluateHazard(vine, char, 'enter');
    expect(result.triggered).toBe(true);
    expect(result.damage).toBeDefined();
    expect(result.damage?.dice).toBe('1d10');
    expect(result.damage?.type).toBe('slashing');
  });
});
