// Shared utility functions for parsing 5eTools monster JSON.
// Imported by all per-category adapter modules.

import { AbilityScoreName } from '../../../types/core';
import { ConditionName } from '../../../types/spells';
import { AbilityEffect, AreaOfEffect } from '../../../types/combat';

/**
 * Recursively extracts plain text from a 5eTools entries value.
 * `entries` can be a string, an array of strings/objects, or a single object.
 * Handles the common nested node types: list, item, entries, inset, table.
 */
export function extractEntryText(entries: any): string {
  if (!entries) return '';
  if (typeof entries === 'string') return entries;
  if (Array.isArray(entries)) {
    return entries.map(extractEntryText).filter(Boolean).join(' ');
  }
  if (typeof entries === 'object') {
    const type = entries.type;
    if (type === 'list' || type === 'entries' || type === 'inset') {
      const header = entries.name ? `${entries.name}: ` : '';
      return header + extractEntryText(entries.items ?? entries.entries ?? []);
    }
    if (type === 'item') {
      const header = entries.name ? `${entries.name}: ` : '';
      return header + extractEntryText(entries.entries ?? '');
    }
    if (type === 'table') {
      // Tables: extract caption and rows if present
      const rows = (entries.rows ?? []).map((r: any) => Array.isArray(r) ? r.join(' | ') : String(r));
      return [entries.caption, ...rows].filter(Boolean).join(' ');
    }
    // Fallback: try to get any text-like fields
    return extractEntryText(entries.entries ?? entries.items ?? '');
  }
  return '';
}

/**
 * 5etools uses a custom markup system with curly-brace tags like:
 *   {@hit 4}        → the attack bonus
 *   {@damage 1d6+2} → the damage dice
 *   {@h}            → a hit indicator (no content)
 *   {@condition Prone|XPHB} → a condition reference with source book
 */
const ABILITY_SHORT_TO_LONG: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

export function strip5eToolsMarkup(text: string): string {
  if (!text) return '';
  return text
    // Attack metadata tags produce no display text: {@atk mw}, {@atkr m}, {@hit 14}, {@h}
    .replace(/\{@atkr?\s[^}]*\}/g, '')
    .replace(/\{@hit\s[^}]*\}/g, '')
    .replace(/\{@h\}/g, '')
    // Saving throw markers: {@actSave dex} → "Dexterity saving throw"
    .replace(/\{@actSave\s+(\w+)[^}]*\}/gi, (_, ability) =>
      `${ABILITY_SHORT_TO_LONG[ability.toLowerCase()] ?? ability} saving throw`
    )
    // DC tags: {@dc 21} → "DC 21"
    .replace(/\{@dc\s+(\d+)\}/gi, 'DC $1')
    // Save outcome markers
    .replace(/\{@actSaveFail\}/g, 'On a failed save,')
    .replace(/\{@actSaveSuccess\}/g, 'On a success,')
    .replace(/\{@actSaveSuccessOrFail\}/g, 'Regardless of the save,')
    // {@tag content|source} → content (first segment before |)
    .replace(/\{@\w+\s+([^|}]+)\|[^}]*\}/g, '$1')
    // {@tag content} → content
    .replace(/\{@\w+\s+([^}]+)\}/g, '$1')
    // {@tag} → ''
    .replace(/\{@\w+\}/g, '')
    // word|source → word
    .replace(/(\w+)\|\w+/g, '$1')
    .replace(/\s+/g, ' ')
    // Strip leading punctuation artifacts left by removed attack-metadata tags
    .replace(/^[\s,;.]+/, '')
    // Strip leading "to hit[,]" artifact left when {@hit N} is stripped before "to hit,"
    .replace(/^to hit[,\s]*/i, '')
    .replace(/^[\s,;.]+/, '') // second pass after "to hit" removal
    .trim();
}

/** Capitalizes the first letter, lowercases the rest. */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * 5etools stores senses as an array of strings like "darkvision 60 ft.".
 * Returns the numeric distance for the requested sense type, or 0.
 */
export function parseSense(senses: string[] | undefined, type: string): number {
  if (!senses || !Array.isArray(senses)) return 0;
  const sense = senses.find((s: string) => s.toLowerCase().includes(type));
  if (!sense) return 0;
  const match = sense.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

export function parseArmorClass(ac: any): number | undefined {
  if (typeof ac === 'number') return ac;
  if (Array.isArray(ac) && ac.length > 0) return ac[0].ac ?? ac[0];
  if (typeof ac === 'object' && ac !== null) return ac.ac;
  return undefined;
}

export function parseArmorSource(ac: any): string | undefined {
  if (Array.isArray(ac) && ac.length > 0 && ac[0].from) {
    const sources = Array.isArray(ac[0].from) ? ac[0].from : [ac[0].from];
    return capitalize(strip5eToolsMarkup(sources.join(' ')));
  }
  if (typeof ac === 'object' && ac !== null && ac.source) return capitalize(ac.source);
  return undefined;
}

/** Maps 5eTools size codes (T, S, M, L, H, G) to Aralia's full labels. */
export function parseSize(size: string[] | undefined): 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan' | undefined {
  if (!size || !Array.isArray(size) || size.length === 0) return undefined;
  const mapping: Record<string, 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'> = {
    T: 'Tiny',
    S: 'Small',
    M: 'Medium',
    L: 'Large',
    H: 'Huge',
    G: 'Gargantuan',
  };
  return mapping[size[0].toUpperCase()];
}

/** Maps a 5etools lowercase damage type string to Aralia's capitalized DamageType. */
export function mapDamageType(raw: string): string | undefined {
  const mapping: Record<string, string> = {
    acid: 'Acid', bludgeoning: 'Bludgeoning', cold: 'Cold', fire: 'Fire',
    force: 'Force', lightning: 'Lightning', necrotic: 'Necrotic',
    piercing: 'Piercing', poison: 'Poison', psychic: 'Psychic',
    radiant: 'Radiant', slashing: 'Slashing', thunder: 'Thunder',
  };
  return mapping[raw.toLowerCase()];
}

/**
 * Extracts simple string damage types from a 5etools defense array.
 * Skips conditional objects — only keeps entries that map to known D&D damage types.
 */
export function parseDamageDefenses(defenses: any[] | undefined): string[] {
  if (!defenses || !Array.isArray(defenses)) return [];
  const result: string[] = [];
  for (const entry of defenses) {
    if (typeof entry === 'string') {
      const mapped = mapDamageType(entry);
      if (mapped) result.push(mapped);
    }
  }
  return result;
}

/**
 * Extracts damage types from conditional defense entries that apply to nonmagical attacks.
 * These are objects like: { resist: [...], note: "from nonmagical attacks", cond: true }
 */
export function parseNonMagicalDefenses(defenses: any[] | undefined): string[] {
  if (!defenses || !Array.isArray(defenses)) return [];
  const result: string[] = [];
  for (const entry of defenses) {
    if (typeof entry !== 'object' || entry === null) continue;
    const note = (entry.note || '').toLowerCase();
    if (!note.includes('nonmagical') && !note.includes('non-magical')) continue;
    const types: any[] = entry.resist || entry.immune || entry.vulnerable || [];
    for (const dmgType of types) {
      if (typeof dmgType === 'string') {
        const mapped = mapDamageType(dmgType);
        if (mapped) result.push(mapped);
      }
    }
  }
  return result;
}

// ============================================================================
// Shared sub-parsers used by the action/reaction/legendary adapters
// ============================================================================

/** Extracts save DC and save ability from an action text string. */
export function parseSaveDC(text: string): { saveDC?: number; saveAbility?: AbilityScoreName } {
  const dcPatterns = [
    { reg: /(?:\{@dc\s+(\d+)\}|DC\s+(\d+))\s+([a-zA-Z]+)\s+sav/i, dc: [1, 2], abl: 3 },
    { reg: /\{@(?:actSave|ability)\s+([a-zA-Z]+)\}\s+\{@dc\s+(\d+)\}/i, dc: [2], abl: 1 },
    { reg: /([a-zA-Z]+)\s+\{@dc\s+(\d+)\}/i, dc: [2], abl: 1 },
    { reg: /([a-zA-Z]+)\s+saving throw\s+\(DC\s+(\d+)\)/i, dc: [2], abl: 1 },
  ];
  const abilityMap: Record<string, AbilityScoreName> = {
    str: 'Strength', strength: 'Strength',
    dex: 'Dexterity', dexterity: 'Dexterity',
    con: 'Constitution', constitution: 'Constitution',
    int: 'Intelligence', intelligence: 'Intelligence',
    wis: 'Wisdom', wisdom: 'Wisdom',
    cha: 'Charisma', charisma: 'Charisma',
  };
  for (const p of dcPatterns) {
    const match = text.match(p.reg);
    if (match) {
      const dcStr = p.dc.map(i => match[i]).find(v => v !== undefined);
      if (dcStr) {
        const saveDC = parseInt(dcStr);
        const saveAbility = abilityMap[match[p.abl].toLowerCase()];
        if (saveAbility) return { saveDC, saveAbility };
      }
    }
  }
  return {};
}

/** Parses AoE shape/size from an action text string.
 *  Handles both MM 2014 ("60-foot cone") and XMM 2024 format where the shape
 *  keyword may be wrapped in a {@variantrule Cone [Area of Effect]|XPHB|Cone} tag.
 */
export function parseAreaOfEffect(text: string): AreaOfEffect | undefined {
  // Pattern accepts optional {@variantrule ...} wrapper around the shape word
  const shapeTag = /\{@variantrule\s+(\w+)/i;
  // Cone: "60-foot cone" or "60-foot {@variantrule Cone..."
  const cone = text.match(/(\d+)-foot\s+(?:cone|\{@variantrule\s+Cone)/i);
  const line = text.match(/(\d+)-foot\s+(?:line|\{@variantrule\s+Line)/i);
  const radius = text.match(/(\d+)-foot(?:-radius|\s+(?:radius|\{@variantrule\s+Sphere))/i);
  if (cone) return { shape: 'cone', size: Math.max(1, Math.floor(parseInt(cone[1]) / 5)) };
  if (line) return { shape: 'line', size: Math.max(1, Math.floor(parseInt(line[1]) / 5)) };
  if (radius) return { shape: 'circle', size: Math.max(1, Math.floor(parseInt(radius[1]) / 5)) };
  void shapeTag; // retained for documentation
  return undefined;
}

/**
 * Parses a dice formula string (e.g. "2d6 + 3", "1d10+8", "3d8") and returns
 * the expected average value. Used to populate `value` on AbilityEffects so the
 * combat AI can score damage without rolling dice at evaluation time.
 */
export function diceAverage(formula: string): number {
  const f = formula.replace(/\s+/g, '');
  const m = f.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return 0;
  const n = parseInt(m[1]);
  const d = parseInt(m[2]);
  const mod = m[3] ? parseInt(m[3]) : 0;
  return n * ((d + 1) / 2) + mod;
}

/** Parses all {@damage ...} tags and infers damage types from surrounding text. */
export function parseDamageEffects(text: string): AbilityEffect[] {
  const effects: AbilityEffect[] = [];
  const damageRegex = /{@damage ([^}]+)}/g;
  let dMatch;
  while ((dMatch = damageRegex.exec(text)) !== null) {
    let dice = dMatch[1];
    let damageType: any = 'bludgeoning';
    if (dice.includes('|')) {
      const parts = dice.split('|');
      dice = parts[0];
      // Some 5eTools entries use compound types like "radiant/necrotic" (player's choice).
      // Take the first type so the engine always has a concrete value.
      const rawType = parts[1].toLowerCase().split('/')[0].trim();
      const typeMap: Record<string, string> = {
        fire: 'fire', cold: 'ice', ice: 'ice', lightning: 'lightning',
        acid: 'acid', poison: 'poison', necrotic: 'necrotic',
        radiant: 'radiant', force: 'force', psychic: 'psychic',
        thunder: 'thunder', piercing: 'piercing', slashing: 'slashing', bludgeoning: 'bludgeoning',
      };
      if (typeMap[rawType]) damageType = typeMap[rawType];
    } else {
      const postText = text.substring(dMatch.index + dMatch[0].length, dMatch.index + dMatch[0].length + 50).toLowerCase();
      const types = ['fire', 'cold', 'ice', 'lightning', 'acid', 'poison', 'necrotic', 'radiant', 'force', 'psychic', 'thunder', 'piercing', 'slashing', 'bludgeoning'];
      let bestType = null, bestIdx = 100;
      for (const t of types) {
        const idx = postText.indexOf(t);
        if (idx !== -1 && idx < bestIdx) { bestIdx = idx; bestType = t; }
      }
      if (bestType) {
        if (['piercing', 'slashing', 'bludgeoning'].includes(bestType)) damageType = bestType;
        else if (bestType === 'ice' || bestType === 'cold') damageType = 'ice';
        else damageType = bestType;
      }
    }
    effects.push({ type: 'damage', dice, damageType, value: Math.round(diceAverage(dice)) });
  }
  return effects;
}

const CONDITION_NAMES: ConditionName[] = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

/** Parses condition effects from {@condition ...} tags and plain-text fallbacks. */
export function parseConditionEffects(text: string): AbilityEffect[] {
  const effects: AbilityEffect[] = [];
  const tagRegex = /\{@condition ([^}|]+)(?:\|[^}]*)?\}/gi;
  let cMatch: RegExpExecArray | null;
  while ((cMatch = tagRegex.exec(text)) !== null) {
    const name = CONDITION_NAMES.find(c => c.toLowerCase() === cMatch![1].toLowerCase());
    if (name) {
      effects.push({ type: 'status', statusEffect: { id: name.toLowerCase(), name, type: 'debuff', duration: 1 } });
    }
  }
  CONDITION_NAMES.forEach(name => {
    if (!effects.some(e => e.type === 'status' && e.statusEffect?.name === name)) {
      if (new RegExp(`(?:has the|is|target is)\\s+${name}\\s+condition`, 'i').test(text)) {
        effects.push({ type: 'status', statusEffect: { id: name.toLowerCase(), name, type: 'debuff', duration: 1 } });
      }
    }
  });
  return effects;
}

/**
 * Harmonized icon assignment logic for all ability types.
 */
/**
 * Converts a 5eTools `conditionImmune` array (e.g. ["exhaustion","poisoned"]) into
 * Aralia `ConditionName` values (Title-Case). Unknown conditions are kept as-is so
 * downstream immunity checks (which allow string comparison) still work.
 */
export function parseConditionImmunities(conditionImmune: any[] | undefined): string[] {
  if (!Array.isArray(conditionImmune)) return [];
  return conditionImmune.map((c: any) => {
    if (typeof c !== 'string') return '';
    return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
  }).filter(Boolean);
}

export function getAbilityIcon(
  type: string,
  costType: string,
  name?: string,
  maxUses?: number
): string {
  const lowerName = (name || '').toLowerCase();
  if (lowerName.includes('legendary resistance')) return '🛡️';
  // costType-based icons take priority over type icons for lair/legendary/reaction
  // so that all lair actions show 🏰 regardless of whether they are typed as spell/attack.
  if (costType === 'lair') return '🏰';
  if (costType === 'legendary') return '🌟';
  if (costType === 'reaction') return '↩️';
  if (costType === 'bonus') return '⚡';
  if (type === 'attack') return '⚔️';
  if (type === 'spell') return '✨';
  if (maxUses !== undefined) return '⚡';
  return '📖';
}
