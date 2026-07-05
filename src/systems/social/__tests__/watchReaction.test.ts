import { describe, expect, it } from 'vitest';
import {
  isWatchRole,
  situationHasWatch,
  isWantedInTown,
  deriveWatchReaction,
  WATCH_FIGHT_DISPOSITION_PENALTY,
} from '../watchReaction';
import { CrimeType } from '../../../types/crime';
import type { Crime } from '../../../types/crime';
import type { OpeningSituation } from '../../gameEntry/types';

const witnessedCrime = (locationId: string): Crime => ({
  id: 'c1',
  type: CrimeType.Assault,
  locationId,
  timestamp: 0,
  severity: 60,
  witnessed: true,
});

const WATCH_SITUATION: OpeningSituation = {
  setting: { place: 'the market', timeOfDay: 'dawn', weather: 'clear' },
  predicament: 'Two guards block your path.',
  npcs: [
    { id: 'g1', name: 'Corwin', role: 'city guard', disposition: 'hostile', goal: 'seize you' },
    { id: 'b1', name: 'Mira', role: 'onlooker', disposition: 'afraid', goal: 'flee' },
  ],
  openingLine: { speakerId: 'g1', text: 'Come with us.' },
  threat: { hostile: true, enemies: [{ name: 'Guard', quantity: 2, cr: '1/8' }], deEscalationDC: 12, tension: 'x' },
};

describe('isWatchRole', () => {
  it.each(['guard', 'city guard', 'town watchman', 'the watch', 'constable', 'sentinel', 'militia', 'warden'])(
    'detects "%s" as watch',
    (role) => expect(isWatchRole(role)).toBe(true),
  );
  it.each(['merchant', 'onlooker', 'farmer', 'innkeeper', '', undefined])(
    'rejects "%s"',
    (role) => expect(isWatchRole(role as string)).toBe(false),
  );
});

describe('situationHasWatch', () => {
  it('is true when a guard is present', () => expect(situationHasWatch(WATCH_SITUATION.npcs)).toBe(true));
  it('is false when no watch present', () =>
    expect(situationHasWatch([{ id: 'x', name: 'X', role: 'bandit', disposition: 'hostile', goal: 'rob' }])).toBe(false));
});

describe('isWantedInTown', () => {
  it('is true when a witnessed crime is recorded in the town', () =>
    expect(isWantedInTown([witnessedCrime('townA')], 'townA')).toBe(true));
  it('is false for a crime in a different town', () =>
    expect(isWantedInTown([witnessedCrime('townA')], 'townB')).toBe(false));
  it('is false for an unwitnessed crime', () =>
    expect(isWantedInTown([{ ...witnessedCrime('townA'), witnessed: false }], 'townA')).toBe(false));
  it('is false with no crimes', () => expect(isWantedInTown(undefined, 'townA')).toBe(false));
});

describe('deriveWatchReaction', () => {
  it('returns a witnessed Assault + wanted keyed to the town for a hostile watch fight', () => {
    const r = deriveWatchReaction(WATCH_SITUATION, 'townA', { openingWasHostile: true });
    expect(r).not.toBeNull();
    expect(r!.crime.type).toBe(CrimeType.Assault);
    expect(r!.crime.locationId).toBe('townA');
    expect(r!.crime.witnessed).toBe(true);
    expect(r!.crime.severity).toBeGreaterThanOrEqual(30); // bounty-worthy
    expect(r!.watchNpcIds).toEqual(['g1']);
    expect(r!.dispositionPenalty).toBe(WATCH_FIGHT_DISPOSITION_PENALTY);
  });

  it('escalates to Murder when a watch NPC died', () => {
    const r = deriveWatchReaction(WATCH_SITUATION, 'townA', { openingWasHostile: true, watchNpcDied: true });
    expect(r!.crime.type).toBe(CrimeType.Murder);
    expect(r!.logSummary).toMatch(/killed/i);
  });

  it('returns null when the opening was peaceful', () => {
    expect(deriveWatchReaction(WATCH_SITUATION, 'townA', { openingWasHostile: false })).toBeNull();
  });

  it('returns null when no watch NPC was in the scene (e.g. bandits)', () => {
    const bandits: OpeningSituation = {
      ...WATCH_SITUATION,
      npcs: [{ id: 'x', name: 'X', role: 'bandit', disposition: 'hostile', goal: 'rob' }],
    };
    expect(deriveWatchReaction(bandits, 'townA', { openingWasHostile: true })).toBeNull();
  });

  it('returns null with no town/location to key the reaction to', () => {
    expect(deriveWatchReaction(WATCH_SITUATION, null, { openingWasHostile: true })).toBeNull();
  });
});
