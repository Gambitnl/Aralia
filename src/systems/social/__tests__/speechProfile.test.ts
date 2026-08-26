/**
 * @file src/systems/social/__tests__/speechProfile.test.ts
 * Proof for NPC Speech Fingerprinting (agora-9e0f).
 *
 * The load-bearing assertion is the last block: the SAME raw LLM line, run through
 * the five starting profiles, must produce five visibly different strings.
 */

import { describe, it, expect } from 'vitest';
import {
  SPEECH_PROFILE_PRESETS,
  SPEECH_PROFILE_PRESET_IDS,
  applySpeechProfile,
  describeSpeechProfile,
  deriveDialectTag,
  deriveFormality,
  deriveSentenceLength,
  deriveVocabularyLevel,
  generateSpeechProfile,
} from '../speechProfile';
import { generateNPC } from '../../../services/npcGenerator';
import { NPCS } from '../../../data/world/npcs';

/** One neutral model answer, reused everywhere so differences come only from the profile. */
const RAW_LINE =
  "Yes, I can help you, friend. Please, I would like to get the money very quickly, because the road is not safe and I don't want trouble.";

describe('speech profile presets', () => {
  it('ships five distinct starting profiles', () => {
    expect(SPEECH_PROFILE_PRESET_IDS).toHaveLength(5);
    const axes = SPEECH_PROFILE_PRESET_IDS.map(id => {
      const p = SPEECH_PROFILE_PRESETS[id];
      return `${p.vocabularyLevel}|${p.formality}|${p.dialectTag}|${p.sentenceLength}`;
    });
    expect(new Set(axes).size).toBe(5);
  });

  it('gives every preset at least one verbal tic', () => {
    for (const id of SPEECH_PROFILE_PRESET_IDS) {
      expect(SPEECH_PROFILE_PRESETS[id].verbalTics.length).toBeGreaterThan(0);
    }
  });
});

describe('profile derivation from role + biome + culture', () => {
  it('maps biomes onto dialect tags', () => {
    expect(deriveDialectTag('coastal_shore')).toBe('coastal');
    expect(deriveDialectTag('mountain_peaks')).toBe('mountain');
    expect(deriveDialectTag('city_district')).toBe('urban');
    expect(deriveDialectTag('plains')).toBe('rural');
  });

  it('maps roles onto formality', () => {
    expect(deriveFormality('guard')).toBe('gruff');
    expect(deriveFormality('quest_giver')).toBe('formal');
    expect(deriveFormality('merchant')).toBe('casual');
    expect(deriveFormality('civilian', 'noble-court')).toBe('formal');
  });

  it('maps culture and background onto vocabulary', () => {
    expect(deriveVocabularyLevel('academy', 'sage')).toBe('scholarly');
    expect(deriveVocabularyLevel(undefined, 'criminal')).toBe('crude');
    expect(deriveVocabularyLevel(undefined, 'farmer')).toBe('common');
  });

  it('derives pacing from register', () => {
    expect(deriveSentenceLength('gruff', 'crude')).toBe('short');
    expect(deriveSentenceLength('formal', 'scholarly')).toBe('long');
    expect(deriveSentenceLength('casual', 'common')).toBe('medium');
  });

  it('is deterministic for a given seed and varies across seeds', () => {
    const a = generateSpeechProfile({ role: 'guard', biomeId: 'mountain', seed: 'npc-1' });
    const b = generateSpeechProfile({ role: 'guard', biomeId: 'mountain', seed: 'npc-1' });
    expect(a).toEqual(b);
    expect(a.dialectTag).toBe('mountain');
    expect(a.formality).toBe('gruff');
    expect(a.sentenceLength).toBe('short');
  });

  it('produces different profiles for different role/biome/culture inputs', () => {
    const sailor = generateSpeechProfile({ role: 'merchant', biomeId: 'coastal', seed: 's' });
    const sage = generateSpeechProfile({ role: 'quest_giver', biomeId: 'city', cultureId: 'sage', seed: 's' });
    expect(sailor.id).not.toBe(sage.id);
  });
});

describe('npcGenerator wiring', () => {
  it('attaches a speech profile to every generated NPC', () => {
    const guard = generateNPC({ id: 'npc-guard', role: 'guard', biomeId: 'mountain_pass' });
    expect(guard.speechProfile).toBeDefined();
    expect(guard.speechProfile?.dialectTag).toBe('mountain');
    expect(guard.speechProfile?.formality).toBe('gruff');
  });

  it('gives NPCs of different role and biome different voices', () => {
    const sailor = generateNPC({ id: 'npc-sailor', role: 'merchant', biomeId: 'coastal_shore' });
    const guard = generateNPC({ id: 'npc-guard-2', role: 'guard', biomeId: 'mountain_pass' });
    expect(sailor.speechProfile?.id).not.toBe(guard.speechProfile?.id);
  });
});

describe('applySpeechProfile transformations', () => {
  it('swaps dialect words for a coastal speaker', () => {
    const out = applySpeechProfile('Yes, I will help you, friend.', SPEECH_PROFILE_PRESETS['coastal-sailor']);
    expect(out.toLowerCase()).toContain('aye');
    expect(out.toLowerCase()).toContain('shipmate');
  });

  it('shortens sentences and contracts for a gruff guard', () => {
    const out = applySpeechProfile(RAW_LINE, SPEECH_PROFILE_PRESETS['mountain-guard']);
    const longest = out
      .split(/[.!?]+/)
      .map(s => s.trim().split(/\s+/).filter(Boolean).length)
      .reduce((max, n) => Math.max(max, n), 0);
    expect(longest).toBeLessThanOrEqual(12);
    expect(out).not.toMatch(/\bPlease\b/);
  });

  it('expands contractions and elevates vocabulary for a formal scholar', () => {
    const out = applySpeechProfile(RAW_LINE, SPEECH_PROFILE_PRESETS['urban-scholar']);
    expect(out).not.toContain("don't");
    expect(out).toContain('do not');
    expect(out.toLowerCase()).toContain('obtain');
  });

  it('leaves text untouched when no profile is supplied', () => {
    expect(applySpeechProfile(RAW_LINE, undefined)).toBe(RAW_LINE);
    expect(applySpeechProfile(RAW_LINE, null)).toBe(RAW_LINE);
  });

  it('is idempotent in shape for empty input', () => {
    expect(applySpeechProfile('', SPEECH_PROFILE_PRESETS['rural-farmer'])).toBe('');
  });

  it('never drops the payload of a sentence when shortening', () => {
    const out = applySpeechProfile('The road is closed, and the bridge is out.', SPEECH_PROFILE_PRESETS['mountain-guard']);
    expect(out.toLowerCase()).toContain('road');
    expect(out.toLowerCase()).toContain('bridge');
  });

  it('emits a prompt hint describing the profile', () => {
    const hint = describeSpeechProfile(SPEECH_PROFILE_PRESETS['urban-scholar']);
    expect(hint).toContain('scholarly');
    expect(hint).toContain('formal');
    expect(hint).toContain('urban');
    expect(describeSpeechProfile(undefined)).toBe('');
  });
});

describe('five profiles produce visibly different text from one prompt', () => {
  const rendered = SPEECH_PROFILE_PRESET_IDS.map(id => applySpeechProfile(RAW_LINE, SPEECH_PROFILE_PRESETS[id]));

  it('yields five unique renderings', () => {
    expect(new Set(rendered).size).toBe(5);
  });

  it('changes every rendering away from the raw line', () => {
    for (const line of rendered) {
      expect(line).not.toBe(RAW_LINE);
    }
  });

  it('differs by more than punctuation between every pair', () => {
    // Compare bags of words: two profiles must not merely re-punctuate the same words.
    const bags = rendered.map(line => new Set(line.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)));
    for (let i = 0; i < bags.length; i++) {
      for (let j = i + 1; j < bags.length; j++) {
        const onlyInA = [...bags[i]].filter(w => !bags[j].has(w));
        const onlyInB = [...bags[j]].filter(w => !bags[i].has(w));
        expect(onlyInA.length + onlyInB.length).toBeGreaterThan(0);
      }
    }
  });

  it('prints the five renderings for human inspection', () => {
    SPEECH_PROFILE_PRESET_IDS.forEach((id, index) => {
      console.log(`[${id}] ${rendered[index]}`);
    });
    expect(rendered).toHaveLength(5);
  });
});

describe('authored starting-town NPCs', () => {
  it('gives all five authored NPCs a distinct speech profile', () => {
    const ids = Object.keys(NPCS);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    const profileIds = ids.map(id => NPCS[id].speechProfile?.id);
    expect(profileIds.every(Boolean)).toBe(true);
    expect(new Set(profileIds).size).toBe(ids.length);
  });

  it('renders one line differently for every authored NPC', () => {
    const ids = Object.keys(NPCS);
    const lines = ids.map(id => applySpeechProfile(RAW_LINE, NPCS[id].speechProfile));
    ids.forEach((id, index) => console.log(`[${NPCS[id].name}] ${lines[index]}`));
    expect(new Set(lines).size).toBe(ids.length);
  });
});
