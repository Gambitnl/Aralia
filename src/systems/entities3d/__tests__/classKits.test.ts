/**
 * @file classKits.test.ts — every class in the game has a visual gear kit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { CLASSES_DATA } from '../../../data/classes';
import { kitForClass } from '../classKits';
import { registerAllParts } from '../parts';
import { getPart } from '../registry';

const HEX = /^#[0-9a-f]{6}$/i;

describe('entities3d class kits', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('covers every class id in CLASSES_DATA', () => {
    const ids = Object.keys(CLASSES_DATA);
    expect(ids.length).toBeGreaterThanOrEqual(13);
    for (const classId of ids) {
      const kit = kitForClass(classId);
      expect(kit.gear.length, `class "${classId}" kit is empty`).toBeGreaterThan(0);
      expect(kit.accentHex).toMatch(HEX);
      expect(kit.secondaryHex).toMatch(HEX);
    }
  });

  it('references only registered parts', () => {
    for (const classId of Object.keys(CLASSES_DATA)) {
      for (const g of kitForClass(classId).gear) {
        expect(() => getPart(g.partId), `class "${classId}" references missing part "${g.partId}"`).not.toThrow();
      }
    }
  });

  it('every kit holds something in the main hand', () => {
    for (const classId of Object.keys(CLASSES_DATA)) {
      const kit = kitForClass(classId);
      expect(
        kit.gear.some((g) => g.anchor === 'handR' || g.anchor === 'handL'),
        `class "${classId}" has empty hands`,
      ).toBe(true);
    }
  });

  it('gives signature gear to signature classes', () => {
    expect(kitForClass('wizard').gear.some((g) => g.partId === 'hatWide')).toBe(true);
    expect(kitForClass('wizard').gear.some((g) => g.partId === 'staffMain')).toBe(true);
    expect(kitForClass('fighter').gear.some((g) => g.partId === 'swordMain')).toBe(true);
    expect(kitForClass('fighter').gear.some((g) => g.partId === 'shieldOff')).toBe(true);
    expect(kitForClass('ranger').gear.some((g) => g.partId === 'bowMain')).toBe(true);
    expect(kitForClass('ranger').gear.some((g) => g.partId === 'quiverBack')).toBe(true);
    expect(kitForClass('bard').gear.some((g) => g.partId === 'luteBack')).toBe(true);
    expect(kitForClass('rogue').gear.some((g) => g.partId === 'hoodUp')).toBe(true);
  });

  it('throws on an unknown class id — no fallback', () => {
    expect(() => kitForClass('blood_hunter')).toThrow(/blood_hunter/);
  });
});
