import { describe, it, expect } from 'vitest';
import { classFeaturesForLevel } from '../classFeatureProgression';
import { CLASSES_DATA } from '../index';

const ids = (cls: string, level: number) =>
  classFeaturesForLevel(CLASSES_DATA[cls], level).map(f => f.id);

describe('classFeaturesForLevel', () => {
  it('a level-1 fighter has only its level-1 features', () => {
    const l1 = ids('fighter', 1);
    expect(l1).toContain('second_wind');
    expect(l1).not.toContain('action_surge');
    expect(l1).not.toContain('subclass_choice');
  });

  it('a fighter gains Action Surge at level 2 and a subclass at level 3', () => {
    expect(ids('fighter', 2)).toContain('action_surge');
    expect(ids('fighter', 2)).not.toContain('subclass_choice');
    expect(ids('fighter', 3)).toContain('subclass_choice');
  });

  it('a rogue gains Cunning Action at level 2, Steady Aim + subclass at level 3', () => {
    expect(ids('rogue', 1)).toEqual(['sneak_attack']);
    expect(ids('rogue', 2)).toContain('cunning_action');
    const l3 = ids('rogue', 3);
    expect(l3).toContain('steady_aim');
    expect(l3).toContain('subclass_choice');
  });

  it('a cleric gains Channel Divinity at level 2 and its domain at level 3', () => {
    expect(ids('cleric', 2)).toContain('channel_divinity');
    expect(ids('cleric', 3)).toContain('subclass_choice');
  });

  it('every class reaches its level-3 subclass milestone', () => {
    for (const id of ['fighter', 'barbarian', 'bard', 'cleric', 'druid', 'ranger', 'rogue', 'paladin', 'monk', 'sorcerer', 'warlock', 'wizard']) {
      expect(ids(id, 3), `${id} @ L3`).toContain('subclass_choice');
    }
  });

  it('features are ordered by the level they were gained', () => {
    const feats = classFeaturesForLevel(CLASSES_DATA['fighter'], 3);
    const levels = feats.map(f => f.levelAvailable);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('returns an empty list for an undefined class', () => {
    expect(classFeaturesForLevel(undefined, 3)).toEqual([]);
  });
});
