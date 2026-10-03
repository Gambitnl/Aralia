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

/** Raw shape of a plans/*.json library entry, as the review CLI writes it. */
interface LibraryEntryFile {
  id: string;
  name: string;
  plan: CreaturePlan;
  status: 'generated' | 'approved';
  sizeCategory?: string;
  heroGlb?: string;
}

/** Loose structural check — malformed files are skipped, never fatal. */
function isLibraryEntry(v: unknown): v is LibraryEntryFile {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.status === 'string' &&
    typeof e.plan === 'object' &&
    e.plan !== null
  );
}

/**
 * Map a glob module record to accepted entities. Pure, so tests can feed
 * fake module maps. JSON modules arrive either bare or wrapped in
 * { default } depending on the importer — both shapes are handled. Only
 * status 'approved' passes; keys are sorted so the order is stable.
 */
export function entriesFromModules(mods: Record<string, unknown>): AcceptedEntity[] {
  const out: AcceptedEntity[] = [];
  for (const key of Object.keys(mods).sort()) {
    const mod = mods[key];
    const raw = (mod as { default?: unknown } | null)?.default ?? mod;
    if (!isLibraryEntry(raw) || raw.status !== 'approved') continue;
    out.push({
      id: raw.id,
      name: raw.name,
      plan: raw.plan,
      ...(raw.sizeCategory !== undefined ? { sizeCategory: raw.sizeCategory } : {}),
      ...(raw.heroGlb !== undefined ? { heroGlb: raw.heroGlb } : {}),
    });
  }
  return out;
}

/** Production entries, computed once from the bundled glob and cached. */
let productionCache: AcceptedEntity[] | null = null;

/** Test seam — when set, replaces the production source entirely. */
let testEntries: AcceptedEntity[] | null = null;

function productionEntries(): AcceptedEntity[] {
  if (productionCache === null) {
    const mods = import.meta.glob('/src/data/creatures3d/plans/*.json', { eager: true });
    productionCache = entriesFromModules(mods as Record<string, unknown>);
  }
  return productionCache;
}

/** Every approved library creature. */
export function approvedEntries(): AcceptedEntity[] {
  return testEntries ?? productionEntries();
}

/** Look up an approved creature by its library id; null when absent. */
export function acceptedById(id: string): AcceptedEntity | null {
  return approvedEntries().find((e) => e.id === id) ?? null;
}

/**
 * Look up an approved creature by display name — trimmed, case-insensitive
 * EXACT match. Partial matches never count: a miss means the caller's own
 * path decides, not a fuzzy guess.
 */
export function acceptedByName(name: string): AcceptedEntity | null {
  const wanted = name.trim().toLowerCase();
  return approvedEntries().find((e) => e.name.trim().toLowerCase() === wanted) ?? null;
}

/** The recipe that spawns an approved creature: its stored plan, seeded by its id. */
export function recipeForAccepted(e: AcceptedEntity): EntityRecipe {
  return { kind: 'planned', plan: e.plan, seed: e.id };
}

/** Test seam: replace the entry source; pass null to restore the production glob. */
export function __setEntriesForTests(entries: AcceptedEntity[] | null): void {
  testEntries = entries;
}
