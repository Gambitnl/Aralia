/**
 * @file src/data/classes/tierOneFeatures.ts
 * Level 2 and 3 class features (the tier-1 progression), keyed by class id.
 *
 * The base CLASSES_DATA `features` arrays only define level-1 features, so a
 * leveled character gained no new class content on the sheet — level 2–3 read as
 * "a level-1 character with more HP." This supplies the standard 2024-PHB level
 * 2–3 features (including the level-3 subclass milestone) so progression shows up.
 *
 * Surfaced via `classFeaturesForLevel` (see ./classFeatureProgression.ts), which
 * merges these with the base level-1 features filtered to the character's level.
 * Kept separate from CLASSES_DATA on purpose: many creation-time UIs render
 * `class.features` unfiltered, and we don't want level-2/3 features showing as
 * already-owned at level 1.
 */
import { ClassFeature } from '../../types/character';
export declare const TIER_ONE_FEATURES: Record<string, ClassFeature[]>;
