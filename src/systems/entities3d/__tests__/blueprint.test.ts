/**
 * @file blueprint.test.ts — the generator's core guarantees:
 * determinism, full race × class coverage, stream independence,
 * creature resolution, and real-gear mapping.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ALL_RACES_DATA, ACTIVE_RACES } from '../../../data/races';
import { CLASSES_DATA } from '../../../data/classes';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { recipeFromCharacter } from '../recipeFromCharacter';
import { registerAllParts } from '../parts';
import { getPart } from '../registry';
import type { PlayerCharacter } from '../../../types/character';

describe('entities3d blueprint generator', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('is deterministic: same recipe, deep-equal blueprint', () => {
    const recipe = { kind: 'humanoid', raceId: 'hill_dwarf', classId: 'wizard', seed: 'proof-1' } as const;
    expect(generateEntityBlueprint(recipe)).toEqual(generateEntityBlueprint(recipe));
  });

  it('keeps streams independent: class choice never shifts body or skin', () => {
    const a = generateEntityBlueprint({ kind: 'humanoid', raceId: 'wood_elf', classId: 'wizard', seed: 's7' });
    const b = generateEntityBlueprint({ kind: 'humanoid', raceId: 'wood_elf', classId: 'barbarian', seed: 's7' });
    expect(a.frame).toEqual(b.frame);
    expect(a.palette.skinHex).toEqual(b.palette.skinHex);
    expect(a.parts).not.toEqual(b.parts); // gear differs
  });

  it('covers EVERY selectable race × EVERY class with resolvable parts', () => {
    const classIds = Object.keys(CLASSES_DATA);
    let combos = 0;
    for (const race of ACTIVE_RACES) {
      for (const classId of classIds) {
        const bp = generateEntityBlueprint({
          kind: 'humanoid',
          raceId: race.id,
          classId,
          seed: `cov:${race.id}:${classId}`,
        });
        expect(bp.frame.heightFt).toBeGreaterThan(1);
        expect(bp.frame.heightFt).toBeLessThan(30);
        for (const part of bp.parts) {
          expect(
            () => getPart(part.partId),
            `${race.id} × ${classId} references missing part "${part.partId}"`,
          ).not.toThrow();
        }
        combos += 1;
      }
    }
    expect(combos).toBeGreaterThanOrEqual(100 * 13);
  });

  it('labels blueprints with race and class names', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'hill_dwarf', classId: 'wizard', seed: 'x' });
    expect(bp.label).toBe(`${ALL_RACES_DATA['hill_dwarf'].name} ${CLASSES_DATA['wizard'].name}`);
  });

  it('resolves creatures through the type table', () => {
    const bp = generateEntityBlueprint({ kind: 'creature', creatureType: 'Beast', size: 'Large', seed: 'wolf-1', cues: ['wolf'] });
    expect(bp.gait).toBe('quad');
    expect(bp.label).toBe('Large Beast');
    const spider = generateEntityBlueprint({ kind: 'creature', creatureType: 'Monstrosity', size: 'Medium', seed: 'sp', cues: ['spider'] });
    expect(spider.gait).toBe('hexapod');
  });

  it('creature frames still vary by seed but stay near the size band', () => {
    const a = generateEntityBlueprint({ kind: 'creature', creatureType: 'Giant', size: 'Huge', seed: 'g1' });
    const b = generateEntityBlueprint({ kind: 'creature', creatureType: 'Giant', size: 'Huge', seed: 'g2' });
    expect(a.frame.heightFt).not.toEqual(b.frame.heightFt);
    for (const bp of [a, b]) {
      expect(bp.frame.heightFt).toBeGreaterThan(13);
      expect(bp.frame.heightFt).toBeLessThan(20);
    }
  });

  it('maps a real character sheet: plate-and-shield fighter renders the gear they wear', () => {
    const pc = {
      id: 'pc1',
      name: 'Test Fighter',
      race: ALL_RACES_DATA['human'],
      class: CLASSES_DATA['fighter'],
      equippedItems: {
        MainHand: { id: 'battleaxe', name: 'Battleaxe', type: 'weapon', category: 'Martial Melee' },
        OffHand: { id: 'shield_std', name: 'Shield', type: 'armor', armorCategory: 'Shield' },
        Torso: { id: 'plate_armor', name: 'Plate Armor', type: 'armor', armorCategory: 'Heavy' },
      },
    } as unknown as PlayerCharacter;
    const recipe = recipeFromCharacter(pc);
    expect(recipe.kind).toBe('humanoid');
    if (recipe.kind !== 'humanoid') return;
    expect(recipe.gearOverride).toBeTruthy();
    const ids = recipe.gearOverride!.map((g) => g.partId);
    expect(ids).toContain('axeMain');
    expect(ids).toContain('shieldOff');
    expect(ids).toContain('pauldrons');
    expect(ids).toContain('helmet');
    const bp = generateEntityBlueprint(recipe);
    expect(bp.parts.some((p) => p.partId === 'axeMain')).toBe(true);
  });
});
