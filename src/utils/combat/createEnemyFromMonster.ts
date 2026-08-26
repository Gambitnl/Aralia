/**
 * This file turns a lightweight encounter monster into a combat-ready enemy.
 *
 * The generated bestiary is large, so this adapter lives outside combatUtils.ts.
 * Most systems only need dice, distance, or damage helpers; they should not load
 * the whole monster registry unless a battle is actually being started.
 *
 * Called by: encounter start handlers and crime systems that need live enemies.
 * Depends on: runtimeMonsterRegistry for bestiary lookup, class data for fallback shape.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx, hooks/actions/handleEncounter.ts, systems/combat/worldScenario/worldEncounterCombatants.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { AbilityEffect, CombatCharacter, CharacterStats } from '../../types/combat';
import { Monster, SpellSlots } from '../../types';
import type { MonsterSpellSlotPool } from '../../data/adapters/5eTools/types';
import { ConditionName } from '../../types/spells';
import { CreatureType, CreatureTypeTraits } from '../../types/creatures';
import { CLASSES_DATA } from '../../data/classes';
import { getMonster } from '../../data/adapters/runtimeMonsterRegistry';

// ============================================================================
// Creature Trait Helpers
// ============================================================================
// This section turns broad creature tags such as "undead" into the combat
// immunities the spawned enemy should carry.
// ============================================================================

function computeConditionImmunities(tags: string[]): ConditionName[] {
  const immunities = new Set<ConditionName>();
  for (const tag of tags) {
    const type = (tag.charAt(0).toUpperCase() + tag.slice(1)) as CreatureType;
    const traits = CreatureTypeTraits[type];
    if (traits?.conditionImmunities) {
      traits.conditionImmunities.forEach(c => immunities.add(c));
    }
  }
  return Array.from(immunities);
}

// ============================================================================
// Fallback Scaling
// ============================================================================
// This section builds the stat block used when the bestiary has no entry for a
// requested monster. The legacy fallback used to be a flat 10-HP, AC-10 fighter with a
// 4-damage punch at every challenge rating, so a missing CR 10 monster fought
// like a missing CR 1/8 one. The tables below scale it instead.
// ============================================================================

/** The damage types an ability effect is allowed to carry. */
type AbilityDamageType = NonNullable<AbilityEffect['damageType']>;

/** Challenge rating anchor row for the generated fallback stat block. */
interface FallbackCRAnchor {
  /** Challenge rating as a number (1/4 -> 0.25). */
  cr: number;
  /** Hit points. */
  hp: number;
  /** Armor class. */
  ac: number;
  /** Strength score. */
  str: number;
  /** Constitution score. */
  con: number;
  /** Expected damage output per round. */
  damagePerRound: number;
}

/**
 * Challenge rating anchors for the fallback stat block.
 *
 * `hp`, `ac`, `str` and `con` are the MEDIAN values of the 450 Monster Manual
 * stat blocks in `vendor/5etools-src/data/bestiary/bestiary-mm.json`, grouped by
 * challenge rating, then clamped so the curve never decreases. Medians are used
 * rather than the DMG p. 274 design table because that table is a budget for
 * building a monster, not a description of published ones: it puts a CR 1/4
 * creature at 36-49 hit points where the Monster Manual median is 13. A fallback
 * that follows published monsters keeps an encounter close to what the missing
 * monster would have been.
 *
 * `damagePerRound` is the midpoint of the DMG p. 274 "Damage/Round" column,
 * which has no bestiary equivalent because published monsters express damage as
 * multiattack sequences rather than one number.
 *
 * Dexterity is deliberately absent: its bestiary median sits between 10 and 14
 * at every challenge rating from 0 to 30, so it carries no CR signal. Only an
 * archetype hint moves it.
 *
 * Rows above CR 17 rest on fewer than five published monsters each and are the
 * roughest part of the curve.
 */
const FALLBACK_CR_ANCHORS: readonly FallbackCRAnchor[] = [
  { cr: 0, hp: 3, ac: 12, str: 4, con: 10, damagePerRound: 1 },
  { cr: 0.125, hp: 9, ac: 12, str: 10, con: 11, damagePerRound: 3 },
  { cr: 0.25, hp: 13, ac: 12, str: 12, con: 12, damagePerRound: 4 },
  { cr: 0.5, hp: 22, ac: 12, str: 12, con: 12, damagePerRound: 7 },
  { cr: 1, hp: 26, ac: 13, str: 14, con: 13, damagePerRound: 11 },
  { cr: 2, hp: 42, ac: 13, str: 16, con: 14, damagePerRound: 17 },
  { cr: 3, hp: 58, ac: 14, str: 16, con: 14, damagePerRound: 23 },
  { cr: 4, hp: 76, ac: 15, str: 17, con: 15, damagePerRound: 29 },
  { cr: 5, hp: 93, ac: 15, str: 18, con: 17, damagePerRound: 35 },
  { cr: 6, hp: 107, ac: 15, str: 18, con: 17, damagePerRound: 41 },
  { cr: 7, hp: 123, ac: 16, str: 19, con: 17, damagePerRound: 47 },
  { cr: 8, hp: 127, ac: 16, str: 19, con: 17, damagePerRound: 53 },
  { cr: 9, hp: 142, ac: 18, str: 21, con: 21, damagePerRound: 59 },
  { cr: 10, hp: 153, ac: 18, str: 21, con: 21, damagePerRound: 65 },
  { cr: 11, hp: 187, ac: 18, str: 22, con: 21, damagePerRound: 71 },
  { cr: 13, hp: 187, ac: 18, str: 22, con: 21, damagePerRound: 83 },
  { cr: 15, hp: 207, ac: 18, str: 23, con: 21, damagePerRound: 95 },
  { cr: 16, hp: 210, ac: 19, str: 24, con: 23, damagePerRound: 101 },
  { cr: 17, hp: 256, ac: 19, str: 25, con: 23, damagePerRound: 107 },
  { cr: 20, hp: 300, ac: 20, str: 26, con: 25, damagePerRound: 131 },
  { cr: 21, hp: 350, ac: 21, str: 27, con: 25, damagePerRound: 144 },
  { cr: 22, hp: 415, ac: 22, str: 28, con: 26, damagePerRound: 152 },
  { cr: 23, hp: 477, ac: 22, str: 30, con: 28, damagePerRound: 160 },
  { cr: 24, hp: 546, ac: 22, str: 30, con: 29, damagePerRound: 168 },
  { cr: 30, hp: 676, ac: 25, str: 30, con: 30, damagePerRound: 216 },
];

/**
 * Parses a challenge rating string into a number.
 *
 * Accepts both the whole-number form ("5") and the fractional form ("1/4") that
 * the bestiary and encounter tables both use.
 *
 * @param cr - The challenge rating string, possibly missing or malformed.
 * @returns The numeric challenge rating, or `undefined` when it cannot be read.
 */
export function parseChallengeRating(cr: string | undefined): number | undefined {
  if (!cr) return undefined;
  const text = cr.trim();
  if (text.includes('/')) {
    const [numerator, denominator] = text.split('/');
    const n = parseFloat(numerator);
    const d = parseFloat(denominator);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return undefined;
    return n / d;
  }
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Reads the anchor table at an arbitrary challenge rating, interpolating between
 * the two surrounding rows and clamping outside the table's range.
 *
 * @param cr - The numeric challenge rating.
 * @returns The interpolated anchor row.
 */
function interpolateCRAnchor(cr: number): FallbackCRAnchor {
  const rows = FALLBACK_CR_ANCHORS;
  if (cr <= rows[0].cr) return { ...rows[0], cr };
  const last = rows[rows.length - 1];
  if (cr >= last.cr) return { ...last, cr };

  let upper = 1;
  while (rows[upper].cr < cr) upper += 1;
  const lo = rows[upper - 1];
  const hi = rows[upper];
  const t = (cr - lo.cr) / (hi.cr - lo.cr);
  const at = (a: number, b: number) => a + (b - a) * t;
  return {
    cr,
    hp: at(lo.hp, hi.hp),
    ac: at(lo.ac, hi.ac),
    str: at(lo.str, hi.str),
    con: at(lo.con, hi.con),
    damagePerRound: at(lo.damagePerRound, hi.damagePerRound),
  };
}

/** A broad combat shape guessed from the monster's name. */
interface FallbackArchetype {
  /** Identifier for the shape, also used in the generated attack description. */
  id: string;
  /** Words in the monster name that select this shape. */
  keywords: readonly string[];
  /** Multiplier applied to the CR-derived hit points. */
  hpMultiplier: number;
  /** Adjustment applied to the CR-derived armor class. */
  acDelta: number;
  /** Adjustment applied to the CR-derived Strength score. */
  strDelta: number;
  /** Adjustment applied to the baseline Dexterity score. */
  dexDelta: number;
  /** Adjustment applied to the baseline Intelligence, Wisdom and Charisma scores. */
  mentalDelta: number;
  /** Multiplier applied to the CR-derived damage per round. */
  damageMultiplier: number;
  /** Walking speed in feet. */
  speed: number;
  /** Name shown on the generated attack. */
  attackName: string;
  /** Damage type the generated attack deals. */
  damageType: AbilityDamageType;
}

/**
 * Name-hint archetypes, tried in order; the first whose keyword appears in the
 * monster name wins. The multipliers are deliberately shallow (at most +/-25%
 * on hit points) so an encounter built for the missing monster's challenge
 * rating stays winnable whichever shape the name happens to match.
 */
const FALLBACK_ARCHETYPES: readonly FallbackArchetype[] = [
  {
    id: 'caster',
    keywords: ['mage', 'wizard', 'sorcer', 'warlock', 'priest', 'cultist', 'shaman', 'witch', 'lich', 'acolyte', 'druid', 'seer', 'oracle', 'necromancer'],
    hpMultiplier: 0.75,
    acDelta: -1,
    strDelta: -2,
    dexDelta: 0,
    mentalDelta: 4,
    damageMultiplier: 1.1,
    speed: 30,
    attackName: 'Arcane Bolt',
    damageType: 'force',
  },
  {
    id: 'armored',
    keywords: ['knight', 'guard', 'golem', 'construct', 'automaton', 'sentinel', 'warden', 'juggernaut', 'armor'],
    hpMultiplier: 1.1,
    acDelta: 2,
    strDelta: 1,
    dexDelta: -2,
    mentalDelta: 0,
    damageMultiplier: 0.9,
    speed: 25,
    attackName: 'Slam',
    damageType: 'bludgeoning',
  },
  {
    id: 'brute',
    keywords: ['giant', 'ogre', 'troll', 'minotaur', 'oni', 'bear', 'boar', 'elemental', 'hulk', 'behemoth', 'brute'],
    hpMultiplier: 1.25,
    acDelta: -1,
    strDelta: 2,
    dexDelta: -2,
    mentalDelta: -2,
    damageMultiplier: 1.1,
    speed: 40,
    attackName: 'Smash',
    damageType: 'bludgeoning',
  },
  {
    id: 'skirmisher',
    keywords: ['wolf', 'rogue', 'scout', 'bandit', 'kobold', 'goblin', 'rat', 'spider', 'bat', 'imp', 'sprite', 'assassin', 'thief', 'raider', 'stalker'],
    hpMultiplier: 0.8,
    acDelta: 1,
    strDelta: -1,
    dexDelta: 4,
    mentalDelta: 0,
    damageMultiplier: 1,
    speed: 35,
    attackName: 'Quick Strike',
    damageType: 'piercing',
  },
  {
    id: 'soldier',
    keywords: ['soldier', 'warrior', 'veteran', 'captain', 'mercenary', 'berserker', 'brigand', 'champion'],
    hpMultiplier: 1,
    acDelta: 1,
    strDelta: 1,
    dexDelta: 0,
    mentalDelta: 0,
    damageMultiplier: 1,
    speed: 30,
    attackName: 'Blade',
    damageType: 'slashing',
  },
];

/** The shape used when no keyword in the name matches an archetype. */
const DEFAULT_FALLBACK_ARCHETYPE: FallbackArchetype = {
  id: 'generic',
  keywords: [],
  hpMultiplier: 1,
  acDelta: 0,
  strDelta: 0,
  dexDelta: 0,
  mentalDelta: 0,
  damageMultiplier: 1,
  speed: 30,
  attackName: 'Attack',
  damageType: 'bludgeoning',
};

/**
 * Picks the fallback archetype whose keyword appears in the monster name.
 *
 * @param name - The requested monster name.
 * @returns The matching archetype, or the generic one.
 */
function inferFallbackArchetype(name: string): FallbackArchetype {
  const lowered = name.toLowerCase();
  for (const archetype of FALLBACK_ARCHETYPES) {
    if (archetype.keywords.some(keyword => lowered.includes(keyword))) return archetype;
  }
  return DEFAULT_FALLBACK_ARCHETYPE;
}

/** The generated stat block for a monster the bestiary does not contain. */
export interface FallbackMonsterProfile {
  /** Numeric challenge rating the block was scaled to. */
  cr: number;
  /** Identifier of the archetype the name selected. */
  archetypeId: string;
  /** Hit points, at least 1. */
  hp: number;
  /** Armor class. */
  armorClass: number;
  /** Ability scores, speed and senses. */
  stats: CharacterStats;
  /** Flat damage the generated attack deals. */
  damage: number;
  /** Name of the generated attack. */
  attackName: string;
  /** Damage type of the generated attack. */
  damageType: AbilityDamageType;
}

/**
 * Builds a fallback stat block from a monster's challenge rating and name.
 *
 * This is fully deterministic: the same name and CR always produce the same
 * block, so a reloaded encounter is the encounter the player already saw. No
 * randomness is involved, so no seeded generator is needed.
 *
 * @param name - The requested monster name, used only for the archetype hint.
 * @param cr - The challenge rating string from the encounter entry.
 * @returns The generated stat block.
 */
export function buildFallbackMonsterProfile(name: string, cr: string | undefined): FallbackMonsterProfile {
  // An unreadable CR lands on 1/4, which is the value the encounter tables
  // already default to for an unlabelled monster.
  const numericCR = parseChallengeRating(cr) ?? 0.25;
  const anchor = interpolateCRAnchor(numericCR);
  const archetype = inferFallbackArchetype(name);

  const strength = Math.max(1, Math.round(anchor.str + archetype.strDelta));
  const constitution = Math.max(1, Math.round(anchor.con));
  const dexterity = Math.max(1, 12 + archetype.dexDelta);
  const mental = Math.max(1, 10 + archetype.mentalDelta);

  const stats: CharacterStats = {
    strength,
    dexterity,
    constitution,
    intelligence: mental,
    wisdom: mental,
    charisma: mental,
    baseInitiative: Math.floor((dexterity - 10) / 2),
    speed: archetype.speed,
    cr: cr || '1/4',
    senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
  };

  return {
    cr: numericCR,
    archetypeId: archetype.id,
    hp: Math.max(1, Math.round(anchor.hp * archetype.hpMultiplier)),
    armorClass: Math.max(5, Math.round(anchor.ac + archetype.acDelta)),
    stats,
    damage: Math.max(1, Math.round(anchor.damagePerRound * archetype.damageMultiplier)),
    attackName: archetype.attackName,
    damageType: archetype.damageType,
  };
}

/**
 * Turns a monster's parsed spell-slot pool into the `SpellSlots` record the
 * combat action economy reads.
 *
 * `canAffordActionCost` looks up `character.spellSlots['level_N']` and refuses
 * the cast when the record is missing, so a slot-based caster monster that
 * reaches the battle map without this mapping can never cast a leveled spell.
 * Every level 1-9 is present and zeroed, matching `spellSlotsForClassLevel`,
 * so an absent level reads as "no slots" rather than as undefined.
 * Monsters start an encounter with their slots full.
 */
function buildMonsterSpellSlots(pool: MonsterSpellSlotPool): SpellSlots {
  const slots = {} as SpellSlots;
  const record = slots as Record<string, { current: number; max: number }>;

  for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
    record[`level_${spellLevel}`] = { current: 0, max: 0 };
  }

  for (const [spellLevel, count] of Object.entries(pool)) {
    const level = Number(spellLevel);
    if (!Number.isInteger(level) || level < 1 || level > 9) continue;
    record[`level_${level}`] = { current: count, max: count };
  }

  return slots;
}

// ============================================================================
// Enemy Conversion
// ============================================================================
// This section creates the temporary combat character used by the battle map.
// It prefers full bestiary data, but falls back to a generic enemy so a content
// mismatch does not crash the whole encounter.
// ============================================================================

export function createEnemyFromMonster(monster: Monster, index: number): CombatCharacter {
  const monsterData = getMonster(monster.name);

  if (!monsterData) {
    const profile = buildFallbackMonsterProfile(monster.name, monster.cr);
    console.warn(
      `No data found for monster: ${monster.name}. Creating a generic enemy scaled to CR ${profile.cr} (${profile.archetypeId}).`
    );
    const fallbackStats: CharacterStats = profile.stats;
    const fallbackId = monster.name.toLowerCase().replace(/\s+/g, '_');
    return {
      id: `enemy_${fallbackId}_${index}`,
      name: `${monster.name} ${index + 1}`,
      level: profile.cr || 1,
      class: CLASSES_DATA['fighter'],
      position: { x: 0, y: 0 },
      stats: fallbackStats,
      abilities: [
        { id: 'basic_attack', name: profile.attackName, description: 'A basic attack.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{ type: 'damage', value: profile.damage, damageType: profile.damageType }], icon: 'Attack', isProficient: true },
        { id: 'stand_up', name: 'Stand Up', description: 'Right yourself from a Prone position. Costs half your Speed.', type: 'movement', cost: { type: 'movement-only', movementCost: Math.floor(fallbackStats.speed / 2) }, targeting: 'self', range: 0, effects: [], icon: 'Stand' }
      ],
      team: 'enemy',
      maxHP: profile.hp,
      currentHP: profile.hp,
      armorClass: profile.armorClass,
      baseAC: profile.armorClass,
      initiative: 0,
      statusEffects: [],
      actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: fallbackStats.speed },
        freeActions: 1,
      },
    };
  }

  // Merge type-inferred immunities with explicit 5eTools conditionImmune entries.
  const typeInferred = computeConditionImmunities(monsterData.tags);
  const explicit: ConditionName[] = (monsterData.conditionImmunities || []) as ConditionName[];
  const conditionImmunities = Array.from(new Set([...typeInferred, ...explicit]));

  // Convert challenge rating into the numeric level-like field combat UI expects.
  const level = parseChallengeRating(monsterData.baseStats.cr) ?? 1;

  return {
    id: `enemy_${monsterData.id}_${index}`,
    name: `${monsterData.name} ${index + 1}`,
    level: level || 1,
    class: CLASSES_DATA['fighter'],
    position: { x: 0, y: 0 },
    stats: monsterData.baseStats,
    abilities: [
      ...(monsterData.abilities || []),
      { id: 'stand_up', name: 'Stand Up', description: 'Right yourself from a Prone position. Costs half your Speed.', type: 'movement', cost: { type: 'movement-only', movementCost: Math.floor(monsterData.baseStats.speed / 2) }, targeting: 'self', range: 0, effects: [], icon: 'Stand' }
    ],
    team: 'enemy',
    maxHP: monsterData.maxHP,
    currentHP: monsterData.maxHP,
    armorClass: monsterData.armorClass || 10,
    baseAC: monsterData.armorClass || 10,
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: {
        used: 0,
        total: monsterData.baseStats.legendaryActionsPerRound || 0
      },
      movement: { used: 0, total: monsterData.baseStats.speed },
      freeActions: 1,
    },
    resistances: monsterData.resistances,
    vulnerabilities: monsterData.vulnerabilities,
    immunities: monsterData.immunities,
    ...(monsterData.nonMagicalResistances && { nonMagicalResistances: monsterData.nonMagicalResistances }),
    ...(monsterData.nonMagicalImmunities && { nonMagicalImmunities: monsterData.nonMagicalImmunities }),
    ...(conditionImmunities.length > 0 && { conditionImmunities }),
    ...(monsterData.spellSlots && { spellSlots: buildMonsterSpellSlots(monsterData.spellSlots) }),
  };
}
