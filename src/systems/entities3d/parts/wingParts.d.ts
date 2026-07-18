import type { PartDef } from '../types';
/** One membrane sail: a triangle fan between a wing-root and finger tips. */
/**
 * Dragon Forge technique: a hand-authored rim polygon (leading edge up, then
 * a scalloped trailing edge whose rim points sag between finger tips) fed to
 * ShapeUtils.triangulateShape — one flat membrane whose curvature is baked
 * into the points. Finger positions are exported so spars can fan to them.
 */
export declare function membraneRim(sgn: number, s: number, sag?: number): Array<[number, number, number]>;
export declare const WING_PARTS: PartDef[];
