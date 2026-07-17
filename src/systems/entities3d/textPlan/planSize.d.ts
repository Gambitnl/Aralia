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
export declare function planMaxDimensionFt(plan: CreaturePlan): number;
/** D&D size category from the plan's dimensions. */
export declare function sizeCategoryForPlan(plan: CreaturePlan): SizeCategory;
/** Combat footprint in tiles per side (5 ft tiles): ½, 1, 1, 2, 3, 4. */
export declare function footprintTiles(size: SizeCategory): number;
