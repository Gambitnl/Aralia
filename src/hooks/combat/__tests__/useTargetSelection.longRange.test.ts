/**
 * GG-495 (2026-11-01): the Attack Range overlay marks the long-range band, the
 * valid target tiles where a ranged or thrown attack rolls with Disadvantage.
 *
 * The band comes from computeLongRangeTargetSet, which measures with the same
 * helpers as the rules (creature to creature on an occupied tile, creature to
 * tile otherwise). These tests pin the band edges for a thrown spear (20/60 ft)
 * and check that an ability with no long range never shades a band.
 *
 * Exercises: src/hooks/combat/useTargetSelection.ts (computeLongRangeTargetSet)
 */
import { describe, expect, it } from 'vitest';
import { computeLongRangeTargetSet } from '../useTargetSelection';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import type { Ability, BattleMapData, BattleMapTile } from '../../../types/combat';

function flatRow(width: number): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x++) {
    tiles.set(`${x}-0`, {
      id: `${x}-0`, coordinates: { x, y: 0 }, terrain: 'floor', movementCost: 1,
      blocksMovement: false, blocksLoS: false, elevation: 0, decoration: null, effects: [],
    });
  }
  return { dimensions: { width, height: 1 }, tiles, theme: 'dungeon', seed: 1 };
}

const thrownSpear = {
  id: 'attack_main_thrown', name: 'Throw Spear', description: 'Throw Spear.', type: 'attack',
  cost: { type: 'action' }, targeting: 'single_enemy', range: 4, longRange: 12, effects: [],
} as unknown as Ability;

describe('computeLongRangeTargetSet (GG-495)', () => {
  const map = flatRow(16);
  const caster = createMockCombatCharacter({ id: 'monk', team: 'player', position: { x: 0, y: 0 } });
  const valid = new Set(Array.from({ length: 12 }, (_, index) => `${index + 1}-0`));

  it('shades only the tiles past 20 ft and within 60 ft', () => {
    const band = computeLongRangeTargetSet(thrownSpear, caster, valid, [caster], map);
    expect([...band].sort((a, b) => parseInt(a) - parseInt(b))).toEqual(
      ['5-0', '6-0', '7-0', '8-0', '9-0', '10-0', '11-0', '12-0'],
    );
    expect(band.has('4-0')).toBe(false);
  });

  it('measures an occupied tile creature to creature, as the attack roll does', () => {
    const orc = createMockCombatCharacter({ id: 'orc', team: 'enemy', position: { x: 4, y: 0 } });
    const goblin = createMockCombatCharacter({ id: 'goblin', team: 'enemy', position: { x: 6, y: 0 } });
    const band = computeLongRangeTargetSet(thrownSpear, caster, valid, [caster, orc, goblin], map);
    expect(band.has('4-0')).toBe(false);
    expect(band.has('6-0')).toBe(true);
  });

  it('shades nothing for an ability with no long range', () => {
    const fireBolt = { ...thrownSpear, id: 'fire_bolt', range: 24, longRange: undefined } as Ability;
    expect(computeLongRangeTargetSet(fireBolt, caster, valid, [caster], map).size).toBe(0);
  });
});
