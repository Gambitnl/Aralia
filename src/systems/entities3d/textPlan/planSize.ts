/**
 * @file planSize.ts — D&D size category + combat tile footprint for a plan.
 *
 * Combat ground truth: 1 battle-map tile = 5 ft (1.524 m); CharacterActor
 * converts entity meters to tile units. A creature's category comes from its
 * LARGEST dimension so long horizontals (dragons) claim the space they
 * actually cover.
 */
import type { SizeCategory } from '../types';
import type { CreaturePlan } from './planSchema';

/** Largest plan dimension in feet (height, or nose-to-tail length). */
export function planMaxDimensionFt(plan: CreaturePlan): number {
  return Math.max(plan.frame.heightFt, plan.frame.lengthFt ?? 0);
}

/** D&D size category from the plan's dimensions. */
export function sizeCategoryForPlan(plan: CreaturePlan): SizeCategory {
  const d = planMaxDimensionFt(plan);
  if (d <= 2.5) return 'Tiny';
  if (d <= 4) return 'Small';
  if (d <= 6) return 'Medium';
  if (d <= 10) return 'Large';
  if (d <= 15) return 'Huge';
  return 'Gargantuan';
}

/** Combat footprint in tiles per side (5 ft tiles): ½, 1, 1, 2, 3, 4. */
export function footprintTiles(size: SizeCategory): number {
  switch (size) {
    case 'Tiny':
      return 0.5;
    case 'Small':
    case 'Medium':
      return 1;
    case 'Large':
      return 2;
    case 'Huge':
      return 3;
    case 'Gargantuan':
      return 4;
  }
}
