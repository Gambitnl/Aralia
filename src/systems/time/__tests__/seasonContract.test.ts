import { describe, it, expect } from 'vitest';
import {
  SEASON_CONTRACT,
  getSeasonState,
  getSeasonalTravelCostMultiplier,
  getTimeModifiers,
} from '../seasonContract';
import { Season } from '../../../utils/core/timeUtils';

// The season contract is the ONE source of truth for seasonal simulation
// modifiers (G3, decided 2026-07: hard global contract over a movement-only
// subsystem). It must be a deterministic pure function of the persisted game
// clock — that is what makes it save-safe.

describe('getSeasonState — deterministic contract', () => {
  it('maps every month to the right season (UTC month, in-world clock)', () => {
    expect(getSeasonState(new Date(Date.UTC(351, 0, 15))).season).toBe(Season.Winter);
    expect(getSeasonState(new Date(Date.UTC(351, 1, 15))).season).toBe(Season.Winter);
    expect(getSeasonState(new Date(Date.UTC(351, 2, 15))).season).toBe(Season.Spring);
    expect(getSeasonState(new Date(Date.UTC(351, 4, 15))).season).toBe(Season.Spring);
    expect(getSeasonState(new Date(Date.UTC(351, 5, 15))).season).toBe(Season.Summer);
    expect(getSeasonState(new Date(Date.UTC(351, 7, 15))).season).toBe(Season.Summer);
    expect(getSeasonState(new Date(Date.UTC(351, 8, 15))).season).toBe(Season.Autumn);
    expect(getSeasonState(new Date(Date.UTC(351, 10, 15))).season).toBe(Season.Autumn);
    expect(getSeasonState(new Date(Date.UTC(351, 11, 15))).season).toBe(Season.Winter);
  });

  it('is deterministic: the same instant always yields an identical state', () => {
    const t = new Date(Date.UTC(351, 11, 25, 13, 30, 0));
    expect(getSeasonState(t)).toEqual(getSeasonState(new Date(t.getTime())));
  });

  it('survives a save/reload round-trip (gameTime → ISO string → Date)', () => {
    // Saves persist gameTime; on load it is revived from its serialized form.
    // The contract derives everything from that clock, so a round-trip must
    // reproduce the exact same seasonal state.
    const before = new Date(Date.UTC(353, 6, 4, 21, 15, 42));
    const saved = JSON.stringify({ gameTime: before });
    const revived = new Date(JSON.parse(saved).gameTime as string);
    expect(getSeasonState(revived)).toEqual(getSeasonState(before));
  });

  it('exposes the full modifier surface for every season', () => {
    for (const season of Object.values(Season)) {
      const entry = SEASON_CONTRACT[season];
      expect(entry.modifiers.travelCostMultiplier).toBeGreaterThan(0);
      expect(entry.modifiers.forageScarcityMultiplier).toBeGreaterThan(0);
      expect(entry.modifiers.forageYieldMultiplier).toBeGreaterThan(0);
      expect(typeof entry.modifiers.survivalDcModifier).toBe('number');
      // Extension seams (encounters / economy / farming) exist on the contract
      // even before any system consumes them — neutral until a consumer lands.
      expect(entry.modifiers.encounterRateMultiplier).toBe(1);
      expect(entry.modifiers.priceMultiplier).toBe(1);
      expect(entry.modifiers.growthMultiplier).toBe(1);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('winter is mechanically harsh; autumn is the harvest', () => {
    const winter = getSeasonState(new Date(Date.UTC(351, 0, 10)));
    expect(winter.modifiers.travelCostMultiplier).toBe(1.5);
    expect(winter.modifiers.forageScarcityMultiplier).toBe(1.5);
    expect(winter.modifiers.forageYieldMultiplier).toBe(0.5);
    expect(winter.modifiers.survivalDcModifier).toBe(2);
    expect(winter.elements).toContain('cold');

    const autumn = getSeasonState(new Date(Date.UTC(351, 9, 10)));
    expect(autumn.modifiers.travelCostMultiplier).toBe(1);
    expect(autumn.modifiers.forageScarcityMultiplier).toBe(0.8);
    expect(autumn.modifiers.forageYieldMultiplier).toBe(1.5);
  });
});

describe('movement read point', () => {
  it('getSeasonalTravelCostMultiplier reads straight off the contract', () => {
    expect(getSeasonalTravelCostMultiplier(new Date(Date.UTC(351, 0, 10)))).toBe(1.5);
    expect(getSeasonalTravelCostMultiplier(new Date(Date.UTC(351, 6, 10)))).toBe(1);
  });
});

describe('getTimeModifiers — season component routed through the contract', () => {
  it('winter travel cost equals the CONTRACT multiplier (no more diverged 1.25)', () => {
    // Historic bug this contract kills: timeUtils said winter = 1.25 while
    // SeasonalSystem said 1.5. One source of truth now: 1.5.
    const winterNoon = new Date(Date.UTC(351, 0, 10, 12, 0));
    expect(getTimeModifiers(winterNoon).travelCostMultiplier).toBe(1.5);
  });

  it('night stacks its own multiplier on top of the seasonal one', () => {
    const winterNight = new Date(Date.UTC(351, 0, 10, 23, 0));
    expect(getTimeModifiers(winterNight).travelCostMultiplier).toBeCloseTo(1.5 * 1.5);
    expect(getTimeModifiers(winterNight).visionModifier).toBe(0.2);
  });

  it('a summer day is neutral', () => {
    const summerNoon = new Date(Date.UTC(351, 6, 10, 12, 0));
    expect(getTimeModifiers(summerNoon).travelCostMultiplier).toBe(1);
    expect(getTimeModifiers(summerNoon).visionModifier).toBe(1);
  });

  it('describes both the season and the time of day', () => {
    const mods = getTimeModifiers(new Date(Date.UTC(351, 0, 10, 23, 0)));
    expect(mods.description).toContain('cold');
    expect(mods.description).toContain('Darkness');
  });
});
