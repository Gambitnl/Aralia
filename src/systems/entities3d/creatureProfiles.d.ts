import type { Frame, Gait, Palette, PartInstance, SizeCategory } from './types';
export declare const SIZE_ORDER: readonly SizeCategory[];
export interface CreatureResolved {
    gait: Gait;
    frame: Frame;
    parts: PartInstance[];
    palette: Palette;
    /** Banks for seeded variation in the blueprint generator. */
    skinTones: string[];
}
/** Resolve creature type × size (+ cues) to a body plan. Throws on unknown types. */
export declare function profileForCreature(creatureType: string, size: SizeCategory, cues?: string[]): CreatureResolved;
