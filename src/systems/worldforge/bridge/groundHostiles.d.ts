/**
 * @file groundHostiles.ts — deterministic hostile spawn derivation for
 * Worldforge ground mode from region markers/zones.
 *
 * Sourced from the FMG marker layer: brigands, pirates, monster lairs,
 * caves, dungeons, undead sites, and planar rifts. Each hostile marker
 * inside the local window produces a small group of creatures positioned
 * in artifact meters around the marker site.
 *
 * CONTRACT:
 * - Pure, deterministic (same region + local + seed → same output).
 * - Empty result when the window has no hostile markers (peaceful tiles
 *   spawn nothing — no fallback/filler monsters).
 * - Output shape matches `GroundHostile` from groundChunkLoader.ts.
 *
 * MAPPING TABLE:
 * | Marker type        | Creatures                               | CR range  | Count |
 * |--------------------+-----------------------------------------+-----------+-------|
 * | brigands           | Bandit, Bandit Captain, Highwayman       | 1/8 – 3   | 2–5   |
 * | pirates            | Pirate, Pirate Captain                   | 1/4 – 3   | 2–4   |
 * | hill-monsters      | Ogre, Troll, Cyclops                     | 2 – 5     | 1–2   |
 * | cave               | Goblin, Giant Spider, Cave Bear          | 1/4 – 2   | 2–4   |
 * | dungeon            | Skeleton, Zombie, Ghoul                  | 1/4 – 1   | 3–6   |
 * | lake-monsters      | Hydra, Water Elemental, Giant Crocodile  | 3 – 8     | 1     |
 * | sea-monsters       | Kraken, Giant Octopus, Sea Serpent       | 5 – 12    | 1     |
 * | necropolises       | Wraith, Specter, Vampire                 | 3 – 5     | 1–2   |
 * | disturbed-burials  | Skeleton, Zombie, Ghoul                  | 1/4 – 1   | 2–4   |
 * | rifts              | Imp, Shadow Demon, Elemental             | 1 – 4     | 2–3   |
 * | encounters         | (wandering) — Bandit, Wolf, OwlBear      | 1/4 – 3   | 1–2   |
 *
 * ZONES (apply broadly to the region; deterministic count inside bounds):
 * - Invasion -> Invader (Bandit, count: 1-2)
 * - Rebels   -> Rebel (Bandit, count: 1-2)
 */
import type { RegionMarker, RegionZone } from '../artifacts';
import type { GroundHostile } from './groundChunkLoader';
/**
 * Marker types the WORLD-GROWN DUNGEON layer (Pillar 2) claims as sealed-door
 * ENTRANCES rather than surface hostiles. These four feed
 * `enumerateDungeonSites` → `GroundWorld.dungeonEntrances` and surface as
 * discoverable doors in 3D; the monsters live INSIDE the dungeon, not scattered
 * on the surface. Removing them here is THE seam fix that prevents a double
 * spawn (a dungeon marker becoming both an entrance AND a surface swarm). They
 * mirror `MARKER_ENTRANCE` in dungeon/world/dungeonSites.ts — keep the two in
 * sync. Other hostile marker types (brigands/pirates/hill-monsters/…) are
 * unchanged and still spawn surface encounters.
 */
export declare const DUNGEON_ENTRANCE_MARKER_TYPES: ReadonlySet<string>;
/**
 * Derive the set of hostile creature spawns for a ground-mode local window.
 *
 * Reads region markers (FMG marker layer) and filters for hostile types.
 * Each hostile marker inside the local window produces a deterministic group
 * of creatures positioned around the marker site in ground meters.
 *
 * Zones like Invasion/Rebels add broad-area spawns when present.
 *
 * Returns an empty array when the region has no hostile markers/zones in
 * the window. **No fallback hostiles** — peaceful windows spawn nothing.
 *
 * @param markers  Region markers from the FMG atlas layer (may be undefined).
 * @param zones    Region zones from the FMG atlas layer (may be undefined).
 * @param seed     World seed for deterministic scatter + template selection.
 * @param localBoundsX  Local artifact bounds origin X (feet).
 * @param localBoundsY  Local artifact bounds origin Y (feet).
 * @param localBoundsWidth  Local artifact bounds width (feet).
 * @param localBoundsHeight Local artifact bounds height (feet).
 */
export declare function generateGroundHostiles(markers: RegionMarker[] | undefined, zones: RegionZone[] | undefined, seed: number, localBoundsX: number, localBoundsY: number, localBoundsWidth: number, localBoundsHeight: number): GroundHostile[];
/**
 * Check whether a region zone overlaps the local window with hostile context.
 * Zones like "Invasion" or "Rebels" tint the area as dangerous but do not
 * directly produce spawns (markers are the authoritative spawn source).
 * This is a utility for future zone-aware encounter difficulty scaling.
 */
export declare function hasHostileZoneContext(zones: RegionZone[] | undefined): boolean;
