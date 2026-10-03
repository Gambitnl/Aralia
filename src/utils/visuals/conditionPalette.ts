/**
 * @file src/utils/visuals/conditionPalette.ts
 * The ONE source of truth for how a condition looks: chip label, chip color,
 * icon glyph and 3D body tint.
 *
 * Before this module the same condition carried three independent color
 * tables — the 3D chip strip (`conditionBadges.tsx`), the 3D body tint
 * (`actorStatusShading.ts`) and `STATUS_VISUALS` in `src/types/visuals.ts` —
 * which disagreed with each other (Ignited was salmon on the chip, orange on
 * the body and red in STATUS_VISUALS). Every surface now reads this file.
 *
 * COLOR STATUS (Remy, 2026-09-21, condition-colors sheet q1 — "Set C"):
 * exactly SIX conditions have an agreed chip color. Every other condition
 * resolves to ONE explicit neutral, `DEFAULT_CONDITION_VISUAL.chipColor`, and
 * stays there until sheet q4 is ruled. Do not guess a per-condition color to
 * fill the gap: a wrong color that ships reads as a decision nobody made.
 *
 * Labels and icons are NOT part of that open question. Every condition keeps
 * its own two-letter chip label and its own glyph, so the surfaces stay
 * readable while the palette is half-decided.
 */
import { ConditionType } from '../../types/conditions';

/**
 * How one condition draws on every surface.
 *
 * `chipColor` is the 2D/3D chip stroke; `tintColor` is the 3D body overlay and
 * is null for a condition that does not tint the body at all.
 */
export interface ConditionVisual {
  /** Display name in its canonical casing, e.g. "Poisoned". */
  name: string;
  /** Lowercased lookup key, e.g. "poisoned". */
  key: string;
  /** Two-letter chip text. Unique across every row (asserted by the test). */
  chipLabel: string;
  /** Chip stroke/text color. Only the six ruled rows carry their own. */
  chipColor: string;
  /** Emoji glyph for the 2D token marker and the status registry. */
  icon: string;
  /** Overlay hue applied to the lit 3D body, or null for no tint. */
  tintColor: number | null;
  /** How far the body moves toward `tintColor` (0..1). */
  tintStrength: number;
  /** How far the body moves toward greyscale first (0..1). */
  desaturate: number;
  /** Higher wins when a creature carries several conditions at once. */
  severity: number;
  /** One-line rules summary, shown in tooltips and the status registry. */
  description: string;
  /** Extra names that resolve to this row, lowercased. */
  aliases?: readonly string[];
}

/**
 * Set C, ruled by Remy on 2026-09-21 (condition-colors sheet q1). These six
 * hexes are the ONLY agreed condition colors; they were picked from real
 * side-by-side captures of the 3D body tint and the 2D chip, so the same hex
 * drives both surfaces.
 */
const SET_C = {
  poisoned: '#56d364',
  ignited: '#ff7a33',
  blinded: '#b9e4f0',
  blessed: '#ffe066',
  restrained: '#b06cf0',
  unconscious: '#6f6fa8',
} as const;

/**
 * The ONE neutral every unruled condition wears. It is the slate the 3D chip
 * strip already used for unknown conditions, so the fallback is a color the
 * game has always shown rather than a new invention. Sheet q4 replaces it
 * per condition; until then a single shared value makes "undecided" visible.
 */
const DEFAULT_CHIP_COLOR = '#e2e8f0';

/**
 * Tint strength for a Set C row that had no shipped body tint before. One
 * shared constant rather than six invented per-condition numbers: the hue is
 * ruled, the strength is not, so it stays uniform and obvious until it is.
 */
const RULED_TINT_STRENGTH = 0.4;

/** Set C hex → the 0xRRGGBB number the 3D shaders take. */
function tintOf(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/**
 * Severity ladder. The numbers reproduce the shipped precedence in
 * `actorStatusShading.ts` EXACTLY — ignited beats petrified beats frozen beats
 * chilled beats paralyzed beats poisoned beats charmed beats stunned — so
 * moving the 3D body onto this module does not silently re-rank anything.
 * Every condition outside that ladder shares the floor value and ties are
 * broken by the order a creature carries them in.
 */
const SEVERITY_FLOOR = 10;

/**
 * Every `ConditionType` member. Declared as a full Record so the compiler
 * fails the build the day someone adds an enum member without a visual.
 */
const ENUM_CONDITION_VISUALS: Record<ConditionType, ConditionVisual> = {
  [ConditionType.Blinded]: {
    name: 'Blinded',
    key: 'blinded',
    chipLabel: 'BL',
    chipColor: SET_C.blinded,
    icon: '👁️',
    tintColor: tintOf(SET_C.blinded),
    tintStrength: RULED_TINT_STRENGTH,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Can’t see and automatically fails any ability check that requires sight.',
  },
  [ConditionType.Charmed]: {
    name: 'Charmed',
    key: 'charmed',
    chipLabel: 'CH',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '💕',
    // SHIPPED, NOT RULED: kept verbatim from actorStatusShading.ts so the 3D
    // body does not lose a cue it has today. The chip color is still neutral.
    tintColor: 0xf472b6,
    tintStrength: 0.32,
    desaturate: 0,
    severity: 40,
    description: 'Can’t attack the charmer or target the charmer with harmful abilities or magical effects.',
  },
  [ConditionType.Deafened]: {
    name: 'Deafened',
    key: 'deafened',
    chipLabel: 'DF',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '🙉',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Can’t hear and automatically fails any ability check that requires hearing.',
  },
  [ConditionType.Exhaustion]: {
    name: 'Exhaustion',
    key: 'exhaustion',
    chipLabel: 'EX',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '😫',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Effects vary by level of exhaustion.',
  },
  [ConditionType.Frightened]: {
    name: 'Frightened',
    key: 'frightened',
    chipLabel: 'FR',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '😱',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.',
  },
  [ConditionType.Grappled]: {
    name: 'Grappled',
    key: 'grappled',
    chipLabel: 'GR',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '✊',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Speed becomes 0, and it can’t benefit from any bonus to its speed.',
  },
  [ConditionType.Incapacitated]: {
    name: 'Incapacitated',
    key: 'incapacitated',
    chipLabel: 'IN',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '🤕',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Can’t take actions or reactions.',
  },
  [ConditionType.Invisible]: {
    name: 'Invisible',
    key: 'invisible',
    chipLabel: 'IV',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '👻',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Impossible to see without the aid of magic or a special sense.',
  },
  [ConditionType.Paralyzed]: {
    name: 'Paralyzed',
    key: 'paralyzed',
    chipLabel: 'PA',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '⚡',
    // SHIPPED, NOT RULED — see Charmed.
    tintColor: 0x22d3ee,
    tintStrength: 0.4,
    desaturate: 0.3,
    severity: 60,
    description: 'Incapacitated and can’t move or speak. Attacks against the creature have advantage.',
  },
  [ConditionType.Petrified]: {
    name: 'Petrified',
    key: 'petrified',
    chipLabel: 'PE',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '🗿',
    // SHIPPED, NOT RULED — see Charmed.
    tintColor: 0x9ca3af,
    tintStrength: 0.35,
    desaturate: 0.8,
    severity: 90,
    description: 'Transformed into a solid inanimate substance (usually stone).',
  },
  [ConditionType.Poisoned]: {
    name: 'Poisoned',
    key: 'poisoned',
    chipLabel: 'PO',
    chipColor: SET_C.poisoned,
    icon: '🤢',
    tintColor: tintOf(SET_C.poisoned),
    // Strength and desaturation are the shipped values; only the hue moved.
    tintStrength: 0.42,
    desaturate: 0.12,
    severity: 50,
    description: 'Has disadvantage on attack rolls and ability checks.',
  },
  [ConditionType.Prone]: {
    name: 'Prone',
    key: 'prone',
    chipLabel: 'PR',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '🛌',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Only movement options are to crawl or spend half Speed to right yourself. Attack rolls have disadvantage.',
  },
  [ConditionType.Restrained]: {
    name: 'Restrained',
    key: 'restrained',
    chipLabel: 'RE',
    chipColor: SET_C.restrained,
    icon: '⛓️',
    tintColor: tintOf(SET_C.restrained),
    tintStrength: RULED_TINT_STRENGTH,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Speed becomes 0. Attack rolls against the creature have advantage, and the creature’s attack rolls have disadvantage.',
  },
  [ConditionType.Stunned]: {
    name: 'Stunned',
    key: 'stunned',
    chipLabel: 'ST',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '💫',
    // SHIPPED, NOT RULED — see Charmed.
    tintColor: 0xfde047,
    tintStrength: 0.32,
    desaturate: 0.1,
    severity: 30,
    description: 'Incapacitated, can’t move, and can speak only falteringly.',
  },
  [ConditionType.Unconscious]: {
    name: 'Unconscious',
    key: 'unconscious',
    chipLabel: 'UN',
    chipColor: SET_C.unconscious,
    icon: '💤',
    tintColor: tintOf(SET_C.unconscious),
    tintStrength: RULED_TINT_STRENGTH,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Incapacitated, can’t move or speak, and is unaware of its surroundings.',
  },
  [ConditionType.Ignited]: {
    name: 'Ignited',
    key: 'ignited',
    chipLabel: 'IG',
    chipColor: SET_C.ignited,
    icon: '🔥',
    tintColor: tintOf(SET_C.ignited),
    // Shipped burning strength. The flicker envelope stays in
    // actorStatusShading.ts: it is motion, not palette.
    tintStrength: 0.5,
    desaturate: 0,
    severity: 100,
    description: 'Taking fire damage over time.',
    aliases: ['burning', 'on fire', 'aflame'],
  },
  [ConditionType.Frozen]: {
    name: 'Frozen',
    key: 'frozen',
    chipLabel: 'FZ',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '🧊',
    // SHIPPED, NOT RULED — see Charmed.
    tintColor: 0xcfe9ff,
    tintStrength: 0.45,
    desaturate: 0.35,
    severity: 80,
    description: 'Encased in ice: incapacitated, speed 0, until the ice is shattered or melted.',
  },
  [ConditionType.Chilled]: {
    name: 'Chilled',
    key: 'chilled',
    chipLabel: 'CL',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '❄️',
    // SHIPPED, NOT RULED — see Charmed.
    tintColor: 0xcfe9ff,
    tintStrength: 0.35,
    desaturate: 0.25,
    severity: 70,
    description: 'Deep cold numbs the limbs: speed halved, disadvantage on Dexterity saves.',
  },
};

/**
 * Names that are not `ConditionType` members but reach the same surfaces:
 * the widening names in `src/types/spellEffectTypes.ts` (`ConditionName`) and
 * Blessed, which sheet q1 gave a ruled color even though it is authored as a
 * status effect rather than a 5e condition.
 */
const EXTRA_CONDITION_VISUALS: Record<string, ConditionVisual> = {
  blessed: {
    name: 'Blessed',
    key: 'blessed',
    chipLabel: 'BS',
    chipColor: SET_C.blessed,
    icon: '✨',
    tintColor: tintOf(SET_C.blessed),
    tintStrength: RULED_TINT_STRENGTH,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Adds 1d4 to attack rolls and saving throws.',
  },
  slowed: {
    name: 'Slowed',
    key: 'slowed',
    chipLabel: 'SL',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '🐌',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Movement and reactions are slowed.',
    // "Slasher Slow" shipped as its own row with an identical label and color.
    // It is the same visual, so it is an alias and chip labels stay unique.
    aliases: ['slasher slow'],
  },
  'disadvantage on attacks vs. caster': {
    name: 'Disadvantage on attacks vs. caster',
    key: 'disadvantage on attacks vs. caster',
    chipLabel: 'DI',
    chipColor: DEFAULT_CHIP_COLOR,
    icon: '🎯',
    tintColor: null,
    tintStrength: 0,
    desaturate: 0,
    severity: SEVERITY_FLOOR,
    description: 'Attack rolls against the caster are made with disadvantage.',
  },
};

/**
 * Every condition visual, keyed by lowercase name. Enum members first so a
 * widening name can never shadow a real condition.
 */
export const CONDITION_VISUALS: Readonly<Record<string, ConditionVisual>> = Object.freeze(
  (() => {
    const rows: Record<string, ConditionVisual> = {};
    // Enum members first, so their insertion order IS the declaration order
    // above and a widening name can never shadow a real condition.
    for (const visual of Object.values(ENUM_CONDITION_VISUALS)) rows[visual.key] = visual;
    for (const visual of Object.values(EXTRA_CONDITION_VISUALS)) {
      if (!rows[visual.key]) rows[visual.key] = visual;
    }
    return rows;
  })(),
);

/**
 * key → position in the declaration order above. `resolveDominantCondition`
 * uses it as its last tie-break so the answer never depends on the order a
 * creature happens to carry its conditions in.
 */
const DECLARATION_ORDER: ReadonlyMap<string, number> = new Map(
  Object.keys(CONDITION_VISUALS).map((key, index) => [key, index]),
);

/** Alias → canonical key, built once from the rows above. */
const ALIAS_INDEX: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.values(CONDITION_VISUALS).flatMap((visual) =>
      (visual.aliases ?? []).map((alias) => [alias, visual.key]),
    ),
  ),
);

/**
 * The one neutral row every unruled condition resolves to. Its hex is the
 * slate the 3D chip strip already used for unknown conditions, so nothing
 * that ships today changes color by accident.
 */
export const DEFAULT_CONDITION_VISUAL: ConditionVisual = Object.freeze({
  name: 'Effect',
  key: 'unknown',
  chipLabel: '??',
  chipColor: DEFAULT_CHIP_COLOR,
  icon: '💀',
  tintColor: null,
  tintStrength: 0,
  desaturate: 0,
  severity: 0,
  description: 'Unknown status effect.',
});

/**
 * Look up a condition WITHOUT falling back. Returns undefined for a name this
 * module does not know, so a caller that has its own registry (for example
 * `getStatusVisual`, which still owns Taunted and Bane) can chain past it.
 *
 * Lookup order: lowercase, exact key, then alias. Substring matching is gone
 * on purpose — it made "Slasher Slow" match "Slow" and "on fire" match "fire".
 */
export function lookupConditionVisual(name: string): ConditionVisual | undefined {
  if (!name) return undefined;
  const key = String(name).trim().toLowerCase();
  const direct = CONDITION_VISUALS[key];
  if (direct) return direct;
  const aliased = ALIAS_INDEX[key];
  return aliased ? CONDITION_VISUALS[aliased] : undefined;
}

/**
 * Resolve a condition to a visual that is always safe to render. An unknown
 * name keeps its own two-letter chip so a homebrew condition still surfaces
 * instead of silently disappearing; everything else is the neutral default.
 *
 * Never throws, for any string.
 */
export function resolveConditionVisual(name: string): ConditionVisual {
  const known = lookupConditionVisual(name);
  if (known) return known;
  const raw = String(name ?? '').trim();
  if (!raw) return DEFAULT_CONDITION_VISUAL;
  return {
    ...DEFAULT_CONDITION_VISUAL,
    name: raw,
    key: raw.toLowerCase(),
    chipLabel: raw.slice(0, 2).toUpperCase(),
  };
}

/**
 * True when `candidate` should out-rank `best` as the whole-body cue.
 *
 * Severity decides first. Most conditions sit on the shared floor, though, so
 * a plain `>` there made the answer depend on the order a creature happened to
 * carry its conditions in — and let an untinted row beat a row whose color
 * Remy actually ruled. Two tie-breaks fix that, in order:
 *   1. a row that TINTS the body beats a row that does not, because a cue that
 *      can be drawn beats one that cannot;
 *   2. otherwise the earlier row in declaration order wins, which is stable.
 */
function outranks(candidate: ConditionVisual, best: ConditionVisual): boolean {
  if (candidate.severity !== best.severity) return candidate.severity > best.severity;
  const candidateTints = candidate.tintColor !== null;
  const bestTints = best.tintColor !== null;
  if (candidateTints !== bestTints) return candidateTints;
  return (
    (DECLARATION_ORDER.get(candidate.key) ?? Number.MAX_SAFE_INTEGER) <
    (DECLARATION_ORDER.get(best.key) ?? Number.MAX_SAFE_INTEGER)
  );
}

/**
 * The condition that should drive a whole-body cue when a creature carries
 * several at once. Returns null when nothing in the list is a known condition,
 * because an unknown name has no agreed body tint to show.
 *
 * The result does NOT depend on the order of `names`: see `outranks`.
 */
export function resolveDominantCondition(names: readonly string[]): ConditionVisual | null {
  let best: ConditionVisual | null = null;
  for (const name of names) {
    const visual = lookupConditionVisual(name);
    if (!visual) continue;
    if (best === null || outranks(visual, best)) best = visual;
  }
  return best;
}

/**
 * The kind-of-effect fallback glyphs, for a status effect that carries no
 * condition name of its own. `icon` is the emoji the 2D token and sheets use;
 * `asciiGlyph` is the plain-text form the battle-map overlay needs, because
 * its chips are 12 px wide and an emoji there renders as a blob.
 *
 * This table replaced TWO byte-identical switch statements.
 */
export const STATUS_KIND_GLYPHS: Readonly<
  Record<string, { icon: string; asciiGlyph: string }>
> = Object.freeze({
  buff: { icon: '✨', asciiGlyph: '+' },
  debuff: { icon: '☠️', asciiGlyph: '!' },
  dot: { icon: '🔥', asciiGlyph: 'DOT' },
  hot: { icon: '➕', asciiGlyph: 'HOT' },
});

/** The glyph pair used when an effect's `type` is absent or unrecognized. */
export const DEFAULT_STATUS_KIND_GLYPH = Object.freeze({
  icon: '◼️',
  asciiGlyph: '?',
});

/**
 * The glyph for one status effect, in either alphabet.
 *
 * Precedence: an explicit `icon` on the effect, then the condition palette by
 * name, then the kind-of-effect fallback. The name step is what stopped every
 * 2D condition marker drawing the same skull: `conditions[]` entries carry no
 * `icon` field, so the old code fell straight through to the type switch.
 */
export function resolveStatusGlyph(
  effect: { icon?: string; name?: string; type?: string },
  style: 'emoji' | 'ascii' = 'emoji',
): string {
  if (effect.icon) return effect.icon;
  if (style === 'emoji' && effect.name) {
    const named = lookupConditionVisual(effect.name);
    if (named) return named.icon;
  }
  const kind = (effect.type && STATUS_KIND_GLYPHS[effect.type]) || DEFAULT_STATUS_KIND_GLYPH;
  return style === 'ascii' ? kind.asciiGlyph : kind.icon;
}
