/** Point-buy checks exercise overspending and the expensive upper score range. */
import { describe, expect, it } from 'vitest';
import { changeScore, pointsRemaining, startingScores, raceOptions } from './choices';

describe('atelier point buy', () => {
  it('starts with exactly the 27 available points allocated', () => {
    expect(pointsRemaining(startingScores)).toBe(0);
  });
  it('rejects an increase that would overspend', () => {
    expect(changeScore(startingScores,'Dexterity',1)).toBe(startingScores);
  });
  it('refunds two points for 15 to 14, then allows two cheaper increases', () => {
    const refund=changeScore(startingScores,'Strength',-1);
    expect(pointsRemaining(refund)).toBe(2);
    const spent=changeScore(changeScore(refund,'Dexterity',1),'Dexterity',1);
    expect(spent.Dexterity).toBe(12);
    expect(pointsRemaining(spent)).toBe(0);
  });
  it('does not reduce a score below eight or increase beyond fifteen', () => {
    expect(changeScore(startingScores,'Intelligence',-1)).toBe(startingScores);
    expect(changeScore(startingScores,'Strength',1)).toBe(startingScores);
  });
});

/** The UI and Blender builder share this roster; keep stature and face framing valid. */
describe('atelier race roster', () => {
  it('preserves the original four and adds ten distinct selectable models', () => {
    expect(raceOptions).toHaveLength(14);
    expect(new Set(raceOptions.map(r => r.id)).size).toBe(14);
    expect(raceOptions.slice(0,4).map(r => r.id)).toEqual(['high-elf','wood-elf','human','half-elf']);
    for (const race of raceOptions) {
      expect(race.faceHeight).toBeGreaterThan(race.height * .75);
      expect(race.faceHeight).toBeLessThan(race.height);
      expect(race.traits.length).toBeGreaterThan(0);
    }
  });
  it('keeps small folk shorter than humans and giants taller', () => {
    const height = (id: string) => raceOptions.find(r => r.id === id)!.height;
    expect(height('halfling')).toBeLessThan(height('dwarf'));
    expect(height('gnome')).toBeLessThan(height('human'));
    expect(height('dwarf')).toBeLessThan(height('human'));
    expect(height('goliath')).toBeGreaterThan(height('human'));
  });
});
