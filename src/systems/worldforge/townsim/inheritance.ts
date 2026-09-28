// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 08:43:59
 * Dependents: systems/worldforge/townsim/townSim.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file inheritance.ts — who inherits when a villager dies.
 *
 * The living-world sim already killed villagers and moved their wealth, but it
 * resolved heirs inline in `townSim.applyInheritance` with a two-step rule
 * (living children, else living spouse) and no notion of WHY someone inherited.
 * That inlining is why the estate silently evaporated whenever a childless,
 * widowed villager died — a sibling or a housemate under the same roof got
 * nothing, and the town lost the wealth from its economy.
 *
 * This file lifts heir resolution out as a pure, testable rule with the full
 * succession ladder the family-tree design calls for:
 *
 *     spouse > child > sibling > unrelated housemate
 *
 * Preserved on purpose:
 *  - The estate still splits EQUALLY within a tier, eldest first for the
 *    remainder, exactly as the old child-split did.
 *  - `state` is never read here. The function takes the villager table so the
 *    ladder can be unit-tested and reused by any future probate/UI surface
 *    (a will, a disputed estate, a "who gets the shop" prompt) without dragging
 *    in the whole town sim.
 *
 * Behavior change (intentional, per the family-tree spec): a surviving SPOUSE
 * now inherits ahead of the children rather than after them. Widow-first is the
 * common medieval-fantasy expectation and keeps the household solvent instead of
 * handing a household's savings to a five-year-old. Children still inherit in
 * full on the spouse's own later death, so nothing is lost across a generation.
 *
 * Called by: townSim.applyInheritance.
 * Depends on: types.ts only (no rng, no clock, no state mutation).
 */
import type { LivingVillager } from './types';

/** Why a given heir has a claim. Ordered strongest-first; also the ladder order. */
export type HeirTier = 'spouse' | 'child' | 'sibling' | 'housemate';

/** The ladder, strongest claim first. Exported so UI can label/sort consistently. */
export const HEIR_TIERS: readonly HeirTier[] = ['spouse', 'child', 'sibling', 'housemate'];

/** One resolved claim on a deceased villager's estate. */
export interface HeirClaim {
  heirId: number;
  tier: HeirTier;
}

const isAlive = (v: LivingVillager | undefined): v is LivingVillager =>
  v !== undefined && v.diedDay === undefined;

/** Eldest first, then by id — total order, so estates split deterministically. */
function byAge(a: LivingVillager, b: LivingVillager): number {
  return a.bornDay - b.bornDay || a.occupantId - b.occupantId;
}

/**
 * Living full/half siblings: anyone sharing at least one parent with the
 * deceased. The sim never stores sibling links (they are derivable and would
 * otherwise need repairing on every birth), so they are computed here.
 */
function livingSiblings(
  villagers: Record<number, LivingVillager>,
  deceased: LivingVillager,
): LivingVillager[] {
  if (deceased.parentIds.length === 0) return [];
  return Object.values(villagers)
    .filter(
      (v) =>
        isAlive(v) &&
        v.occupantId !== deceased.occupantId &&
        v.parentIds.some((p) => deceased.parentIds.includes(p)),
    )
    .sort(byAge);
}

/**
 * Living residents of the deceased's home plot who are NOT blood or marriage
 * kin — the lodger, the servant, the apprentice sharing the workshop loft. Last
 * rung of the ladder: better the estate stays in the house than vanishes.
 */
function livingHousemates(
  villagers: Record<number, LivingVillager>,
  deceased: LivingVillager,
  kin: ReadonlySet<number>,
): LivingVillager[] {
  return Object.values(villagers)
    .filter(
      (v) =>
        isAlive(v) &&
        v.occupantId !== deceased.occupantId &&
        v.homePlotId === deceased.homePlotId &&
        !kin.has(v.occupantId),
    )
    .sort(byAge);
}

/**
 * Resolve the estate claim for one deceased villager.
 *
 * Returns EVERY heir in the single strongest tier that has any living member —
 * tiers do not mix, so a widow does not share with her children. An empty array
 * means the line ended with nobody in the house: the caller decides what that
 * means (today the wealth is simply lost).
 *
 * Pure: reads `villagers`, mutates nothing.
 */
export function resolveHeirs(
  villagers: Record<number, LivingVillager>,
  deceased: LivingVillager,
): HeirClaim[] {
  // Kin set doubles as the "related" filter for the housemate rung below, so it
  // is built once from every relation the sim actually stores.
  const kin = new Set<number>([deceased.occupantId, ...deceased.parentIds, ...deceased.childIds]);
  if (deceased.spouseId !== undefined) kin.add(deceased.spouseId);

  const spouse = deceased.spouseId !== undefined ? villagers[deceased.spouseId] : undefined;
  if (isAlive(spouse)) return [{ heirId: spouse.occupantId, tier: 'spouse' }];

  const children = deceased.childIds
    .map((id) => villagers[id])
    .filter(isAlive)
    .sort(byAge);
  if (children.length > 0) {
    return children.map((c) => ({ heirId: c.occupantId, tier: 'child' as const }));
  }

  const siblings = livingSiblings(villagers, deceased);
  for (const s of siblings) kin.add(s.occupantId);
  if (siblings.length > 0) {
    return siblings.map((s) => ({ heirId: s.occupantId, tier: 'sibling' as const }));
  }

  const housemates = livingHousemates(villagers, deceased, kin);
  return housemates.map((h) => ({ heirId: h.occupantId, tier: 'housemate' as const }));
}

/**
 * Split `amount` across `count` heirs: equal shares, with the remainder handed
 * out one coin at a time in claim order (eldest first). Sum of the returned
 * shares always equals `amount`, so no wealth is created or destroyed.
 */
export function splitEstate(amount: number, count: number): number[] {
  if (count <= 0) return [];
  const share = Math.floor(amount / count);
  let remainder = amount - share * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return share + extra;
  });
}
