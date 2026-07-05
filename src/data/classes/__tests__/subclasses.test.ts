import { describe, it, expect } from 'vitest';
import { SUBCLASSES, subclassesForClass, findSubclass } from '../subclasses';
import { classFeaturesForLevel } from '../classFeatureProgression';
import { CLASSES_DATA } from '../index';
import { performLevelUp } from '../../../utils/characterUtils';
import { createMockPlayerCharacter } from '../../../utils/core/factories';

const CORE_CLASSES = ['fighter', 'barbarian', 'bard', 'cleric', 'druid', 'ranger', 'rogue', 'paladin', 'monk', 'sorcerer', 'warlock', 'wizard'];

describe('subclass data', () => {
  it('every core class offers at least two subclasses, each with a level-3 feature', () => {
    for (const id of CORE_CLASSES) {
      const subs = subclassesForClass(id);
      expect(subs.length, `${id} subclass count`).toBeGreaterThanOrEqual(2);
      for (const s of subs) {
        expect(s.classId).toBe(id);
        expect(s.features.length, `${s.id} features`).toBeGreaterThan(0);
        expect(s.features.some(f => f.levelAvailable === 3), `${s.id} has an L3 feature`).toBe(true);
      }
    }
  });

  it('findSubclass resolves a chosen subclass and ignores unknown ids', () => {
    expect(findSubclass('fighter', 'champion')?.name).toBe('Champion');
    expect(findSubclass('fighter', 'not_a_subclass')).toBeUndefined();
    expect(findSubclass('fighter', undefined)).toBeUndefined();
  });

  it('subclass ids are unique within a class', () => {
    for (const [cls, subs] of Object.entries(SUBCLASSES)) {
      const ids = subs.map(s => s.id);
      expect(new Set(ids).size, `${cls} unique ids`).toBe(ids.length);
    }
  });
});

describe('classFeaturesForLevel with a subclass', () => {
  it("folds in the chosen subclass's features at level 3", () => {
    const withoutSub = classFeaturesForLevel(CLASSES_DATA['fighter'], 3).map(f => f.id);
    const withChampion = classFeaturesForLevel(CLASSES_DATA['fighter'], 3, 'champion').map(f => f.id);
    expect(withoutSub).not.toContain('improved_critical');
    expect(withChampion).toContain('improved_critical');
  });

  it('does not show subclass features before level 3', () => {
    const l2 = classFeaturesForLevel(CLASSES_DATA['rogue'], 2, 'thief').map(f => f.id);
    expect(l2).not.toContain('fast_hands');
    const l3 = classFeaturesForLevel(CLASSES_DATA['rogue'], 3, 'thief').map(f => f.id);
    expect(l3).toContain('fast_hands');
  });
});

describe('performLevelUp subclass milestone', () => {
  it('applies a subclass when a character reaches level 3 (defaults to the first)', () => {
    const l2 = createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 2, xp: 900 });
    const l3 = performLevelUp(l2, {});
    expect(l3.level).toBe(3);
    expect(l3.subclassId).toBe('champion'); // first fighter subclass
  });

  it('honors an explicit subclass choice at level 3', () => {
    const l2 = createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 2, xp: 900 });
    const l3 = performLevelUp(l2, { subclassId: 'battle_master' });
    expect(l3.subclassId).toBe('battle_master');
  });

  it('does not assign a subclass before level 3', () => {
    const l1 = createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 1, xp: 300 });
    const l2 = performLevelUp(l1, {});
    expect(l2.level).toBe(2);
    expect(l2.subclassId).toBeUndefined();
  });
});
