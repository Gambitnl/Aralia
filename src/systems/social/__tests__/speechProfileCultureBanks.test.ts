/**
 * @file src/systems/social/__tests__/speechProfileCultureBanks.test.ts
 * Proof for the deepened lexicon banks (agora-3c98).
 *
 * The original model had one lexicon layer per axis and four dialect tags, so
 * every coastal speaker in the world shared a vocabulary regardless of register
 * or trade. This suite covers the three things that changed:
 *
 *   1. dialect x formality banks, so twelve registers come out of four dialects;
 *   2. a profanity gradient that only crude speakers reach, and that hardens as
 *      the register drops from formal to gruff;
 *   3. culture families, so a temple acolyte and a farmhand from the same
 *      village do not share verbal tics.
 */

import { describe, it, expect } from 'vitest';
import {
  SPEECH_PROFILE_PRESETS,
  applySpeechProfile,
  deriveCultureFamily,
  generateSpeechProfile,
  type SpeechCultureFamily,
} from '../speechProfile';
import type {
  SpeechDialectTag,
  SpeechFormality,
  SpeechProfile,
  SpeechVocabularyLevel,
} from '../../../types/dialogue';

const DIALECTS: SpeechDialectTag[] = ['coastal', 'mountain', 'urban', 'rural'];
const FORMALITIES: SpeechFormality[] = ['formal', 'casual', 'gruff'];

function profile(
  dialectTag: SpeechDialectTag,
  formality: SpeechFormality,
  vocabularyLevel: SpeechVocabularyLevel = 'common'
): SpeechProfile {
  return {
    id: `${dialectTag}-${formality}-${vocabularyLevel}`,
    label: `${dialectTag} ${formality}`,
    vocabularyLevel,
    formality,
    dialectTag,
    // No tics: these tests are about the lexicon layers, and an injected tic
    // would let two otherwise identical renderings look different for free.
    verbalTics: [],
    sentenceLength: 'medium',
  };
}

/** Bag of words, so a difference in punctuation alone does not count as a difference. */
function words(line: string): Set<string> {
  return new Set(
    line
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
  );
}

describe('dialect x formality banks (agora-3c98)', () => {
  const GREETING = 'Hello, friend. Maybe the news is bad. Goodbye.';

  it('renders the same greeting differently in all twelve registers', () => {
    const rendered = DIALECTS.flatMap(dialect =>
      FORMALITIES.map(formality => applySpeechProfile(GREETING, profile(dialect, formality)))
    );

    expect(rendered).toHaveLength(12);
    expect(new Set(rendered).size).toBe(12);
  });

  it('separates the registers of one dialect by word choice, not punctuation', () => {
    for (const dialect of DIALECTS) {
      const bags = FORMALITIES.map(formality =>
        words(applySpeechProfile(GREETING, profile(dialect, formality)))
      );
      for (let a = 0; a < bags.length; a++) {
        for (let b = a + 1; b < bags.length; b++) {
          const onlyInA = [...bags[a]].filter(word => !bags[b].has(word));
          const onlyInB = [...bags[b]].filter(word => !bags[a].has(word));
          expect(onlyInA.length + onlyInB.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('lets the register bank overwrite a dialect swap it would not use', () => {
    // The coastal bank turns `friend` into `shipmate`; the gruff register of the
    // same dialect will not call anyone shipmate and downgrades it to deckhand.
    const casual = applySpeechProfile('Hello, friend.', profile('coastal', 'casual'));
    const gruff = applySpeechProfile('Hello, friend.', profile('coastal', 'gruff'));

    expect(casual.toLowerCase()).toContain('shipmate');
    expect(gruff.toLowerCase()).toContain('deckhand');
  });

  it('keeps the original single-layer dialect swaps intact', () => {
    const out = applySpeechProfile('Yes, I will help you, friend.', SPEECH_PROFILE_PRESETS['coastal-sailor']);
    expect(out.toLowerCase()).toContain('aye');
    expect(out.toLowerCase()).toContain('shipmate');
  });
});

describe('profanity gradient (agora-3c98)', () => {
  const OATH = 'Darn it, that is nonsense, you idiot.';

  it('never reaches a common or scholarly speaker', () => {
    for (const level of ['common', 'scholarly'] as SpeechVocabularyLevel[]) {
      const out = applySpeechProfile(OATH, profile('rural', 'gruff', level));
      expect(out.toLowerCase()).not.toContain('bilge');
      expect(out.toLowerCase()).not.toContain('sodding');
    }
  });

  it('hardens as the register drops from formal to gruff', () => {
    const formal = applySpeechProfile(OATH, profile('rural', 'formal', 'crude'));
    const casual = applySpeechProfile(OATH, profile('rural', 'casual', 'crude'));
    const gruff = applySpeechProfile(OATH, profile('rural', 'gruff', 'crude'));

    // Rung 1: a crude speaker minding their manners reaches for a euphemism.
    expect(formal.toLowerCase()).toContain('poor fellow');
    // Rung 2: ordinary company, mild oath.
    expect(casual.toLowerCase()).toContain('rubbish');
    expect(casual.toLowerCase()).toContain('fool');
    // Rung 3: nobody left to impress.
    expect(gruff.toLowerCase()).toContain('bilge');
    expect(gruff.toLowerCase()).toContain('clod');

    expect(new Set([formal, casual, gruff]).size).toBe(3);
  });

  it('sharpens a word the vocabulary bank just chose', () => {
    // `crude` maps nothing here; the casual gradient produces `rubbish`, and the
    // gruff gradient takes that same word one rung further to `bilge`.
    const gruff = applySpeechProfile('That is nonsense.', profile('mountain', 'gruff', 'crude'));
    expect(gruff.toLowerCase()).toContain('bilge');
    expect(gruff.toLowerCase()).not.toContain('nonsense');
  });
});

describe('culture families (agora-3c98)', () => {
  it('resolves a family from a culture id, a background id or a role', () => {
    expect(deriveCultureFamily('temple-of-dawn')).toBe('clergy');
    expect(deriveCultureFamily(undefined, 'sailor')).toBe('nautical');
    expect(deriveCultureFamily(undefined, undefined, 'guard')).toBe('military');
    expect(deriveCultureFamily('thieves-guild')).toBe('criminal');
  });

  it('returns null when nothing matches, so most villagers keep their dialect tics', () => {
    expect(deriveCultureFamily()).toBeNull();
    expect(deriveCultureFamily('ashfen', 'wanderer', 'civilian')).toBeNull();
  });

  it('lets formation outrank occupation when both are present', () => {
    // A temple guard is a guard, but the temple is what shaped how they speak.
    expect(deriveCultureFamily('temple-of-dawn', undefined, 'guard')).toBe('clergy');
  });

  it('gives two speakers who share every original axis different tics', () => {
    const acolyte = generateSpeechProfile({
      role: 'civilian',
      biomeId: 'plains',
      cultureId: 'shrine-of-the-harvest',
      seed: 'npc-a',
    });
    const farmhand = generateSpeechProfile({
      role: 'civilian',
      biomeId: 'plains',
      cultureId: 'farmstead',
      seed: 'npc-a',
    });

    // Same dialect, same register, same vocabulary, same seed.
    expect(acolyte.dialectTag).toBe(farmhand.dialectTag);
    expect(acolyte.formality).toBe(farmhand.formality);
    expect(acolyte.vocabularyLevel).toBe(farmhand.vocabularyLevel);

    // Different culture, therefore a different voice.
    expect(acolyte.verbalTics).not.toEqual(farmhand.verbalTics);
    expect(acolyte.id).not.toBe(farmhand.id);
    expect(applySpeechProfile('I can help you.', acolyte)).not.toBe(
      applySpeechProfile('I can help you.', farmhand)
    );
  });

  it('stays deterministic for a given seed', () => {
    const input = { role: 'merchant', biomeId: 'city', cultureId: 'caravan-guild', seed: 'npc-b' };
    expect(generateSpeechProfile(input)).toEqual(generateSpeechProfile(input));
    expect(generateSpeechProfile(input).id).toContain('mercantile');
  });

  it('gives every culture family two tics in every register', () => {
    const families: SpeechCultureFamily[] = [
      'nautical',
      'criminal',
      'clergy',
      'military',
      'mercantile',
      'arcane',
      'noble',
      'agrarian',
      'artisan',
    ];
    const hintFor: Record<SpeechCultureFamily, string> = {
      nautical: 'sailor',
      criminal: 'thief',
      clergy: 'priest',
      military: 'soldier',
      mercantile: 'merchant',
      arcane: 'wizard',
      noble: 'noble',
      agrarian: 'farm',
      artisan: 'smith',
    };

    for (const family of families) {
      for (const formality of FORMALITIES) {
        const generated = generateSpeechProfile({
          cultureId: hintFor[family],
          seed: `${family}-${formality}`,
        });
        expect(deriveCultureFamily(hintFor[family])).toBe(family);
        expect(generated.verbalTics).toHaveLength(2);
        expect(generated.verbalTics.every(Boolean)).toBe(true);
      }
    }
  });
});
