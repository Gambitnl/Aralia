/**
 * @file src/data/classes/classFeatureProgression.ts
 * Resolve the class features a character has actually gained by their level,
 * merging the base level-1 features (on the Class) with the level 2–3 tier-one
 * features (in TIER_ONE_FEATURES) and filtering to `levelAvailable <= level`.
 */
import { Class, ClassFeature } from '../../types/character';
/**
 * The class features owned at the given character level, ordered by the level
 * they were gained. Base level-1 features win over any duplicate id. When a
 * `subclassId` is supplied (the level-3 choice), that subclass's features are
 * folded in too, so the sheet shows the specialization's abilities.
 */
export declare function classFeaturesForLevel(cls: Class | undefined, level: number, subclassId?: string): ClassFeature[];
