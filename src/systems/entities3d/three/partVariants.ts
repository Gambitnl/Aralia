/**
 * @file partVariants.ts — the part-slot catalog (part-quality campaign,
 * Part Lab step, 2026-08-21).
 *
 * A SLOT is one body region that the generator can build more than one way
 * (hand, head, foot). A VARIANT is one candidate build for a slot. The Part
 * Lab (`design.html?step=partlab`) shows a full entity and lets the reviewer
 * swap each slot between its variants, so a candidate is judged ON the body,
 * not as a floating specimen.
 *
 * This module carries no three.js import on purpose: the lab toolbar (eager
 * bundle) reads the catalog, and a value import from the 3D chunk would drag
 * three into the main bundle (the vite eager-3D-leak trap).
 *
 * No fallbacks: an unknown variant id throws.
 */

export type HandVariant = 'reference' | 'lofted' | 'template' | 'none';
export type HeadVariant = 'humanoid' | 'beast' | 'blunt' | 'serpent' | 'skull' | 'none';
export type FootVariant = 'wedge' | 'none';

/** One variant id per slot — the full choice the assembler builds. */
export interface PartChoice {
  hand: HandVariant;
  head: HeadVariant;
  foot: FootVariant;
}
export type PartSlot = keyof PartChoice;
export const PART_SLOTS: readonly PartSlot[] = ['hand', 'head', 'foot'];

export interface PartVariantDef<S extends PartSlot = PartSlot> {
  id: PartChoice[S];
  label: string;
  /** What the variant is, for the reviewer. */
  note: string;
}

/** The shipping build — what every game surface renders today. */
export const DEFAULT_PART_CHOICE: Readonly<PartChoice> = { hand: 'reference', head: 'humanoid', foot: 'wedge' };

export const PART_VARIANTS: { readonly [S in PartSlot]: readonly PartVariantDef<S>[] } = {
  hand: [
    { id: 'reference', label: 'reference mesh', note: 'The licensed low-poly hand, digit-wrapped onto the rest layout and skinned to the finger bones. Shipping.' },
    { id: 'lofted', label: 'lofted chains', note: 'The round-15 tube hand: palm, thenar wedge, thumb, and four two-link finger tubes lofted per bone.' },
    { id: 'template', label: 'template (quad)', note: 'The authored quad-topology hand, rigid to the hand bone. Static splay; the finger bones do not drive it.' },
    { id: 'none', label: 'none (wrist cut)', note: 'No hand. Shows the forearm end and the wrist seam.' },
  ],
  head: [
    { id: 'humanoid', label: 'humanoid sculpt', note: 'The one-loft humanoid head with the per-race face. Shipping.' },
    { id: 'beast', label: 'beast form', note: 'The creature beast skull on the head bone, eyes at the plan station.' },
    { id: 'blunt', label: 'blunt form', note: 'The creature blunt skull on the head bone.' },
    { id: 'serpent', label: 'serpent form', note: 'The creature serpent skull on the head bone.' },
    { id: 'skull', label: 'skull form', note: 'The creature bare skull on the head bone.' },
    { id: 'none', label: 'none (neck cut)', note: 'No head. Shows the neck top and the trapezius wedge.' },
  ],
  foot: [
    { id: 'wedge', label: 'heel-to-toe wedge', note: 'The round-5 capped wedge tube rigid to the foot bone. Shipping.' },
    { id: 'none', label: 'none (ankle cut)', note: 'No foot. Shows the shin end.' },
  ],
};

function isVariant<S extends PartSlot>(slot: S, id: string): id is PartChoice[S] {
  return PART_VARIANTS[slot].some((v) => v.id === id);
}

/** Fill a partial choice from the defaults. Throws on an unknown id. */
export function resolvePartChoice(partial?: Partial<Record<PartSlot, string>>): PartChoice {
  const out = { ...DEFAULT_PART_CHOICE };
  if (!partial) return out;
  for (const slot of PART_SLOTS) {
    const id = partial[slot];
    if (id === undefined) continue;
    if (!isVariant(slot, id)) {
      throw new Error(`partVariants: unknown ${slot} variant "${id}" (known: ${PART_VARIANTS[slot].map((v) => v.id).join(', ')})`);
    }
    (out as Record<PartSlot, string>)[slot] = id;
  }
  return out;
}

/** Read `?hand=&head=&foot=` from a query string. Absent slots stay default. */
export function partChoiceFromQuery(q: URLSearchParams): PartChoice {
  const partial: Partial<Record<PartSlot, string>> = {};
  for (const slot of PART_SLOTS) {
    const v = q.get(slot);
    if (v) partial[slot] = v;
  }
  return resolvePartChoice(partial);
}

/** True when the choice is the shipping build — callers skip the slot path. */
export function isDefaultPartChoice(c: PartChoice): boolean {
  return PART_SLOTS.every((s) => c[s] === DEFAULT_PART_CHOICE[s]);
}
