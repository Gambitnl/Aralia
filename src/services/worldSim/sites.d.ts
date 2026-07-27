/**
 * @file sites.ts
 * Score-and-spacing placement of towns (high score) and dungeons/ruins (wilderness pockets).
 *
 * Towns score on flatness × (1 + riverProximity*2 + coastProximity*1.5). Dungeons/ruins
 * score inversely (rough, remote, away from water). Greedy placement honours per-kind
 * minimum spacing.
 */
import type { River, Site } from './types';
import { SeededRandom } from '@/utils/random';
export interface SiteTargets {
    townTarget: number;
    dungeonTarget: number;
    ruinTarget: number;
}
export declare function placeSites(heights: number[], cols: number, rows: number, rivers: River[], rng: SeededRandom, targets: SiteTargets): Site[];
