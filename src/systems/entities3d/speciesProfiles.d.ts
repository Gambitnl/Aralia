/**
 * @file speciesProfiles.ts — authored visual profiles for humanoid species.
 *
 * One profile per visual family (~28). raceMap.ts maps every race id in the
 * game onto one of these plus small overrides. All lengths in FEET.
 */
import type { Gait, PartInstance } from './types';
export interface SpeciesProfile {
    id: string;
    gait: Gait;
    heightRangeFt: [number, number];
    bulkRange: [number, number];
    headScale: number;
    features: PartInstance[];
    skinTones: string[];
    eyeTones: string[];
}
export declare const SPECIES_PROFILES: Record<string, SpeciesProfile>;
