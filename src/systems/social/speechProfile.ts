// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 08:55:58
 * Dependents: data/world/npcs.ts, hooks/useDialogueSystem.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/social/speechProfile.ts
 * NPC Speech Fingerprinting.
 *
 * WHAT: assigns every NPC a `SpeechProfile` (vocabulary / formality / dialect /
 * verbal tics / sentence-length preference) and post-processes raw LLM dialogue
 * so two NPCs answering the same prompt sound like two different people.
 *
 * WHY: `initialPersonalityPrompt` alone leaves voice entirely to the model, so a
 * coastal smuggler and a cloistered sage came back in the same neutral register.
 * The prompt hint (see {@link describeSpeechProfile}) nudges the model; the
 * post-processor ({@link applySpeechProfile}) guarantees the difference even when
 * the model ignores the hint or the local Ollama model is swapped out.
 *
 * PRESERVED: nothing was replaced. `initialPersonalityPrompt`, `dialoguePromptSeed`
 * and `voice` (TTS) keep their existing meaning; a speech profile is an additional,
 * optional layer that degrades to a no-op when absent.
 *
 * LEXICON DEPTH (agora-3c98): the banks started deliberately small and hand-picked.
 * They are now three layers deep instead of one, which is what lets far more than
 * four voices come out the other end:
 *
 *   1. {@link DIALECT_LEXICON}          — one bank per dialect tag (4).
 *   2. {@link DIALECT_REGISTER_LEXICON} — dialect x formality (12), so a formal
 *      harbourmaster and a gruff deckhand no longer share a vocabulary.
 *   3. {@link PROFANITY_GRADIENT}       — vocabulary x formality for `crude`
 *      speakers only (3), from euphemism through mild oath to open swearing.
 *
 * Culture reaches the voice through {@link deriveCultureFamily}: a matched culture
 * (nautical, criminal, clergy, military, mercantile, arcane, noble, agrarian,
 * artisan) replaces the dialect tic bank with its own, so two rural casual
 * speakers from a temple and a farm sound like different people.
 *
 * CULTURE LEXICON (agora-db71.17): the deferred fourth layer is now in place.
 * `SpeechProfile` carries a `cultureFamily` field, so {@link applySpeechProfile}
 * — which receives the profile and nothing else — can reach
 * {@link CULTURE_LEXICON} for the jargon a culture puts in a speaker's mouth.
 * Culture is therefore carried by BOTH tics and word choice now, and the union
 * type moved to `src/types/dialogue.ts` (re-exported below) so the field could be
 * typed without a circular import.
 */

import type {
  SpeechProfile,
  SpeechCultureFamily,
  SpeechDialectTag,
  SpeechFormality,
  SpeechSentenceLength,
  SpeechVocabularyLevel,
} from '../../types/dialogue.js';
import { createSeededRandom } from '../../utils/random/seededRandom.js';

// ---------------------------------------------------------------------------
// 1. Preset profiles
// ---------------------------------------------------------------------------

/**
 * Five distinct starting fingerprints. They intentionally span every axis so the
 * generator has a recognizable target for the common role/biome combinations, and
 * so the proof test can show five visibly different renderings of one line.
 */
export const SPEECH_PROFILE_PRESETS: Record<string, SpeechProfile> = {
  'coastal-sailor': {
    id: 'coastal-sailor',
    label: 'Harbor hand',
    vocabularyLevel: 'common',
    formality: 'casual',
    dialectTag: 'coastal',
    verbalTics: ['aye', 'mind you'],
    sentenceLength: 'medium',
  },
  'mountain-guard': {
    id: 'mountain-guard',
    label: 'Highland watchman',
    vocabularyLevel: 'crude',
    formality: 'gruff',
    dialectTag: 'mountain',
    verbalTics: ['hmm', 'right'],
    sentenceLength: 'short',
  },
  'urban-scholar': {
    id: 'urban-scholar',
    label: 'City sage',
    vocabularyLevel: 'scholarly',
    formality: 'formal',
    dialectTag: 'urban',
    verbalTics: ['indeed', 'you understand'],
    sentenceLength: 'long',
  },
  'rural-farmer': {
    id: 'rural-farmer',
    label: 'Field folk',
    vocabularyLevel: 'common',
    formality: 'casual',
    dialectTag: 'rural',
    verbalTics: ['well now', 'reckon'],
    sentenceLength: 'medium',
  },
  'urban-cutpurse': {
    id: 'urban-cutpurse',
    label: 'Alley runner',
    vocabularyLevel: 'crude',
    formality: 'casual',
    dialectTag: 'urban',
    verbalTics: ['look', 'yeah'],
    sentenceLength: 'short',
  },
};

/** Stable list of the five starting fingerprints, in declaration order. */
export const SPEECH_PROFILE_PRESET_IDS = Object.keys(SPEECH_PROFILE_PRESETS);

// ---------------------------------------------------------------------------
// 2. Generation from role + biome + culture
// ---------------------------------------------------------------------------

/** Inputs the generator uses to derive a profile. Every field is optional but `seed`. */
export interface SpeechProfileInput {
  /** Functional NPC role, as on `NPC['role']`. */
  role?: string;
  /** Biome id or biome family (e.g. `coastal`, `mountain`, `plains`). */
  biomeId?: string;
  /**
   * Culture hint. Accepts a settlement/culture id, a background id (`sage`,
   * `criminal`, ...) or a free-form tag; matching is substring-based on purpose so
   * callers can pass whatever identifier they already hold.
   */
  cultureId?: string;
  /** Character background id, when known separately from `cultureId`. */
  backgroundId?: string;
  /** Deterministic seed — pass the NPC id so a given NPC always sounds the same. */
  seed?: string;
}

const COASTAL_BIOME_HINTS = ['coast', 'ocean', 'sea', 'beach', 'harbor', 'harbour', 'aquatic', 'reef', 'marsh', 'swamp', 'island'];
const MOUNTAIN_BIOME_HINTS = ['mountain', 'hill', 'peak', 'alpine', 'tundra', 'volcanic', 'cave', 'underdark', 'highland'];
const URBAN_BIOME_HINTS = ['city', 'urban', 'town', 'settlement', 'metropolis', 'district'];

const SCHOLARLY_CULTURE_HINTS = ['sage', 'acolyte', 'noble', 'scholar', 'scribe', 'wizard', 'cleric', 'academy', 'temple', 'librar'];
const CRUDE_CULTURE_HINTS = ['criminal', 'urchin', 'soldier', 'sailor', 'pirate', 'mercenary', 'bandit', 'miner', 'thug', 'thieves'];

function matches(haystack: string, hints: string[]): boolean {
  return hints.some(hint => haystack.includes(hint));
}

/** Maps biome/culture hints onto one of the four dialect tags. */
export function deriveDialectTag(biomeId?: string, cultureId?: string): SpeechDialectTag {
  const biome = (biomeId ?? '').toLowerCase();
  const culture = (cultureId ?? '').toLowerCase();
  if (matches(biome, COASTAL_BIOME_HINTS) || matches(culture, ['coastal', 'sailor', 'pirate', 'harbor', 'harbour'])) {
    return 'coastal';
  }
  if (matches(biome, MOUNTAIN_BIOME_HINTS) || matches(culture, ['mountain', 'dwarv', 'highland'])) {
    return 'mountain';
  }
  if (matches(biome, URBAN_BIOME_HINTS) || matches(culture, URBAN_BIOME_HINTS)) {
    return 'urban';
  }
  return 'rural';
}

/** Role drives register: guards bark, quest givers and uniques perform, the rest chat. */
export function deriveFormality(role?: string, cultureId?: string): SpeechFormality {
  const culture = (cultureId ?? '').toLowerCase();
  if (matches(culture, ['noble', 'court', 'temple', 'acolyte', 'sage'])) return 'formal';
  switch (role) {
    case 'guard':
      return 'gruff';
    case 'quest_giver':
    case 'unique':
      return 'formal';
    default:
      return 'casual';
  }
}

/** Background/culture drives word choice; role only breaks ties. */
export function deriveVocabularyLevel(cultureId?: string, backgroundId?: string, role?: string): SpeechVocabularyLevel {
  const blob = `${cultureId ?? ''} ${backgroundId ?? ''}`.toLowerCase();
  if (matches(blob, SCHOLARLY_CULTURE_HINTS)) return 'scholarly';
  if (matches(blob, CRUDE_CULTURE_HINTS)) return 'crude';
  if (role === 'guard') return 'crude';
  return 'common';
}

/** Register implies pacing: barked orders are short, formal exposition runs long. */
export function deriveSentenceLength(formality: SpeechFormality, vocabulary: SpeechVocabularyLevel): SpeechSentenceLength {
  if (formality === 'gruff') return 'short';
  if (formality === 'formal' && vocabulary === 'scholarly') return 'long';
  if (vocabulary === 'crude') return 'short';
  return 'medium';
}

/**
 * Culture families (agora-3c98). Nine professional/social cultures that cut
 * across the four geographic dialects.
 *
 * Dialect answers "where are they from"; culture answers "who raised them and
 * what do they do all day". Two rural casual speakers — one from a temple, one
 * from a farm — share every axis the original model had and should not sound the
 * same. `null` is a real answer: most villagers belong to no distinct speech
 * culture and keep their dialect's tics.
 *
 * The union itself now lives in `src/types/dialogue.ts` beside the other speech
 * axes, so `SpeechProfile.cultureFamily` can be typed without this module and
 * that one importing each other. Re-exported here because that is where every
 * existing importer looks for it.
 */
export type { SpeechCultureFamily };

/**
 * Substring hints per culture, matched against `cultureId` + `backgroundId` +
 * `role`. Ordered most-specific-first in {@link deriveCultureFamily}, because a
 * temple guard is a guard and a temple, and the temple is the thing that shaped
 * how they talk.
 */
const CULTURE_FAMILY_HINTS: Record<SpeechCultureFamily, string[]> = {
  clergy: ['acolyte', 'priest', 'cleric', 'temple', 'shrine', 'monk', 'abbey', 'oracle', 'devout'],
  arcane: ['wizard', 'sage', 'scholar', 'scribe', 'academy', 'librar', 'mage', 'sorcer', 'warlock', 'alchem'],
  noble: ['noble', 'court', 'baron', 'duke', 'duchess', 'lord', 'lady', 'heir', 'patrician'],
  criminal: ['criminal', 'thief', 'thieves', 'urchin', 'smuggler', 'bandit', 'cutpurse', 'thug', 'fence'],
  military: ['soldier', 'guard', 'watch', 'legion', 'garrison', 'mercenary', 'knight', 'warden', 'sergeant'],
  nautical: ['sailor', 'pirate', 'harbor', 'harbour', 'dock', 'fisher', 'ferry', 'mariner', 'shipwright'],
  mercantile: ['merchant', 'trader', 'shop', 'caravan', 'guild', 'banker', 'broker', 'peddler', 'innkeep'],
  artisan: ['smith', 'mason', 'carpenter', 'weaver', 'tanner', 'potter', 'miner', 'brewer', 'baker'],
  agrarian: ['farm', 'field', 'shepherd', 'herd', 'orchard', 'miller', 'hunter', 'forester', 'villager'],
};

/**
 * Priority order. Vocation-of-the-soul before vocation-of-the-day: what a person
 * was formed by outranks what they happen to be doing when the player meets them.
 */
const CULTURE_FAMILY_PRIORITY: SpeechCultureFamily[] = [
  'clergy',
  'arcane',
  'noble',
  'criminal',
  'military',
  'nautical',
  'mercantile',
  'artisan',
  'agrarian',
];

/**
 * Resolves the culture family for an NPC, or `null` when nothing matches.
 *
 * Matching is substring-based on the same permissive contract as
 * {@link deriveDialectTag}: callers pass whatever identifier they already hold
 * (a settlement id, a background id, a free-form tag) and the first hint that
 * appears anywhere in it wins.
 */
export function deriveCultureFamily(
  cultureId?: string,
  backgroundId?: string,
  role?: string
): SpeechCultureFamily | null {
  const blob = `${cultureId ?? ''} ${backgroundId ?? ''} ${role ?? ''}`.toLowerCase();
  if (blob.trim().length === 0) return null;
  for (const family of CULTURE_FAMILY_PRIORITY) {
    if (matches(blob, CULTURE_FAMILY_HINTS[family])) return family;
  }
  return null;
}

/**
 * Culture tic banks. Two tics per culture per register, the same shape the
 * dialect bank uses, so the generator can substitute one for the other without
 * any other code path knowing the difference.
 *
 * Tics are the one culture-shaped thing that survives into
 * {@link applySpeechProfile}, because `SpeechProfile.verbalTics` is a free string
 * list while the lexicon layers are keyed by fields the type already fixes.
 */
const CULTURE_TIC_BANK: Record<SpeechCultureFamily, Record<SpeechFormality, string[]>> = {
  nautical: {
    formal: ['by the tide', 'you understand'],
    casual: ['aye', 'mark me'],
    gruff: ['aye', 'step lively'],
  },
  criminal: {
    formal: ['between us', 'naturally'],
    casual: ['see', 'nothing personal'],
    gruff: ['look', 'walk on'],
  },
  clergy: {
    formal: ['by the light', 'be at peace'],
    casual: ['bless you', 'as it happens'],
    gruff: ['hmph', 'mind yourself'],
  },
  military: {
    formal: ['as ordered', 'understood'],
    casual: ['right then', 'no trouble'],
    gruff: ['move along', 'state it'],
  },
  mercantile: {
    formal: ['at your service', 'if it please you'],
    casual: ['fair enough', 'that is the price'],
    gruff: ['coin first', 'well'],
  },
  arcane: {
    formal: ['you understand', 'precisely so'],
    casual: ['curious', 'as it were'],
    gruff: ['hmm', 'be brief'],
  },
  noble: {
    formal: ['quite', 'one imagines'],
    casual: ['naturally', 'do go on'],
    gruff: ['enough', 'quite'],
  },
  agrarian: {
    formal: ['if you please', 'indeed'],
    casual: ['well now', 'reckon'],
    gruff: ['hmph', 'aye, well'],
  },
  artisan: {
    formal: ['to my eye', 'indeed'],
    casual: ['mind the joins', 'right'],
    gruff: ['hmm', 'that is the work'],
  },
};

/** Tic banks, keyed by dialect then formality, so the same dialect still varies by register. */
const TIC_BANK: Record<SpeechDialectTag, Record<SpeechFormality, string[]>> = {
  coastal: {
    formal: ['aye', 'you understand'],
    casual: ['aye', 'mind you'],
    gruff: ['aye', 'move along'],
  },
  mountain: {
    formal: ['indeed', 'by the stone'],
    casual: ['aye', 'well now'],
    gruff: ['hmm', 'right'],
  },
  urban: {
    formal: ['indeed', 'you understand'],
    casual: ['look', 'yeah'],
    gruff: ['look', 'right'],
  },
  rural: {
    formal: ['indeed', 'if you please'],
    casual: ['well now', 'reckon'],
    gruff: ['hmph', 'right'],
  },
};

/**
 * Builds a `SpeechProfile` from role + biome + culture. Deterministic for a given
 * `seed`, so an NPC keeps one voice across sessions without persisting anything
 * beyond the profile itself.
 */
export function generateSpeechProfile(input: SpeechProfileInput = {}): SpeechProfile {
  const dialectTag = deriveDialectTag(input.biomeId, input.cultureId);
  const formality = deriveFormality(input.role, input.cultureId);
  const vocabularyLevel = deriveVocabularyLevel(input.cultureId, input.backgroundId, input.role);
  const sentenceLength = deriveSentenceLength(formality, vocabularyLevel);
  const cultureFamily = deriveCultureFamily(input.cultureId, input.backgroundId, input.role);

  // A matched culture replaces the dialect tics outright rather than mixing with
  // them. Mixing produced speakers who said "aye" and "by the light" in the same
  // breath, which reads as two characters rather than one.
  const bank = cultureFamily
    ? CULTURE_TIC_BANK[cultureFamily][formality]
    : TIC_BANK[dialectTag][formality];
  const rand = createSeededRandom(
    1,
    undefined,
    `${input.seed ?? 'npc'}|${dialectTag}|${formality}|${cultureFamily ?? 'none'}`
  );
  // Always keep two tics so the post-processor can alternate; the roll only decides
  // which one leads, which is enough to stop a whole town opening with "Aye".
  const flip = rand() > 0.5;
  const verbalTics = flip ? [bank[1], bank[0]] : [bank[0], bank[1]];

  return {
    id: cultureFamily
      ? `${dialectTag}-${formality}-${vocabularyLevel}-${cultureFamily}`
      : `${dialectTag}-${formality}-${vocabularyLevel}`,
    label: cultureFamily ? `${cultureFamily} ${formality}` : `${dialectTag} ${formality}`,
    vocabularyLevel,
    formality,
    dialectTag,
    verbalTics,
    sentenceLength,
    // Recorded on the profile (agora-db71.17) so the post-processor can reach the
    // culture jargon bank. `deriveCultureFamily` returns null for most villagers;
    // the field is left absent in that case rather than stored as null, so an
    // older profile and a culture-less new one behave identically.
    ...(cultureFamily ? { cultureFamily } : {}),
  };
}

// ---------------------------------------------------------------------------
// 3. Post-processing raw dialogue
// ---------------------------------------------------------------------------

/**
 * Dialect word swaps. Applied first so later banks see dialect-native wording.
 *
 * Every bank avoids the handful of words the layers above it depend on — a
 * dialect that rewrote `get` would starve the scholarly bank of the word it
 * elevates to `obtain`, and the elevation is the point of that bank.
 */
const DIALECT_LEXICON: Record<SpeechDialectTag, Record<string, string>> = {
  coastal: {
    yes: 'aye',
    no: 'nay',
    very: 'right',
    friend: 'shipmate',
    stranger: 'drifter',
    quickly: 'smart-like',
    road: 'channel',
    // Sea trade turns every noun into a shipping noun.
    house: 'berth',
    town: 'port',
    home: 'home port',
    leave: 'cast off',
    arrive: 'make landfall',
    wait: 'ride it out',
    danger: 'foul water',
    dangerous: 'foul',
    storm: 'blow',
    work: 'graft',
    boss: 'skipper',
    captain: 'skipper',
    food: 'rations',
    drink: 'grog',
    tired: 'dog-tired',
    lost: 'adrift',
    ready: 'shipshape',
    ruined: 'holed',
    rumor: 'dock talk',
    news: 'word off the water',
  },
  mountain: {
    yes: 'aye',
    no: 'nay',
    very: 'awful',
    friend: 'kin',
    stranger: 'outsider',
    quickly: 'quick',
    child: 'wean',
    // Stone, weather and distance do the work of adjectives up here.
    house: 'hold',
    town: 'hold',
    home: 'hearth',
    hard: 'stone-hard',
    cold: 'bitter',
    strong: 'stout',
    weak: 'thin',
    tired: 'worn through',
    lost: 'off the path',
    danger: 'bad ground',
    dangerous: 'bad ground to walk',
    storm: 'weather',
    food: 'victuals',
    drink: 'a dram',
    work: 'labour',
    promise: 'word on the stone',
    rumor: 'talk at the fire',
    news: 'word down the pass',
  },
  urban: {
    very: 'terribly',
    friend: 'associate',
    stranger: 'newcomer',
    quickly: 'sharpish',
    // City speech is transactional: people become parties, favours become terms.
    house: 'residence',
    town: 'the city',
    home: 'lodgings',
    work: 'business',
    job: 'commission',
    deal: 'arrangement',
    trouble: 'complication',
    problem: 'complication',
    danger: 'exposure',
    dangerous: 'exposed',
    rumor: 'word on the street',
    news: 'word on the street',
    tired: 'run ragged',
    lost: 'turned around',
    ready: 'in order',
    ruined: 'finished',
  },
  rural: {
    yes: 'aye',
    no: 'nope',
    very: 'powerful',
    friend: 'neighbor',
    stranger: 'newcomer',
    quickly: 'right quick',
    // Farm speech measures things in seasons, weather and livestock.
    house: 'place',
    town: 'the village',
    home: 'the homestead',
    work: 'chores',
    hard: 'hard going',
    tired: 'wore out',
    lost: 'turned around',
    danger: 'trouble',
    dangerous: 'chancy',
    storm: 'a blow coming',
    food: 'supper',
    drink: 'cider',
    ready: 'set',
    ruined: 'spoilt',
    rumor: 'talk at market',
    news: 'word from market',
  },
};

/**
 * Dialect x formality banks (agora-3c98). The second layer, and the reason the
 * four dialect tags yield twelve recognizable voices rather than four.
 *
 * A dialect says WHERE a speaker is from; a register says what that place does to
 * them when they are being careful, being ordinary, or being blunt. The
 * harbourmaster and the deckhand share `coastal` and share nothing else.
 *
 * Applied immediately after the dialect bank, so these entries may deliberately
 * overwrite a dialect swap for the register that would not use it.
 */
const DIALECT_REGISTER_LEXICON: Record<SpeechDialectTag, Record<SpeechFormality, Record<string, string>>> = {
  coastal: {
    formal: { aye: 'indeed', grog: 'drink', graft: 'labour', skipper: 'the master of the vessel' },
    casual: { hello: 'ahoy', goodbye: 'fair winds', maybe: 'happen so' },
    gruff: { hello: 'ahoy', goodbye: 'off with you', maybe: 'happen', 'shipmate': 'deckhand' },
  },
  mountain: {
    formal: { aye: 'indeed', 'a dram': 'a measure', labour: 'toil' },
    casual: { hello: 'well met', goodbye: 'safe paths', maybe: 'could be' },
    gruff: { hello: 'speak', goodbye: 'go on', maybe: 'could be', kin: 'my own' },
  },
  urban: {
    formal: { 'word on the street': 'a matter of common report', complication: 'difficulty' },
    casual: { hello: 'hey', goodbye: 'see you about', maybe: 'could be', associate: 'mate' },
    gruff: { hello: 'what', goodbye: 'move along', maybe: 'no promises', associate: 'you' },
  },
  rural: {
    formal: { aye: 'indeed', chores: 'labour', supper: 'the evening meal' },
    casual: { hello: 'howdy', goodbye: 'mind how you go', maybe: 'reckon so' },
    gruff: { hello: 'aye, what', goodbye: 'off you go', maybe: 'reckon not' },
  },
};

/** Vocabulary-level word swaps, layered on top of the dialect bank. */
const VOCABULARY_LEXICON: Record<SpeechVocabularyLevel, Record<string, string>> = {
  scholarly: {
    yes: 'indeed',
    get: 'obtain',
    need: 'require',
    big: 'considerable',
    lots: 'a great deal',
    money: 'coin of the realm',
    help: 'aid',
    ask: 'enquire',
    think: 'surmise',
    // A scholar reaches for the precise word even when the plain one would do.
    show: 'demonstrate',
    tell: 'relate',
    find: 'locate',
    start: 'commence',
    end: 'conclude',
    buy: 'purchase',
    use: 'employ',
    fix: 'remedy',
    broken: 'defective',
    strange: 'singular',
    wrong: 'erroneous',
    true: 'veracious',
    maybe: 'conceivably',
    'a lot': 'a great deal',
    guess: 'conjecture',
    book: 'volume',
    story: 'account',
  },
  common: {},
  crude: {
    yes: 'yeah',
    terribly: 'dead',
    excellent: 'bloody good',
    person: 'sod',
    money: 'coin',
    assistance: 'help',
    obtain: 'grab',
    require: 'want',
    unfortunate: 'rotten',
    // Plain words, short words, and no word chosen for its politeness.
    demonstrate: 'show',
    purchase: 'buy',
    employ: 'use',
    remedy: 'sort out',
    defective: 'busted',
    singular: 'odd',
    erroneous: 'wrong',
    conceivably: 'maybe',
    considerable: 'big',
    residence: 'gaff',
    difficult: 'hard',
    extremely: 'dead',
    certainly: 'too right',
    immediately: 'now',
    understand: 'get it',
    depart: 'clear off',
    consume: 'eat',
  },
};

/**
 * Profanity gradient for `crude` speakers (agora-3c98). The third lexicon layer,
 * and the only one gated on two axes at once.
 *
 * A crude vocabulary is not a fixed amount of swearing. The same dock worker
 * softens to euphemism in front of a magistrate, curses mildly among neighbours,
 * and swears outright at someone in their way — so the gradient is keyed by
 * formality, not by vocabulary alone. Speakers with a `common` or `scholarly`
 * vocabulary never reach this bank at all.
 *
 * The oaths are in-world (blazes, the gods, the bilge) rather than modern, so
 * the strongest register still reads as fantasy dialogue.
 */
const PROFANITY_GRADIENT: Record<SpeechFormality, Record<string, string>> = {
  // Rung 1 — a crude speaker minding their manners. Oaths become euphemisms.
  formal: {
    damn: 'confound',
    damned: 'confounded',
    hell: 'blazes',
    bloody: 'blasted',
    'shut up': 'say no more',
    idiot: 'poor fellow',
    rubbish: 'nonsense',
  },
  // Rung 2 — ordinary company. Mild oaths, nothing that would empty a room.
  casual: {
    darn: 'damn',
    heck: 'hell',
    'oh no': 'oh hells',
    nonsense: 'rubbish',
    annoying: 'damned',
    idiot: 'fool',
    ruined: 'wrecked',
    'very bad': 'rotten',
  },
  // Rung 3 — nobody left to impress.
  gruff: {
    darn: 'bloody',
    damn: 'gods-damn',
    damned: 'gods-damned',
    heck: 'hell',
    nonsense: 'bilge',
    rubbish: 'bilge',
    annoying: 'sodding',
    idiot: 'clod',
    fool: 'clod',
    'go away': 'sod off',
    'be quiet': 'shut it',
  },
};

/**
 * Culture jargon banks (agora-db71.17) — the fourth lexicon layer, and the one
 * this module recorded as deferred until `SpeechProfile` could carry a
 * `cultureFamily`.
 *
 * WHY THESE WORDS. Every key is a plain, culture-neutral noun that none of the
 * three layers above keys: `plan`, `group`, `meeting`, `payment`, `agreement`,
 * `leader`, `luck`, `mistake`, `death`. That is deliberate — a culture does not
 * change how you say "yes", it changes what you call the thing you are all here
 * to do. Two rural casual speakers, one from a temple and one from a farm, now
 * differ in nouns as well as tics.
 *
 * WHY IT RUNS LAST. The dialect and vocabulary layers are ordered earliest-wins
 * on purpose, so a later bank can sharpen an earlier bank's choice. Culture is
 * the opposite case: `course`, `orders` and `providence` are the most specific
 * words in the sentence and nothing should be allowed to flatten them back, so
 * the culture bank runs after every other lexicon and its output is final.
 */
const CULTURE_LEXICON: Record<SpeechCultureFamily, Record<string, string>> = {
  nautical: {
    plan: 'course',
    group: 'crew',
    agreement: 'articles',
    meeting: 'muster',
    luck: 'fair winds',
  },
  criminal: {
    plan: 'lift',
    group: 'crew',
    agreement: 'arrangement',
    payment: 'cut',
    leader: 'boss',
  },
  clergy: {
    luck: 'providence',
    death: 'the long rest',
    meeting: 'vigil',
    mistake: 'sin',
    leader: 'shepherd',
  },
  military: {
    plan: 'orders',
    group: 'unit',
    meeting: 'muster',
    leader: 'commander',
    mistake: 'a lapse of discipline',
  },
  mercantile: {
    plan: 'venture',
    agreement: 'contract',
    payment: 'settlement',
    group: 'company',
    mistake: 'a loss',
  },
  arcane: {
    plan: 'working',
    mistake: 'a miscalculation',
    meeting: 'colloquy',
    group: 'circle',
    luck: 'coincidence',
  },
  noble: {
    plan: 'design',
    agreement: 'accord',
    meeting: 'audience',
    group: 'house',
    payment: 'settlement',
  },
  agrarian: {
    plan: 'the work ahead',
    group: 'kin',
    meeting: 'market day',
    luck: 'weather',
    payment: 'trade',
  },
  artisan: {
    plan: 'commission',
    group: 'shop',
    mistake: 'a flaw',
    payment: 'fee',
    meeting: 'guild night',
  },
};

/** Formal speech expands contractions; gruff speech contracts and drops courtesies. */
const CONTRACTION_EXPANSIONS: Record<string, string> = {
  "don't": 'do not',
  "won't": 'will not',
  "can't": 'cannot',
  "isn't": 'is not',
  "it's": 'it is',
  "i'm": 'I am',
  "you're": 'you are',
  "we're": 'we are',
  "there's": 'there is',
  "that's": 'that is',
  "i'll": 'I will',
  "you'll": 'you will',
};

const CONTRACTION_CONTRACTIONS: Record<string, string> = {
  'do not': "don't",
  'will not': "won't",
  'cannot': "can't",
  'is not': "isn't",
  'it is': "it's",
  'i am': "I'm",
  'you are': "you're",
};

/** Courtesy padding a gruff speaker never bothers with. */
const GRUFF_STRIP_PATTERNS: RegExp[] = [
  /\bif you would be so kind,?\s*/gi,
  /\bif you please,?\s*/gi,
  /\bi would like to\b/gi,
  /\bi should very much like to\b/gi,
  /\bplease,?\s*/gi,
  /\bkindly\s*/gi,
  /\bperhaps\s*/gi,
];

/** Tics that read as their own beat rather than a trailing tag. */
const STANDALONE_TICS = new Set(['hmm', 'hmph', 'well now', 'look', 'right', 'move along']);

/**
 * Case-preserving whole-word replacement. `Very` -> `Right`, `very` -> `right`.
 * Escapes the search term so lexicon entries can safely contain punctuation.
 */
function replaceWord(text: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
  return text.replace(pattern, match => {
    if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
      return to.charAt(0).toUpperCase() + to.slice(1);
    }
    return to;
  });
}

/** Whole-word, case-insensitive containment test. */
function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function applyLexicon(text: string, lexicon: Record<string, string>): string {
  let out = text;
  for (const [from, to] of Object.entries(lexicon)) {
    out = replaceWord(out, from, to);
  }
  return out;
}

/** Splits into sentences, keeping terminal punctuation with its sentence. */
function splitSentences(text: string): string[] {
  const matched = text.match(/[^.!?]+[.!?]*/g);
  if (!matched) return [];
  return matched.map(s => s.trim()).filter(Boolean);
}

function wordCount(sentence: string): number {
  return sentence.split(/\s+/).filter(Boolean).length;
}

function terminalPunctuation(sentence: string): string {
  const last = sentence.slice(-1);
  return '.!?'.includes(last) ? last : '.';
}

function stripTerminalPunctuation(sentence: string): string {
  return sentence.replace(/[.!?]+$/, '').trim();
}

function capitalizeFirst(sentence: string): string {
  if (!sentence) return sentence;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Reshapes pacing WITHOUT dropping content: `short` breaks long sentences at clause
 * boundaries into separate sentences, `long` fuses adjacent short sentences. Nothing
 * is truncated, so an NPC never silently swallows a quest hook.
 */
function reshapeSentences(sentences: string[], preference: SpeechSentenceLength): string[] {
  if (preference === 'medium') return sentences;

  if (preference === 'short') {
    const out: string[] = [];
    for (const sentence of sentences) {
      const punct = terminalPunctuation(sentence);
      let body = stripTerminalPunctuation(sentence);
      // Break at the first clause boundary past a four-word head, repeatedly, so a
      // rambling model answer becomes a series of clipped statements.
      let guard = 0;
      while (wordCount(body) > 9 && guard < 6) {
        guard += 1;
        const boundary = /,\s+|\s+(?:and|but|because|so|which|while|though)\s+/gi;
        let cut = -1;
        let match: RegExpExecArray | null;
        while ((match = boundary.exec(body)) !== null) {
          const head = body.slice(0, match.index);
          if (wordCount(head) >= 4) { cut = match.index; break; }
        }
        if (cut < 0) break;
        const head = body.slice(0, cut).trim();
        const tail = body.slice(boundary.lastIndex).trim();
        if (!head || !tail) break;
        out.push(`${capitalizeFirst(head)}.`);
        body = tail;
      }
      out.push(`${capitalizeFirst(body)}${punct}`);
    }
    return out;
  }

  // 'long': fuse neighbouring short sentences into a single flowing period.
  const out: string[] = [];
  let i = 0;
  while (i < sentences.length) {
    const current = sentences[i];
    const next = sentences[i + 1];
    if (next && wordCount(current) <= 14 && wordCount(next) <= 14 && terminalPunctuation(current) === '.') {
      const head = stripTerminalPunctuation(current);
      const tail = stripTerminalPunctuation(next);
      out.push(`${capitalizeFirst(head)}, and ${tail.charAt(0).toLowerCase()}${tail.slice(1)}${terminalPunctuation(next)}`);
      i += 2;
    } else {
      out.push(current);
      i += 1;
    }
  }
  return out;
}

/**
 * Threads verbal tics through the sentence list. Standalone tics ("Hmm.") become
 * their own beat; tag tics ("..., aye.") ride the end of a sentence. Placement is
 * fixed-cadence rather than random so the same input always yields the same output.
 */
function injectTics(sentences: string[], profile: SpeechProfile): string[] {
  const tics = profile.verbalTics.filter(Boolean);
  if (tics.length === 0 || sentences.length === 0) return sentences;

  // Gruff speakers punctuate almost every line; everyone else every other line.
  const cadence = profile.formality === 'gruff' ? 1 : 2;
  const out: string[] = [];
  let ticIndex = 0;

  sentences.forEach((sentence, index) => {
    if (index % cadence !== 0) {
      out.push(sentence);
      return;
    }
    const tic = tics[ticIndex % tics.length];
    ticIndex += 1;
    // A dialect swap can already have put the tic into the line ("Yes" -> "Aye").
    // Adding it again reads as a stutter, so skip injection when it is already there.
    if (containsWord(sentence, tic)) {
      out.push(sentence);
      return;
    }
    if (STANDALONE_TICS.has(tic.toLowerCase())) {
      out.push(`${capitalizeFirst(tic)}.`);
      out.push(sentence);
    } else {
      const punct = terminalPunctuation(sentence);
      out.push(`${stripTerminalPunctuation(sentence)}, ${tic}${punct}`);
    }
  });

  return out;
}

/**
 * Transforms raw dialogue text so it matches `profile`.
 *
 * Order matters: dialect swaps -> dialect-by-register swaps -> vocabulary swaps ->
 * profanity gradient (crude speakers only) -> culture jargon -> register mechanics
 * (contractions and courtesy padding) -> sentence reshaping -> tic injection.
 * Reversing any pair would let a later bank overwrite an earlier one's word choice,
 * which is exactly why culture sits last among the lexicons: its words are the most
 * specific in the sentence and nothing above it may flatten them back.
 *
 * Returns the input unchanged when there is no profile or no text, so every call
 * site can pass through unconditionally.
 */
export function applySpeechProfile(text: string, profile?: SpeechProfile | null): string {
  if (!profile || typeof text !== 'string' || text.trim().length === 0) return text;

  let out = applyLexicon(text, DIALECT_LEXICON[profile.dialectTag] ?? {});
  // Second dialect layer: what this register does to that dialect.
  out = applyLexicon(out, DIALECT_REGISTER_LEXICON[profile.dialectTag]?.[profile.formality] ?? {});
  out = applyLexicon(out, VOCABULARY_LEXICON[profile.vocabularyLevel] ?? {});
  if (profile.vocabularyLevel === 'crude') {
    // Only a crude speaker swears, and how hard depends on the register they are
    // in. Runs after the vocabulary bank so it can sharpen a word that bank just
    // chose (`rubbish` -> `bilge` for a gruff speaker).
    out = applyLexicon(out, PROFANITY_GRADIENT[profile.formality] ?? {});
  }
  if (profile.cultureFamily) {
    // Fourth layer: the jargon of the culture that raised this speaker. Absent on
    // a culture-less profile and on every profile written before the field
    // existed, in which case the voice is exactly what it was.
    out = applyLexicon(out, CULTURE_LEXICON[profile.cultureFamily] ?? {});
  }

  if (profile.formality === 'formal') {
    out = applyLexicon(out, CONTRACTION_EXPANSIONS);
  } else if (profile.formality === 'gruff') {
    out = applyLexicon(out, CONTRACTION_CONTRACTIONS);
    for (const pattern of GRUFF_STRIP_PATTERNS) {
      out = out.replace(pattern, '');
    }
    out = out.replace(/\s{2,}/g, ' ').trim();
  }

  const sentences = injectTics(reshapeSentences(splitSentences(out), profile.sentenceLength), profile);
  const joined = sentences.map(capitalizeFirst).join(' ').replace(/\s{2,}/g, ' ').trim();
  return joined.length > 0 ? joined : out.trim();
}

/**
 * One-line instruction appended to an NPC's system prompt so the model aims at the
 * same voice the post-processor enforces. Cheap alignment: if the model complies,
 * the post-processor has less to do; if it does not, the output still lands.
 */
export function describeSpeechProfile(profile?: SpeechProfile | null): string {
  if (!profile) return '';
  const tics = profile.verbalTics.length > 0 ? ` Occasionally use the verbal tics: ${profile.verbalTics.join(', ')}.` : '';
  // Culture is named to the model as well as enforced by CULTURE_LEXICON, on the
  // same cheap-alignment principle as the rest of this hint.
  const culture = profile.cultureFamily ? ` Reach for ${profile.cultureFamily} turns of phrase.` : '';
  return `Speak with ${profile.vocabularyLevel} vocabulary in a ${profile.formality} register, with a ${profile.dialectTag} dialect and ${profile.sentenceLength} sentences.${culture}${tics}`;
}
