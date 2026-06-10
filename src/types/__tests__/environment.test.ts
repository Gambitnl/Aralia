import { describe, it, expect } from 'vitest';
import { DEFAULT_WEATHER } from '../../systems/environment/EnvironmentSystem';
import { getWeatherSummary, withLegacyWeatherBridge } from '../environment';

describe('Environment weather bridge', () => {
  // The canonical weather object should be enough to produce the legacy label
  // without requiring tests or callers to hand-build the old string field.
  it('summarizes canonical weather without the legacy bridge field', () => {
    expect(getWeatherSummary(DEFAULT_WEATHER)).toBe('Clear');
  });

  // If a save or legacy caller already carries the old label, the helper keeps
  // it instead of trying to second-guess the older data shape.
  it('prefers an existing legacy weather label when present', () => {
    expect(getWeatherSummary({ ...DEFAULT_WEATHER, currentWeather: 'Storm' })).toBe('Storm');
  });

  // The bridge helper is intentionally thin: it keeps the old field alive while
  // leaving the structured weather values untouched for the rest of the system.
  it('re-attaches the legacy label to canonical weather', () => {
    const bridged = withLegacyWeatherBridge(DEFAULT_WEATHER);

    expect(bridged).toMatchObject({
      ...DEFAULT_WEATHER,
      currentWeather: 'Clear',
    });
    expect(DEFAULT_WEATHER).not.toHaveProperty('currentWeather');
  });
});
