// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 08:43:22
 * Dependents: components/World3D/dungeonEntryRuntime.ts, systems/worldforge/bridge/dungeonEntrances.ts, systems/worldforge/dungeon/world/rumors.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file deriveIdentity.ts — Pillar 2, Task 3: turn a DungeonSite into the fully
 * WORLD-DERIVED generation parameters and naming a dungeon needs.
 *
 * A `DungeonSite` (Task 1/2) says WHERE a dungeon is and WHAT flavor it is. This
 * layer answers HOW BIG, HOW DEADLY, and WHO BUILT IT — every answer read from
 * the real atlas around the site's cell, never from a fixed table:
 *
 *  - `params.theme` / `params.archetype` come straight off the site.
 *  - `params.roomCount` scales with the site cell's DANGER (computeDangerField)
 *    and its REMOTENESS (distance to the nearest burg): a calm cell next to a
 *    town is a small 24-room dungeon; a war-bled cell deep in the wilds runs up
 *    to ~54 rooms. Deterministic closed-form (see {@link scaleRoomCount}).
 *  - `params.partyLevel` = 1 + round(danger × 7), clamped [1, 8].
 *  - `params.sprawl` is LEFT UNDEFINED so the archetype's own seeded default
 *    stands (the generator resolves it on its 'sprawl' stream).
 *  - `world.builderStem` is a CULTURE-CORRECT person/house name drawn from the
 *    nearest burg's culture namer (`getBurgNamer`) on a NEW `s:builder` stream
 *    off the site's frozen sitePath. `world.builderName` runs that stem through
 *    the archetype's `builderPatterns` template. `world.townName` is the burg
 *    the dungeon belongs to (its own burg for temple/sewer sites, the nearest
 *    burg for wilderness sites).
 *
 * The danger field is expensive (a full BFS bleed over every zone), so it is
 * cached per world seed — every site in a world reads the one field.
 *
 * No-fallback (Aralia directive): a world with NO burgs cannot name a builder,
 * so we throw honestly rather than invent an English placeholder.
 *
 * Pure data, zero THREE imports, deterministic (new streams only — perturbs no
 * existing worldforge golden).
 */
import { streamPath, rngFromPath, type SeedPath } from '../../seedPath';
import { getBridgeAtlas, getBurgNamer } from '../../bridge/legacySubmapBridge';
import { computeDangerField } from '../../overlays/dangerField';
import { ARCHETYPES } from '../archetypes';
import { generateDungeon } from '../generateDungeon';
import type { DungeonParams, DungeonPlan, WorldIdentity } from '../types';
import { enumerateDungeonSites, type DungeonSite } from './dungeonSites';
import { chronicleForSite } from './chronicle';
import { canonicalDungeonId, type DungeonIdentity } from './dungeonIdentity';

// Existing callers import the receipt from this generation boundary. Re-exporting the lightweight
// owner preserves that public path while allowing state/save code to avoid the atlas dependency.
export { canonicalDungeonId, type DungeonIdentity } from './dungeonIdentity';

// ============================================================================
// Canonical Dungeon Runtime Identity
// ============================================================================
// The world entrance, runtime generator, and future save-state owner all pass
// this same small plain-data receipt. The dungeon id is deliberately derived
// from the frozen site seed path, so the two values cannot drift independently.
// ============================================================================

/** Build the identity receipt attached to a known canonical world site. */
export function dungeonIdentityForSite(site: DungeonSite): DungeonIdentity {
  return {
    dungeonId: canonicalDungeonId(site.sitePath),
    seedPath: site.sitePath,
  };
}

/** Read and validate the world seed embedded in a dungeon seed path. */
function worldSeedForDungeonIdentity(seedPath: SeedPath): number {
  const match = /^wf:(\d+)\//.exec(seedPath);
  if (!match) {
    throw new Error(`Dungeon identity has a malformed seed path: "${seedPath}".`);
  }

  // Worldforge serializes roots from unsigned 32-bit seeds. Requiring the same
  // canonical spelling rejects negative, fractional, padded, or overflow roots.
  const worldSeed = Number(match[1]) >>> 0;
  if (!Number.isSafeInteger(Number(match[1])) || !seedPath.startsWith(`wf:${worldSeed}/`)) {
    throw new Error(`Dungeon identity has a malformed seed path: "${seedPath}".`);
  }
  return worldSeed;
}

/**
 * Resolve a serialized identity back to its authoritative world attachment.
 *
 * Every failure is explicit: absent fields, an id/path mismatch, a wrong world,
 * or a path that no longer names a site all throw before generation begins.
 */
export function resolveDungeonIdentity(
  identity: DungeonIdentity,
  expectedWorldSeed?: number,
): { worldSeed: number; site: DungeonSite } {
  if (!identity || !identity.dungeonId || !identity.seedPath) {
    throw new Error('Dungeon runtime identity is missing its dungeon id or seed path.');
  }

  const worldSeed = worldSeedForDungeonIdentity(identity.seedPath);
  const expectedDungeonId = canonicalDungeonId(identity.seedPath);
  if (identity.dungeonId !== expectedDungeonId) {
    throw new Error(
      `Dungeon identity mismatch: id "${identity.dungeonId}" does not match seed path "${identity.seedPath}".`,
    );
  }

  // A caller that already owns a world seed (the ground-window bridge) must
  // agree with the seed embedded in the receipt instead of silently crossing worlds.
  if (expectedWorldSeed !== undefined && worldSeed !== (expectedWorldSeed >>> 0)) {
    throw new Error(
      `Dungeon identity world mismatch: seed path belongs to world ${worldSeed}, not world ${expectedWorldSeed >>> 0}.`,
    );
  }

  const site = enumerateDungeonSites(worldSeed).find(
    (candidate) => candidate.sitePath === identity.seedPath,
  );
  if (!site) {
    throw new Error(
      `Dungeon identity "${identity.dungeonId}" does not resolve to a world attachment.`,
    );
  }

  return { worldSeed, site };
}

/** Base room count for a calm, town-adjacent site (danger ≈ remoteness ≈ 0). */
const ROOM_BASE = 24;
/** Total room count added at maximum combined danger+remoteness (→ ~54 rooms). */
const ROOM_SPAN = 30;
/** Danger weight in the combined size driver; remoteness carries the remainder. */
const DANGER_WEIGHT = 0.6;
const REMOTE_WEIGHT = 1 - DANGER_WEIGHT; // 0.4
/**
 * Reference distance (FMG px) at which a site reads as "fully remote". FMG maps
 * span ~1000 px on the long axis; a site a quarter-map from any town is as
 * remote as the size driver cares about, so remoteness saturates at 250 px.
 */
const REMOTE_SATURATION_PX = 250;
/** Party-level ceiling — a level-1 party's world tops out here (design cap). */
const PARTY_LEVEL_MAX = 8;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── Danger field cache (one per world seed; every site reads the same field) ──
const dangerCache = new Map<number, Float32Array>();

function dangerFieldFor(worldSeed: number): Float32Array {
  const key = worldSeed >>> 0;
  let field = dangerCache.get(key);
  if (!field) {
    field = computeDangerField(getBridgeAtlas(worldSeed));
    dangerCache.set(key, field);
  }
  return field;
}

interface BurgLike {
  i?: number;
  cell?: number;
  removed?: boolean;
  name?: string;
}

/**
 * The nearest LIVE burg to a cell — its id, name, and squared FMG-px distance.
 * Skips the phantom burg 0 and removed burgs. Ties break to the lowest id for
 * determinism. Returns undefined only when the world has NO live burgs.
 *
 * `nearBurgIdsForCell` gives burgs WITHIN a radius but unordered; identity needs
 * the single closest one regardless of range, so we scan directly over the burg
 * seat positions (the same `pack.cells.p` field that helper reads).
 */
function nearestBurg(
  worldSeed: number,
  cellId: number,
): { burgId: number; name: string; dist2: number } | undefined {
  const atlas = getBridgeAtlas(worldSeed);
  const p = atlas.pack.cells.p as ReadonlyArray<readonly [number, number]>;
  const origin = p[cellId];
  if (!origin) return undefined;
  const burgs = (atlas.pack.burgs ?? []) as BurgLike[];
  let bestId: number | undefined;
  let bestName = '';
  let bestD2 = Infinity;
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') continue;
    const site = p[b.cell];
    if (!site) continue;
    const dx = site[0] - origin[0];
    const dy = site[1] - origin[1];
    const d2 = dx * dx + dy * dy;
    const id = typeof b.i === 'number' ? b.i : i;
    if (d2 < bestD2 || (d2 === bestD2 && (bestId === undefined || id < bestId))) {
      bestD2 = d2;
      bestId = id;
      bestName = b.name ?? '';
    }
  }
  return bestId === undefined ? undefined : { burgId: bestId, name: bestName, dist2: bestD2 };
}

/** The name of a specific live burg (for temple/sewer sites that own a burg). */
function burgName(worldSeed: number, burgId: number): string {
  const atlas = getBridgeAtlas(worldSeed);
  const b = (atlas.pack.burgs ?? [])[burgId] as BurgLike | undefined;
  return b?.name ?? '';
}

/**
 * Room count for a site, a deterministic closed form of DANGER and REMOTENESS:
 *
 *   remoteness = clamp01( sqrt(dist²ToNearestBurg) / REMOTE_SATURATION_PX )
 *   combined   = clamp01( DANGER_WEIGHT·danger + REMOTE_WEIGHT·remoteness )
 *   roomCount  = round( ROOM_BASE + ROOM_SPAN · combined )
 *
 * → 24 at a calm town-adjacent cell, up to ~54 at a max-danger, quarter-map-
 * remote cell. Monotone non-decreasing in danger AND in remoteness by
 * construction (both terms have non-negative weights and enter linearly).
 */
export function scaleRoomCount(danger: number, dist2ToBurg: number): number {
  const remoteness = clamp01(Math.sqrt(dist2ToBurg) / REMOTE_SATURATION_PX);
  const combined = clamp01(DANGER_WEIGHT * clamp01(danger) + REMOTE_WEIGHT * remoteness);
  return Math.round(ROOM_BASE + ROOM_SPAN * combined);
}

/** Party level from danger: 1 at calm, up to PARTY_LEVEL_MAX at max danger. */
export function scalePartyLevel(danger: number): number {
  const lvl = 1 + Math.round(clamp01(danger) * 7);
  return lvl < 1 ? 1 : lvl > PARTY_LEVEL_MAX ? PARTY_LEVEL_MAX : lvl;
}

/**
 * Derive a site's full generation parameters + world naming context.
 *
 * Determinism: the builder stem is drawn on a NEW `s:builder` stream off the
 * site's own frozen `sitePath`, so the same site always names the same builder
 * and nothing existing shifts. The danger field is cached per world seed.
 */
export function deriveDungeonIdentity(
  worldSeed: number,
  site: DungeonSite,
): { params: DungeonParams; world: WorldIdentity } {
  const field = dangerFieldFor(worldSeed);
  const danger = clamp01(field[site.cellId] ?? 0);

  // The town the dungeon belongs to: its own burg for temple/sewer sites, else
  // the nearest live burg. Both routes need a live burg — no-fallback throw when
  // the world has none (a builder cannot be culture-named without one).
  let ownerBurgId: number;
  let townName: string;
  let dist2ToBurg: number;
  if (site.burgId !== undefined) {
    ownerBurgId = site.burgId;
    townName = burgName(worldSeed, site.burgId);
    dist2ToBurg = 0; // the site sits at its own burg's seat cell
  } else {
    const near = nearestBurg(worldSeed, site.cellId);
    if (!near) {
      throw new Error(
        `deriveDungeonIdentity: world ${worldSeed} has no live burgs — cannot name a builder for site ${site.sitePath}.`,
      );
    }
    ownerBurgId = near.burgId;
    townName = near.name;
    dist2ToBurg = near.dist2;
  }

  // Builder stem: a culture-correct name from the owner burg's namer, drawn on
  // the site's own 's:builder' stream (a real person/house name for this world's
  // culture — replaces lore's fixed English namePool).
  const namer = getBurgNamer(worldSeed, ownerBurgId);
  const builderRng = rngFromPath(streamPath(site.sitePath, 'builder'));
  const builderStem = namer({ next: () => builderRng.next() });

  // builderName: the stem through the archetype's builder pattern. {T} → town
  // name (or the archetype placeholder if the world gave no name); {N} → stem.
  const arch = ARCHETYPES[site.archetype];
  const patternRng = rngFromPath(streamPath(site.sitePath, 'builder-pattern'));
  const pattern = arch.builderPatterns[
    Math.min(arch.builderPatterns.length - 1, Math.floor(patternRng.next() * arch.builderPatterns.length))
  ];
  const townForPattern = townName || arch.townPlaceholder || 'the old town';
  const builderName = pattern
    .replace(/\{N\}/g, builderStem)
    .replace(/\{T\}/g, townForPattern)
    .replace(/\bthe the\b/g, 'the');

  // Biome name for biome-flavored monster spawns (bestiaryForSite).
  const atlas = getBridgeAtlas(worldSeed);
  const biomeId = atlas.pack.cells.biome?.[site.cellId];
  const biomeName = biomeId != null ? atlas.biomesData?.name?.[biomeId] : undefined;

  const params: DungeonParams = {
    roomCount: scaleRoomCount(danger, dist2ToBurg),
    partyLevel: scalePartyLevel(danger),
    theme: site.theme,
    archetype: site.archetype,
    // Left for the generator's defaults (resolved on their own streams):
    loopChance: 0.25,
    decorDensity: 0.6,
    // sprawl deliberately omitted — archetype default stands.
    ...(biomeName ? { biomeName } : {}),
  };

  const world: WorldIdentity = { builderName, builderStem };
  if (townName) world.townName = townName;
  // Chronicle grounding (Pillar 2, Task 4): the real world zones near this site,
  // each with a world-consistent derived age. simulateHistory binds matching
  // events and quotes the real names. Empty when no zone touches the site.
  const chronicle = chronicleForSite(worldSeed, site);
  if (chronicle.length > 0) world.chronicle = chronicle;

  return { params, world };
}

/**
 * One-call convenience: derive a site's identity, then generate its full plan.
 *
 * Seeding choice (the honest one): the dungeon seeds from the site's FROZEN
 * `sitePath` via `DungeonInput.seedPath`. The generator consumes that path
 * VERBATIM because the frozen site grammar already ends in `dungeon:<site>`;
 * it must not append a second dungeon segment. This ties the plan's determinism
 * to the site's world identity without hashing the path down to a lossy numeric
 * seed. `input.seed` is still stamped on the plan for provenance.
 */
export function generateDungeonForSite(worldSeed: number, site: DungeonSite): DungeonPlan {
  const { params, world } = deriveDungeonIdentity(worldSeed, site);
  return generateDungeon({
    seed: worldSeed >>> 0,
    seedPath: site.sitePath,
    params,
    world,
  });
}

/**
 * Existing runtime generation boundary, addressed only by canonical identity.
 *
 * This is the handoff future entry/save/revisit work should call. It resolves
 * the saved receipt back to the real world site, then reuses the established
 * world-derived identity and generator path instead of reconstructing params.
 */
export function generateDungeonForIdentity(
  identity: DungeonIdentity,
  expectedWorldSeed?: number,
): DungeonPlan {
  const { worldSeed, site } = resolveDungeonIdentity(identity, expectedWorldSeed);
  return generateDungeonForSite(worldSeed, site);
}
