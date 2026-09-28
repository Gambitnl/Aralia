// TypeScript definitions for the subset of the 5eTools monster JSON schema that
// Aralia's bestiary ingestion actually reads.
//
// 5eTools publishes no official TypeScript types, so these interfaces were
// derived by enumerating every field shape present across
// `vendor/5etools-src/data/bestiary/bestiary-mm.json` (2014 Monster Manual) and
// `bestiary-xmm.json` (2024 Monster Manual) — the two files `scripts/ingestMonsters.ts`
// feeds to `convert5eToolsMonster`.
//
// Rules of thumb for extending this file:
//   * Model what the ingested data really contains, not the whole upstream schema.
//     A field nobody reads does not belong here.
//   * Where 5eTools allows a scalar OR a wrapper object for the same concept
//     (ac, cr, type, alignment, speed), keep the union. The MM/XMM corpus uses
//     both forms and the adapter has to branch on them.
//   * Unknown-but-present sibling keys are absorbed by an index signature so a
//     newer 5eTools release does not fail to assign.

/**
 * A 5eTools rich-text entry. Entries nest arbitrarily (`list` → `items`,
 * `entries` → `entries`), which is why `extractEntryText` walks them recursively.
 */
export type FiveEToolsEntry =
  | string
  | {
      type?: string;
      name?: string;
      entries?: FiveEToolsEntry[];
      items?: FiveEToolsEntry[];
      [key: string]: unknown;
    };

/** One armor-class record. Plain numbers appear when no source is given. */
export interface FiveEToolsAcObject {
  ac: number;
  /** Armor source(s), e.g. ["natural armor"] or ["{@item chain mail|phb}"]. */
  from?: string[];
  /** Situational note, e.g. "while in bear form". */
  condition?: string;
  /** Rendering hint only; the adapter ignores it. */
  braces?: boolean;
}

export type FiveEToolsAc = number | FiveEToolsAcObject;

export interface FiveEToolsHp {
  /** Mean hit points. Absent on creatures with `special` HP text. */
  average?: number;
  /** Hit dice formula, e.g. "18d8 + 54". */
  formula?: string;
  /** Free-text HP rule used by a handful of creatures (e.g. "equal to the summoner's"). */
  special?: string;
}

/** A movement speed that only applies under a stated condition. */
export interface FiveEToolsConditionalSpeed {
  number: number;
  condition: string;
}

export type FiveEToolsSpeedValue = number | FiveEToolsConditionalSpeed;

export interface FiveEToolsSpeed {
  walk?: FiveEToolsSpeedValue;
  fly?: FiveEToolsSpeedValue;
  swim?: FiveEToolsSpeedValue;
  climb?: FiveEToolsSpeedValue;
  burrow?: FiveEToolsSpeedValue;
  /** True when the creature's fly speed includes hovering. */
  canHover?: boolean;
  /** "one of the following" speeds, e.g. climb or swim 30 ft. */
  choose?: { from: string[]; amount: number; note?: string };
  /** Alternate speed sets (e.g. a second walk speed in a different form). */
  alternate?: Partial<Record<'walk' | 'fly' | 'swim' | 'climb' | 'burrow', FiveEToolsSpeedValue[]>>;
  [key: string]: unknown;
}

export interface FiveEToolsCrObject {
  /** Challenge rating as printed, e.g. "21", "1/2". */
  cr: string;
  /** Higher CR while in the creature's lair. */
  lair?: string;
  /** Explicit XP override. */
  xp?: number;
  /** Explicit XP override for the lair CR. */
  xpLair?: number;
  /** Higher CR while part of a coven. */
  coven?: string;
}

export type FiveEToolsCr = string | FiveEToolsCrObject;

/** A creature-type tag carrying display affixes, e.g. { tag: "goblinoid" }. */
export interface FiveEToolsTypeTag {
  tag: string;
  prefix?: string;
  prefixHidden?: boolean;
}

/**
 * A creature whose type is one of several, rendered "Celestial or Fiend".
 * Only the two XMM Empyreans use this form.
 */
export interface FiveEToolsChooseType {
  choose: string[];
}

export interface FiveEToolsTypeObject {
  type: string | FiveEToolsChooseType;
  tags?: (string | FiveEToolsTypeTag)[];
  /** Size of the individual creatures making up a swarm. */
  swarmSize?: string;
}

export type FiveEToolsType = string | FiveEToolsTypeObject;

/** A weighted alignment option, e.g. { alignment: ["C","E"], chance: 75 }. */
export interface FiveEToolsAlignmentObject {
  alignment: string[];
  chance?: number;
  note?: string;
}

/** Single-letter alignment code ("L", "N", "C", "G", "E", "NX", "NY", "U", "A"). */
export type FiveEToolsAlignment = string | FiveEToolsAlignmentObject;

/**
 * One entry of `resist` / `immune` / `vulnerable`. A bare string is an
 * unconditional damage type; the object form scopes the defense with a note
 * such as "from nonmagical attacks".
 */
export interface FiveEToolsDamageDefenseGroup {
  resist?: (string | FiveEToolsDamageDefenseGroup)[];
  immune?: (string | FiveEToolsDamageDefenseGroup)[];
  vulnerable?: (string | FiveEToolsDamageDefenseGroup)[];
  note?: string;
  preNote?: string;
  cond?: boolean;
  special?: string;
}

export type FiveEToolsDamageDefense = string | FiveEToolsDamageDefenseGroup;

export interface FiveEToolsConditionImmuneGroup {
  conditionImmune: string[];
  note?: string;
  cond?: boolean;
}

export type FiveEToolsConditionImmune = string | FiveEToolsConditionImmuneGroup;

/**
 * A named block of rich text. Backs `action`, `bonus`, `reaction`, `legendary`
 * and `trait`; every one of those arrays uses the same `{ name, entries }` shape.
 */
export interface FiveEToolsNamedEntry {
  name: string;
  entries?: FiveEToolsEntry[];
  [key: string]: unknown;
}

/** One spell level inside a `spellcasting.spells` map. Cantrips carry no slots. */
export interface FiveEToolsSpellLevel {
  /** Prepared-caster slot count for this level. Absent for cantrips (level "0"). */
  slots?: number;
  spells: string[];
  /** Lowest level of a "levels N-M" range. */
  lower?: number;
}

/**
 * One `spellcasting` block. The three spell containers are mutually compatible
 * and a block may carry any combination of them:
 *   `will`   — at-will spells, no usage limit
 *   `daily`  — N/Day spells, keyed "1", "2e", "3e"… ("e" suffix = N/Day *each*)
 *   `spells` — slot-based prepared spells keyed by spell level ("0".."9")
 */
export interface FiveEToolsSpellcasting {
  name?: string;
  /** Always "spellcasting" in the ingested corpus. */
  type?: string;
  /** Spellcasting ability key: "str" | "dex" | "con" | "int" | "wis" | "cha". */
  ability?: string;
  headerEntries?: string[];
  footerEntries?: FiveEToolsEntry[];
  /** Action cost of the block in XMM: "bonus" | "reaction"; absent means action. */
  displayAs?: string;
  will?: string[];
  daily?: Record<string, string[]>;
  spells?: Record<string, FiveEToolsSpellLevel>;
  legendary?: string[];
  recharge?: Record<string, string[]>;
  restLong?: Record<string, string[]>;
  /** Spell names hidden from the rendered stat block. */
  hidden?: string[];
  [key: string]: unknown;
}

/** 2024 XMM initiative block: initiative = DEX mod + `proficiency` × proficiency bonus. */
export interface FiveEToolsInitiative {
  proficiency?: number;
  [key: string]: unknown;
}

/**
 * A 5eTools monster stat block, narrowed to the fields Aralia reads.
 * The index signature keeps the many untouched fields (`source`, `page`,
 * `environment`, `*Tags`, fluff flags…) assignable without listing them.
 */
export interface FiveEToolsMonster {
  name: string;
  size?: string[];
  type?: FiveEToolsType;
  alignment?: FiveEToolsAlignment[];

  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;

  ac?: FiveEToolsAc[];
  hp?: FiveEToolsHp;
  speed?: FiveEToolsSpeed;
  initiative?: FiveEToolsInitiative;
  cr?: FiveEToolsCr;

  /** Saving-throw overrides as signed strings, e.g. { con: "+10", int: "+12" }. */
  save?: Record<string, string>;
  /** Skill bonuses as signed strings; carried for completeness, not yet read. */
  skill?: Record<string, string>;
  senses?: string[];
  passive?: number;
  languages?: string[];

  resist?: FiveEToolsDamageDefense[];
  immune?: FiveEToolsDamageDefense[];
  vulnerable?: FiveEToolsDamageDefense[];
  conditionImmune?: FiveEToolsConditionImmune[];

  trait?: FiveEToolsNamedEntry[];
  action?: FiveEToolsNamedEntry[];
  bonus?: FiveEToolsNamedEntry[];
  reaction?: FiveEToolsNamedEntry[];
  legendary?: FiveEToolsNamedEntry[];
  legendaryHeader?: FiveEToolsEntry[];
  /**
   * Legendary actions per round. Absent throughout MM/XMM — those books state
   * the count in `legendaryHeader` prose — so the adapter defaults to 3 when a
   * `legendary` array is present. Kept because other 5eTools bestiaries set it.
   */
  legendaryActions?: number;
  legendaryActionsLair?: number;
  legendaryGroup?: { name?: string; source?: string };

  spellcasting?: FiveEToolsSpellcasting[];

  [key: string]: unknown;
}

/**
 * The per-level spell-slot pool a slot-based (prepared) caster monster owns at
 * the start of combat. Keys are spell levels 1-9 as strings; cantrips (level 0)
 * never appear because they cost no slot.
 */
export interface MonsterSpellSlotPool {
  [spellLevel: number]: number;
}
