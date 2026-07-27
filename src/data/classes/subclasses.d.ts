/**
 * @file src/data/classes/subclasses.ts
 * Subclasses (the level-3 milestone) per class, with the features each grants at
 * level 3 — the defining choice of tier 1. Before this, no subclass data existed,
 * so a level-3 character never made their signature specialization choice.
 *
 * Two iconic options per class so the level-3 choice is real. Surfaced by
 * `subclassFeaturesForLevel` and applied in `performLevelUp`.
 */
import { ClassFeature } from '../../types/character';
export interface Subclass {
    id: string;
    classId: string;
    name: string;
    description: string;
    /** Features granted by this subclass, each with the level it's gained. */
    features: ClassFeature[];
}
export declare const SUBCLASSES: Record<string, Subclass[]>;
/** All subclass options for a class (empty if the class has none defined). */
export declare function subclassesForClass(classId: string): Subclass[];
/** Look up a specific subclass by class + id. */
export declare function findSubclass(classId: string, subclassId: string | undefined): Subclass | undefined;
