/**
 * @file heroImagePrompt.ts — turn a CreaturePlan into one image-generation
 * prompt string for the creature hero pipeline.
 *
 * Pure and deterministic: the same plan always yields the same prompt. The
 * prompt reads as comma-separated descriptors (the style image models parse
 * best): a fixed opener naming the creature, its stance and size, an
 * appendage summary, head notes, palette colors named in plain English, then
 * fixed framing and style phrases. Garnish parts are deliberately ignored —
 * only chain appendages the plan actually declares are described.
 */
import type { CreaturePlan, PlanAppendage } from './planSchema';

/** Number words for totals up to twelve; larger totals fall back to digits. */
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
] as const;

function numberWord(n: number): string {
  return n >= 0 && n <= 12 ? NUMBER_WORDS[n] : String(n);
}

/**
 * Hue buckets, in degrees. Boundaries are perceptually weighted rather than
 * uniform 30-degree slices: a gold like #f2c14e sits at hue 42 and must read
 * as yellow, while #d98e3a at hue 32 must stay orange — even splits centered
 * on the classic wheel would call both orange. Red owns the wrap-around at
 * 345–360.
 */
const HUE_BUCKETS: Array<[upTo: number, name: string]> = [
  [20, 'red'],
  [40, 'orange'],
  [70, 'yellow'],
  [95, 'chartreuse'],
  [150, 'green'],
  [175, 'teal'],
  [200, 'cyan'],
  [235, 'blue'],
  [260, 'violet'],
  [285, 'purple'],
  [320, 'magenta'],
  [345, 'crimson'],
  [360, 'red'],
];

/**
 * Name a #rrggbb color in plain English. Low-saturation colors become
 * black, white, or gray; everything else gets a hue-bucket name with a
 * "dark " or "pale " prefix taken from lightness.
 */
export function colorNameForHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  // Achromatic colors have no meaningful hue: name them by lightness alone.
  if (saturation < 0.12) {
    if (lightness < 0.2) return 'black';
    if (lightness > 0.8) return 'white';
    return 'gray';
  }

  // Standard RGB-to-HSL hue, in degrees.
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta + 6) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);

  const bucket = HUE_BUCKETS.find(([upTo]) => hue < upTo);
  const name = bucket ? bucket[1] : 'red';

  if (lightness < 0.35) return `dark ${name}`;
  if (lightness > 0.7) return `pale ${name}`;
  return name;
}

/** How each appendage kind is worded, singular and plural. */
const KIND_WORDS: Record<Exclude<PlanAppendage['kind'], 'torso'>, { one: string; many: string }> = {
  leg: { one: 'leg', many: 'legs' },
  arm: { one: 'arm', many: 'arms' },
  wing: { one: 'membrane wing', many: 'membrane wings' },
  tail: { one: 'long tail', many: 'long tails' },
  tentacle: { one: 'tentacle', many: 'tentacles' },
  neck: { one: 'neck', many: 'necks' },
};

/** Fixed order for the appendage summary, most body-defining first. */
const KIND_ORDER: PlanAppendage['kind'][] = ['leg', 'arm', 'wing', 'tail', 'tentacle', 'neck', 'torso'];

/** Total limbs per kind after expanding perSide mirroring. */
function countByKind(appendages: PlanAppendage[]): Map<PlanAppendage['kind'], number> {
  const totals = new Map<PlanAppendage['kind'], number>();
  for (const a of appendages) {
    const expanded = a.count * (a.perSide ? 2 : 1);
    totals.set(a.kind, (totals.get(a.kind) ?? 0) + expanded);
  }
  return totals;
}

/** One phrase per present kind, e.g. "four legs, two arms, one long tail". */
function appendageSummary(totals: Map<PlanAppendage['kind'], number>): string[] {
  const phrases: string[] = [];
  for (const kind of KIND_ORDER) {
    const total = totals.get(kind) ?? 0;
    if (total === 0) continue;
    if (kind === 'torso') {
      // A torso reads as one feature no matter how many the plan declares.
      phrases.push('an upright humanoid torso');
      continue;
    }
    const words = KIND_WORDS[kind];
    phrases.push(`${numberWord(total)} ${total === 1 ? words.one : words.many}`);
  }
  return phrases;
}

/** Stance descriptor; legged creatures stand, legless ones lie or drift. */
function stancePhrase(stance: CreaturePlan['frame']['stance'], hasLegs: boolean): string {
  switch (stance) {
    case 'upright':
      return hasLegs ? 'standing upright on two legs' : 'upright';
    case 'horizontal':
      return hasLegs ? 'four-legged posture' : 'low horizontal body';
    case 'serpentine':
      return 'long serpentine body';
    case 'floating':
      return 'floating in the air';
  }
}

/** Head-form descriptors for the sculpted skull shapes. */
const HEAD_FORM_PHRASES: Record<NonNullable<CreaturePlan['heads'][number]['form']>, string> = {
  serpent: 'wedge-shaped reptilian head',
  beast: 'broad-muzzled beast head',
  blunt: 'rounded blunt head',
  skull: 'bony skull-like head',
};

/** Garnish parts that change the silhouette enough to belong in the prompt. */
const GARNISH_PHRASES: Record<string, string> = {
  wingsMembrane: 'large bat-like membrane wings',
  wingsFeathered: 'large feathered wings',
  hornsCurved: 'curved horns',
  crystalSpikes: 'jagged crystal spikes along the back',
  crest: 'jagged crest',
  shellBack: 'armored shell on the back',
};

/**
 * Build the hero-image prompt for a creature plan.
 * The result always opens with the full-body concept line and always ends
 * with the fixed sculpt-style phrase.
 */
export function heroImagePrompt(plan: CreaturePlan): string {
  const totals = countByKind(plan.appendages);
  const hasLegs = (totals.get('leg') ?? 0) > 0;

  const parts: string[] = [];
  parts.push(`Full body 3D character concept of ${plan.name}`);
  parts.push(stancePhrase(plan.frame.stance, hasLegs));

  // Size, in the feet-canon units the rest of the generator uses.
  const size =
    plan.frame.lengthFt !== undefined
      ? `about ${plan.frame.heightFt} feet tall and ${plan.frame.lengthFt} feet long`
      : `about ${plan.frame.heightFt} feet tall`;
  parts.push(size);

  parts.push(...appendageSummary(totals));

  if (plan.heads.length > 1) parts.push(`with ${numberWord(plan.heads.length)} heads`);
  const form = plan.heads[0]?.form;
  if (form) parts.push(HEAD_FORM_PHRASES[form]);

  // Garnish parts carry visual identity too — a dragon's wings and horns live
  // here, not in the appendage list.
  for (const g of plan.garnish ?? []) {
    const phrase = GARNISH_PHRASES[g.partId];
    if (phrase) parts.push(phrase);
  }

  // Palette, each color named and pinned to its hex so the model cannot drift.
  const { palette } = plan;
  const colored = (hex: string) => `${colorNameForHex(hex)} (${hex.toLowerCase()})`;
  parts.push(`body in ${colored(palette.bodyHex)}`);
  if (palette.accentHex) parts.push(`accents in ${colored(palette.accentHex)}`);
  if (palette.bellyHex) parts.push(`belly in ${colored(palette.bellyHex)}`);
  parts.push(`eyes in ${colored(palette.eyeHex)}`);
  if (palette.opacity !== undefined && palette.opacity < 1) {
    parts.push('semi-translucent ghostly body');
  }

  // Fixed framing so every hero shot composes the same way, then the house style.
  parts.push(
    'neutral standing pose',
    'solid neutral gray background',
    'clean silhouette',
    'no pedestal',
    'single creature',
    'stylized game sculpt, hand-painted look, high detail',
  );

  return parts.join(', ');
}
