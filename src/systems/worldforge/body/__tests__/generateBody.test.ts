/**
 * @file generateBody.test.ts — Tests for parametric body generator.
 */

import { describe, it, expect } from 'vitest';
import { generateBody } from '../generateBody';
import type { Occupant, AgeBand, Occupation } from '../../roster/types';
import { rootSeedPath, childSeedPath } from '../../seedPath';
import { parseAssetKey } from '../../assets/assetKey';

describe('generateBody', () => {
  describe('determinism', () => {
    it('produces identical BodyPlan for same occupant and seed path', () => {
      const occupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        workPlotId: 20,
        occupation: 'resident',
      };
      const seedPath = childSeedPath(rootSeedPath(1337), 'occupant:1');

      const plan1 = generateBody(occupant, seedPath);
      const plan2 = generateBody(occupant, seedPath);

      expect(plan1).toStrictEqual(plan2);
    });

    it('produces different plans for different occupant ids', () => {
      const baseOccupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        workPlotId: 20,
        occupation: 'resident',
      };

      const seedPath = childSeedPath(rootSeedPath(1337), 'town:1');
      const plan1 = generateBody({ ...baseOccupant, id: 1 }, childSeedPath(seedPath, 'occupant:1'));
      const plan2 = generateBody({ ...baseOccupant, id: 2 }, childSeedPath(seedPath, 'occupant:2'));

      expect(plan1).not.toStrictEqual(plan2);
    });
  });

  describe('dimension bounds', () => {
    it('generates heights within documented ranges for each age band', () => {
      const ranges: Record<AgeBand, { min: number; max: number }> = {
        child: { min: 3.0, max: 4.5 },
        adult: { min: 5.0, max: 6.5 },
        elder: { min: 4.8, max: 6.2 },
      };

      for (const ageBand of ['child', 'adult', 'elder'] as AgeBand[]) {
        for (let i = 0; i < 50; i++) {
          const occupant: Occupant = {
            id: i,
            name: `Person ${i}`,
            ageBand,
            homePlotId: 10,
            occupation: 'resident',
          };
          const seedPath = childSeedPath(rootSeedPath(1337), `test:${ageBand}:${i}`);
          const plan = generateBody(occupant, seedPath);

          const range = ranges[ageBand];
          expect(plan.proportions.height).toBeGreaterThanOrEqual(range.min);
          expect(plan.proportions.height).toBeLessThan(range.max);
        }
      }
    });

    it('generates all finite dimensions', () => {
      const occupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        occupation: 'resident',
      };
      const seedPath = childSeedPath(rootSeedPath(1337), 'occupant:1');
      const plan = generateBody(occupant, seedPath);

      const props = plan.proportions;
      expect(Number.isFinite(props.height)).toBe(true);
      expect(Number.isFinite(props.shoulderWidth)).toBe(true);
      expect(Number.isFinite(props.torsoLength)).toBe(true);
      expect(Number.isFinite(props.torsoGirth)).toBe(true);
      expect(Number.isFinite(props.armLength)).toBe(true);
      expect(Number.isFinite(props.armGirth)).toBe(true);
      expect(Number.isFinite(props.legLength)).toBe(true);
      expect(Number.isFinite(props.legGirth)).toBe(true);
      expect(Number.isFinite(props.headSize)).toBe(true);
    });

    it('generates positive dimensions', () => {
      const occupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        occupation: 'resident',
      };
      const seedPath = childSeedPath(rootSeedPath(1337), 'occupant:1');
      const plan = generateBody(occupant, seedPath);

      const props = plan.proportions;
      expect(props.height).toBeGreaterThan(0);
      expect(props.shoulderWidth).toBeGreaterThan(0);
      expect(props.torsoLength).toBeGreaterThan(0);
      expect(props.torsoGirth).toBeGreaterThan(0);
      expect(props.armLength).toBeGreaterThan(0);
      expect(props.armGirth).toBeGreaterThan(0);
      expect(props.legLength).toBeGreaterThan(0);
      expect(props.legGirth).toBeGreaterThan(0);
      expect(props.headSize).toBeGreaterThan(0);
    });

    it('generates anatomically plausible proportions (torso + legs + head ≈ height)', () => {
      const occupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        occupation: 'resident',
      };
      const seedPath = childSeedPath(rootSeedPath(1337), 'occupant:1');
      const plan = generateBody(occupant, seedPath);

      const { height, torsoLength, legLength, headSize } = plan.proportions;
      const stacked = torsoLength + legLength + headSize;
      // Allow some overlap (joints, neck) but should be close
      expect(stacked).toBeGreaterThan(height * 0.9);
      expect(stacked).toBeLessThan(height * 1.1);
    });
  });

  describe('age band monotonicity', () => {
    it('children are shorter than adults on average over N ids', () => {
      const childHeights: number[] = [];
      const adultHeights: number[] = [];

      for (let i = 0; i < 100; i++) {
        const childOccupant: Occupant = {
          id: i,
          name: `Child ${i}`,
          ageBand: 'child',
          homePlotId: 10,
          occupation: 'resident',
        };
        const adultOccupant: Occupant = {
          id: i + 1000,
          name: `Adult ${i}`,
          ageBand: 'adult',
          homePlotId: 10,
          occupation: 'resident',
        };

        const childSeed = childSeedPath(rootSeedPath(1337), `child:${i}`);
        const adultSeed = childSeedPath(rootSeedPath(1337), `adult:${i}`);

        childHeights.push(generateBody(childOccupant, childSeed).proportions.height);
        adultHeights.push(generateBody(adultOccupant, adultSeed).proportions.height);
      }

      const avgChildHeight = childHeights.reduce((a, b) => a + b, 0) / childHeights.length;
      const avgAdultHeight = adultHeights.reduce((a, b) => a + b, 0) / adultHeights.length;

      expect(avgChildHeight).toBeLessThan(avgAdultHeight);
    });

    it('elders are slightly shorter than adults on average (stooping)', () => {
      const elderHeights: number[] = [];
      const adultHeights: number[] = [];

      for (let i = 0; i < 100; i++) {
        const elderOccupant: Occupant = {
          id: i,
          name: `Elder ${i}`,
          ageBand: 'elder',
          homePlotId: 10,
          occupation: 'resident',
        };
        const adultOccupant: Occupant = {
          id: i + 1000,
          name: `Adult ${i}`,
          ageBand: 'adult',
          homePlotId: 10,
          occupation: 'resident',
        };

        const elderSeed = childSeedPath(rootSeedPath(1337), `elder:${i}`);
        const adultSeed = childSeedPath(rootSeedPath(1337), `adult2:${i}`);

        elderHeights.push(generateBody(elderOccupant, elderSeed).proportions.height);
        adultHeights.push(generateBody(adultOccupant, adultSeed).proportions.height);
      }

      const avgElderHeight = elderHeights.reduce((a, b) => a + b, 0) / elderHeights.length;
      const avgAdultHeight = adultHeights.reduce((a, b) => a + b, 0) / adultHeights.length;

      expect(avgElderHeight).toBeLessThan(avgAdultHeight);
    });
  });

  describe('asset keys', () => {
    it('generates well-formed face keys that parse successfully', () => {
      const occupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        occupation: 'resident',
      };
      const seedPath = childSeedPath(rootSeedPath(1337), 'occupant:1');
      const plan = generateBody(occupant, seedPath);

      expect(() => parseAssetKey(plan.assetKeys.face)).not.toThrow();
      const parsed = parseAssetKey(plan.assetKeys.face);
      expect(parsed.kind).toBe('face');
      expect(parsed.subject).toBe('human');
    });

    it('generates well-formed clothing keys that parse successfully', () => {
      const occupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        occupation: 'artisan',
      };
      const seedPath = childSeedPath(rootSeedPath(1337), 'occupant:1');
      const plan = generateBody(occupant, seedPath);

      expect(() => parseAssetKey(plan.assetKeys.clothing)).not.toThrow();
      const parsed = parseAssetKey(plan.assetKeys.clothing);
      expect(parsed.kind).toBe('clothing');
    });

    it('face key includes age band', () => {
      for (const ageBand of ['child', 'adult', 'elder'] as AgeBand[]) {
        const occupant: Occupant = {
          id: 1,
          name: 'Test Person',
          ageBand,
          homePlotId: 10,
          occupation: 'resident',
        };
        const seedPath = childSeedPath(rootSeedPath(1337), `test:${ageBand}`);
        const plan = generateBody(occupant, seedPath);

        const parsed = parseAssetKey(plan.assetKeys.face);
        expect(parsed.descriptors).toContain(ageBand);
      }
    });

    it('clothing key includes occupation', () => {
      for (const occupation of ['resident', 'shopkeeper', 'artisan'] as Occupation[]) {
        const occupant: Occupant = {
          id: 1,
          name: 'Test Person',
          ageBand: 'adult',
          homePlotId: 10,
          occupation,
        };
        const seedPath = childSeedPath(rootSeedPath(1337), `test:${occupation}`);
        const plan = generateBody(occupant, seedPath);

        const parsed = parseAssetKey(plan.assetKeys.clothing);
        expect(parsed.subject).toBe(occupation);
      }
    });
  });

  describe('palette', () => {
    it('generates valid hex colors', () => {
      const occupant: Occupant = {
        id: 1,
        name: 'Test Person',
        ageBand: 'adult',
        homePlotId: 10,
        occupation: 'resident',
      };
      const seedPath = childSeedPath(rootSeedPath(1337), 'occupant:1');
      const plan = generateBody(occupant, seedPath);

      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      expect(plan.skinToneHex).toMatch(hexRegex);
      expect(plan.clothingPrimaryHex).toMatch(hexRegex);
      expect(plan.clothingSecondaryHex).toMatch(hexRegex);
    });

    it('applies occupation-specific secondary tint', () => {
      const tints: Record<Occupation, string> = {
        resident: '#9a8a72',
        shopkeeper: '#c8923f',
        artisan: '#b5552e',
      };

      for (const occupation of ['resident', 'shopkeeper', 'artisan'] as Occupation[]) {
        const occupant: Occupant = {
          id: 1,
          name: 'Test Person',
          ageBand: 'adult',
          homePlotId: 10,
          occupation,
        };
        const seedPath = childSeedPath(rootSeedPath(1337), `test:${occupation}`);
        const plan = generateBody(occupant, seedPath);

        expect(plan.clothingSecondaryHex).toBe(tints[occupation]);
      }
    });
  });

  describe('golden plan', () => {
    it('produces a specific known plan for a known occupant and seed', () => {
      const occupant: Occupant = {
        id: 42,
        name: 'Golden Person',
        ageBand: 'adult',
        homePlotId: 7,
        workPlotId: 13,
        occupation: 'artisan',
      };
      const seedPath = childSeedPath(rootSeedPath(999), 'golden-test');
      const plan = generateBody(occupant, seedPath);

      // Golden values — these pin the algorithm to prevent silent changes
      expect(plan.proportions.height).toBeCloseTo(6.10, 2);
      expect(plan.skinToneHex).toBe('#e0ac69');
      expect(plan.clothingSecondaryHex).toBe('#b5552e');
      expect(plan.assetKeys.face).toMatch(/^face\/human\/(male|female)\/adult\/\w+$/);
      expect(plan.assetKeys.clothing).toMatch(/^clothing\/artisan\/\w+$/);
    });
  });
});
