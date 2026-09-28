/**
 * @file src/systems/social/__tests__/speechProfileCultureLexicon.test.ts
 *
 * Guards the fourth lexicon layer (agora-db71.17).
 *
 * `speechProfile.ts` recorded the culture *lexicon* as deferred: it needed a
 * `cultureFamily` field on `SpeechProfile`, which lives in `src/types/dialogue.ts`.
 * The field now exists, the generator records it, and `applySpeechProfile` reads
 * it — so culture reaches the voice through word choice, not only through tics.
 *
 * Called by: focused Vitest runs for packet W4-D.
 * Depends on: speechProfile.ts, types/dialogue.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  applySpeechProfile,
  describeSpeechProfile,
  generateSpeechProfile,
} from '../speechProfile';
import type { SpeechProfile } from '../../../types/dialogue';

const base: SpeechProfile = {
  id: 'test',
  label: 'test',
  vocabularyLevel: 'common',
  formality: 'casual',
  dialectTag: 'rural',
  verbalTics: [],
  sentenceLength: 'medium',
};

describe('cultureFamily on SpeechProfile', () => {
  it('is recorded by the generator when a culture matches', () => {
    const profile = generateSpeechProfile({ role: 'guard', cultureId: 'garrison', seed: 'a' });
    expect(profile.cultureFamily).toBe('military');
  });

  it('is left absent when nothing matches, so an uncultured profile is unchanged', () => {
    const profile = generateSpeechProfile({ seed: 'b' });
    expect(profile.cultureFamily).toBeUndefined();
  });
});

describe('applySpeechProfile - culture jargon layer', () => {
  const line = 'The plan is set and the group will meet you there.';

  it('swaps in the culture bank when the profile carries a culture', () => {
    const sailor = applySpeechProfile(line, { ...base, cultureFamily: 'nautical' });
    expect(sailor).toContain('course');
    expect(sailor).toContain('crew');
    expect(sailor).not.toContain('plan');
  });

  it('gives two same-axis speakers different words when only culture differs', () => {
    const temple = applySpeechProfile(line, { ...base, cultureFamily: 'clergy' });
    const farm = applySpeechProfile(line, { ...base, cultureFamily: 'agrarian' });
    expect(temple).not.toBe(farm);
    expect(farm).toContain('kin');
  });

  it('is a no-op without a cultureFamily, so legacy profiles are untouched', () => {
    expect(applySpeechProfile(line, base)).toBe(applySpeechProfile(line, { ...base }));
    expect(applySpeechProfile(line, base)).toContain('plan');
  });
});

describe('describeSpeechProfile - culture reaches the model hint too', () => {
  it('names the culture when one is set, and omits the clause when it is not', () => {
    expect(describeSpeechProfile({ ...base, cultureFamily: 'criminal' }))
      .toContain('criminal turns of phrase');
    expect(describeSpeechProfile(base)).not.toContain('turns of phrase');
  });
});
