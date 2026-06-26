import { describe, it, expect } from 'vitest';
import { buildSituationLocation } from '../useOpeningSituation';
import { initialGameState } from '../../state/initialState';
import { LOCATIONS, STARTING_LOCATION_ID } from '../../data/world/locations';
import type { GameState } from '../../types';

const base = (): GameState => ({ ...initialGameState });

describe('buildSituationLocation — chosen start town names the opening scene', () => {
  it('uses the chosen town + region when present', () => {
    const loc = buildSituationLocation({ ...base(), startTownName: 'Pinsk', startTownRegion: 'See of Helsia' });
    expect(loc.name).toBe('Pinsk, See of Helsia');
  });

  it('uses the town name alone when no region is recorded', () => {
    const loc = buildSituationLocation({ ...base(), startTownName: 'Pinsk' });
    expect(loc.name).toBe('Pinsk');
  });

  it('falls back to the static starting location when no town was chosen (dev/skip/load)', () => {
    const loc = buildSituationLocation({ ...base(), startTownName: undefined, startTownRegion: undefined });
    const expected = LOCATIONS[STARTING_LOCATION_ID]?.name ?? STARTING_LOCATION_ID;
    expect(loc.name).toBe(expected);
  });
});
