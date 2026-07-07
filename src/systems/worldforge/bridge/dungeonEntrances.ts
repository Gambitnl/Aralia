/**
 * @file dungeonEntrances.ts — Pillar 2, Task 6: surface a world's dungeon SITES
 * as sealed-door ENTRANCES inside a ground window.
 *
 * A {@link DungeonSite} (dungeon/world/dungeonSites.ts) knows WHERE every dungeon
 * opportunity in a world is, in ATLAS FEET (`posFt` = cell center ×
 * FEET_PER_FMG_PIXEL). A ground window (`LocalArtifact.bounds`) is a rectangle in
 * that SAME feet frame (generateRegion is fed `feetPerPixel: FEET_PER_FMG_PIXEL`).
 * So surfacing is a pure clip-and-rebase: keep every site whose mouth lands in
 * the window (with a small margin, matching the hidden-site convention), convert
 * its feet position to window-local meters, and emit a {@link GroundDungeonEntrance}.
 *
 * The seam this closes (recon §Traps 6): dungeon-flavored FMG markers
 * (caves/dungeons/necropolises/disturbed-burials) used to feed
 * `generateGroundHostiles` as SURFACE swarms. Those types are now removed from
 * the hostile set (groundHostiles.ts `DUNGEON_ENTRANCE_MARKER_TYPES`) and surface
 * HERE as doors instead — no double spawn. `enumerateDungeonSites` is the single
 * source, so temple-stair / sewer-grate / civ-origin sites surface the same way.
 *
 * TOWN-SITE PLACEMENT (documented simplification): a temple-stair site anchors to
 * its burg's SEAT CELL center (`posFt` = burg cell center), which is the town
 * center — the temple plot sits there in the canonical town. A sewer-grate anchors
 * to the same burg cell center (a plaza-adjacent spot near the town center). Both
 * are deterministic and readable; a finer per-plot anchor is a later refinement.
 *
 * Determinism: no draws here — positions come straight from the frozen site list;
 * the discovery radius is a fixed constant. Output preserves the site list's
 * stable order. Zero THREE imports.
 */
import type { LocalArtifact } from '../artifacts';
import { enumerateDungeonSites, type DungeonSite } from '../dungeon/world/dungeonSites';
import { generateDungeonForSite } from '../dungeon/world/deriveIdentity';
import type { GroundDungeonEntrance } from './groundChunkLoader';

const FEET_TO_METERS = 0.3048;

/**
 * Proximity radius (meters) within which the player discovers an entrance.
 * Matches the hidden-site discovery radius (250 ft) so a door reads at the same
 * approach distance as any other revealed place.
 */
const ENTRANCE_DISCOVERY_RADIUS_FT = 250;

/**
 * Accept a site a little OUTSIDE the window so an off-screen-but-near mouth still
 * seeds a reachable door (mirrors the hostile/hidden-site margin).
 */
const MARGIN_M = 50;

/** A short, stable id for an entrance, derived from its frozen site path. */
function entranceId(site: DungeonSite): string {
  return `wf-dungeon-${site.sitePath}`;
}

/**
 * Clip a world's dungeon sites to a ground window and rebase them to
 * window-local meters. Pure + deterministic.
 *
 * @param seed   World seed (drives `enumerateDungeonSites`, cached per seed).
 * @param local  The ground window whose feet `bounds` define the clip rectangle.
 */
export function dungeonEntrancesForWindow(
  seed: number,
  local: LocalArtifact,
): GroundDungeonEntrance[] {
  const { bounds } = local;
  const extentXM = bounds.width * FEET_TO_METERS;
  const extentZM = bounds.height * FEET_TO_METERS;
  const out: GroundDungeonEntrance[] = [];
  for (const site of enumerateDungeonSites(seed)) {
    const xM = (site.posFt.x - bounds.x) * FEET_TO_METERS;
    const zM = (site.posFt.y - bounds.y) * FEET_TO_METERS;
    if (xM < -MARGIN_M || xM > extentXM + MARGIN_M) continue;
    if (zM < -MARGIN_M || zM > extentZM + MARGIN_M) continue;
    out.push({
      id: entranceId(site),
      sitePath: site.sitePath,
      cellId: site.cellId,
      entranceKind: site.entranceKind,
      xM,
      zM,
      discoveryRadiusM: ENTRANCE_DISCOVERY_RADIUS_FT * FEET_TO_METERS,
    });
  }
  return out;
}

// Derived-name cache, keyed by `${seed}|${sitePath}`. Generating the full plan
// to read its name costs ~30-50 ms; the plan is deterministic per site, so once
// per session per site is plenty. Discovery reads this at proximity time.
const nameCache = new Map<string, string>();

/**
 * The dungeon's REAL derived name for an entrance (e.g. "The Wrenfield Crypt").
 * The name comes from the Pillar-1 lore pass INSIDE `generateDungeonForSite`, so
 * we generate (once, cached) the site's plan and read `plan.name`. Returns
 * undefined only if the sitePath no longer resolves to a site in this world
 * (never expected — the entrance came FROM the site list).
 *
 * @param seed     World seed.
 * @param sitePath The entrance's frozen `sitePath` (serialized).
 */
export function dungeonNameForEntrance(seed: number, sitePath: string): string | undefined {
  const key = `${seed >>> 0}|${sitePath}`;
  const cached = nameCache.get(key);
  if (cached !== undefined) return cached;
  const site = enumerateDungeonSites(seed).find((s) => s.sitePath === sitePath);
  if (!site) return undefined;
  const name = generateDungeonForSite(seed, site).name;
  nameCache.set(key, name);
  return name;
}
