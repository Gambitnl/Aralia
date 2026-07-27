/**
 * @file acceptedEntities.ts — the approved creature library as a runtime source.
 *
 * Text-to-creature runs write entries to src/data/creatures3d/plans/*.json.
 * Vite bundles them all through import.meta.glob, so approved creatures load
 * with the game — no regeneration, no fetch. Only entries a human approved in
 * the review library pass the filter; 'generated' drafts must never leak into
 * the game.
 *
 * Combat monster spawning consults this library FIRST (see
 * recipeFromCombatant): an approved creature with a matching name beats the
 * procedural creature path by design, not as a fallback.
 */
import type { CreaturePlan } from '../textPlan/planSchema';
import type { EntityRecipe } from '../types';
/** One approved library creature, ready for the game to spawn. */
export interface AcceptedEntity {
    id: string;
    name: string;
    plan: CreaturePlan;
    sizeCategory?: string;
    /** Path to a pre-baked hero GLB, when one was exported for this creature. */
    heroGlb?: string;
}
/**
 * Map a glob module record to accepted entities. Pure, so tests can feed
 * fake module maps. JSON modules arrive either bare or wrapped in
 * { default } depending on the importer — both shapes are handled. Only
 * status 'approved' passes; keys are sorted so the order is stable.
 */
export declare function entriesFromModules(mods: Record<string, unknown>): AcceptedEntity[];
/** Every approved library creature. */
export declare function approvedEntries(): AcceptedEntity[];
/** Look up an approved creature by its library id; null when absent. */
export declare function acceptedById(id: string): AcceptedEntity | null;
/**
 * Look up an approved creature by display name — trimmed, case-insensitive
 * EXACT match. Partial matches never count: a miss means the caller's own
 * path decides, not a fuzzy guess.
 */
export declare function acceptedByName(name: string): AcceptedEntity | null;
/** The recipe that spawns an approved creature: its stored plan, seeded by its id. */
export declare function recipeForAccepted(e: AcceptedEntity): EntityRecipe;
/** Test seam: replace the entry source; pass null to restore the production glob. */
export declare function __setEntriesForTests(entries: AcceptedEntity[] | null): void;
