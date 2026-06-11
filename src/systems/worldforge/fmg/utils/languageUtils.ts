/**
 * @file utils/languageUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/languageUtils.ts. See
 * ../ATTRIBUTION.md.
 *
 * Ported: isVowel, trimVowels, getAdjective, abbreviate — all four are drawn
 * on by the civilization stages (names, state forms, campaigns, religion
 * names, culture/religion codes).
 *
 * RNG NOTE: getAdjective draws P(rule.probability) PER RULE while scanning
 * the rule list (rules with probability 1 short-circuit inside P without
 * drawing). The rule order and probabilities are part of the seeded stream —
 * do not reorder.
 *
 * Stripped (no RNG): `nth` (UI strings), `list` (Intl.ListFormat, DOM lang).
 */
import { last } from "./arrayUtils";
import { P } from "./probabilityUtils";

/**
 * Check if character is a vowel
 * @param c - The character to check.
 * @returns True if the character is a vowel, false otherwise.
 */
export const isVowel = (c: string): boolean => {
  const VOWELS = `aeiouyɑ'əøɛœæɶɒɨɪɔɐʊɤɯаоиеёэыуюяàèìòùỳẁȁȅȉȍȕáéíóúýẃőűâêîôûŷŵäëïöüÿẅãẽĩõũỹąęįǫųāēīōūȳăĕĭŏŭǎěǐǒǔȧėȯẏẇạẹịọụỵẉḛḭṵṳ`;
  return VOWELS.includes(c);
};

/**
 * Remove trailing vowels from a string until it reaches a minimum length.
 * @param string - The input string.
 * @param minLength - The minimum length of the string after trimming (default is 3).
 * @returns The trimmed string.
 */
export const trimVowels = (string: string, minLength: number = 3) => {
  while (string.length > minLength && isVowel(last(Array.from(string)))) {
    string = string.slice(0, -1);
  }
  return string;
};

/**
 * Get adjective form of a noun based on predefined rules.
 * @param noun - The noun to be converted to an adjective.
 * @returns The adjective form of the noun.
 */
export const getAdjective = (nounToBeAdjective: string) => {
  const adjectivizationRules: {
    name: string;
    probability: number;
    condition: RegExp;
    action: (noun: string) => string;
  }[] = [
    {
      name: "guo",
      probability: 1,
      condition: / Guo$/,
      action: (noun: string) => noun.slice(0, -4),
    },
    {
      name: "orszag",
      probability: 1,
      condition: /orszag$/,
      action: (noun: string) => (noun.length < 9 ? `${noun}ian` : noun.slice(0, -6)),
    },
    {
      name: "stan",
      probability: 1,
      condition: /stan$/,
      action: (noun: string) => (noun.length < 9 ? `${noun}i` : trimVowels(noun.slice(0, -4))),
    },
    {
      name: "land",
      probability: 1,
      condition: /land$/,
      action: (noun: string) => {
        if (noun.length > 9) return noun.slice(0, -4);
        const root = trimVowels(noun.slice(0, -4), 0);
        if (root.length < 3) return `${noun}ic`;
        if (root.length < 4) return `${root}lish`;
        return `${root}ish`;
      },
    },
    {
      name: "que",
      probability: 1,
      condition: /que$/,
      action: (noun: string) => noun.replace(/que$/, "can"),
    },
    {
      name: "a",
      probability: 1,
      condition: /a$/,
      action: (noun: string) => `${noun}n`,
    },
    {
      name: "o",
      probability: 1,
      condition: /o$/,
      action: (noun: string) => noun.replace(/o$/, "an"),
    },
    {
      name: "u",
      probability: 1,
      condition: /u$/,
      action: (noun: string) => `${noun}an`,
    },
    {
      name: "i",
      probability: 1,
      condition: /i$/,
      action: (noun: string) => `${noun}an`,
    },
    {
      name: "e",
      probability: 1,
      condition: /e$/,
      action: (noun: string) => `${noun}an`,
    },
    {
      name: "ay",
      probability: 1,
      condition: /ay$/,
      action: (noun: string) => `${noun}an`,
    },
    {
      name: "os",
      probability: 1,
      condition: /os$/,
      action: (noun: string) => {
        const root = trimVowels(noun.slice(0, -2), 0);
        if (root.length < 4) return noun.slice(0, -1);
        return `${root}ian`;
      },
    },
    {
      name: "es",
      probability: 1,
      condition: /es$/,
      action: (noun: string) => {
        const root = trimVowels(noun.slice(0, -2), 0);
        if (root.length > 7) return noun.slice(0, -1);
        return `${root}ian`;
      },
    },
    {
      name: "l",
      probability: 0.8,
      condition: /l$/,
      action: (noun: string) => `${noun}ese`,
    },
    {
      name: "n",
      probability: 0.8,
      condition: /n$/,
      action: (noun: string) => `${noun}ese`,
    },
    {
      name: "ad",
      probability: 0.8,
      condition: /ad$/,
      action: (noun: string) => `${noun}ian`,
    },
    {
      name: "an",
      probability: 0.8,
      condition: /an$/,
      action: (noun: string) => `${noun}ian`,
    },
    {
      name: "ish",
      probability: 0.25,
      condition: /^[a-zA-Z]{6}$/,
      action: (noun: string) => `${trimVowels(noun.slice(0, -1))}ish`,
    },
    {
      name: "an",
      probability: 0.5,
      condition: /^[a-zA-Z]{0,7}$/,
      action: (noun: string) => `${trimVowels(noun)}an`,
    },
  ];
  for (const rule of adjectivizationRules) {
    if (P(rule.probability) && rule.condition.test(nounToBeAdjective)) {
      return rule.action(nounToBeAdjective);
    }
  }
  return nounToBeAdjective; // no rule applied, return noun as is
};

/**
 * Generate an abbreviation for a given name, avoiding restricted codes.
 * @param name - The name to be abbreviated.
 * @param restricted - An array of restricted abbreviations to avoid (default is an empty array).
 * @returns The generated abbreviation.
 */
export const abbreviate = (name: string, restricted: string[] = []) => {
  const parsed = name.replace("Old ", "O ").replace(/[()]/g, ""); // remove Old prefix and parentheses
  const words = parsed.split(" ");
  const letters = words.join("");

  let code = words.length === 2 ? words[0][0] + words[1][0] : letters.slice(0, 2);
  for (let i = 1; i < letters.length - 1 && restricted.includes(code); i++) {
    code = letters[0] + letters[i].toUpperCase();
  }
  return code;
};
