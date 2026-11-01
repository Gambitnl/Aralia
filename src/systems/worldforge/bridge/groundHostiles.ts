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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 19:30:23
 * Dependents: systems/combat/worldScenario/surfaceHostileEncounter.ts, systems/combat/worldScenario/surfaceHostileTemplate.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RegionMarker, RegionZone } from '../artifacts';
import type { GroundHostile } from './groundChunkLoader';
import { SeededRandom } from '../../../utils/random/seededRandom';

const FEET_TO_METERS = 0.3048;

// ============================================================================
// Marker → Creature Mapping Table
// ============================================================================

interface CreatureTemplate {
  name: string;
  monsterId: string;
  cr: string;
  minCount: number;
  maxCount: number;
}

const HOSTILE_MARKER_MAP: Record<string, CreatureTemplate[]> = {
  brigands: [
    { name: 'Bandit', monsterId: 'Bandit', cr: '1/8', minCount: 2, maxCount: 4 },
    { name: 'Bandit Captain', monsterId: 'Bandit Captain', cr: '2', minCount: 1, maxCount: 2 },
    // The owner keeps the CR3 threat (agora-6c83). Use the existing martial
    // profile while preserving the world name, source group and placement.
    { name: 'Highwayman', monsterId: 'Warrior Veteran', cr: '3', minCount: 1, maxCount: 2 },
  ],
  pirates: [
    { name: 'Pirate', monsterId: 'Bandit', cr: '1/4', minCount: 2, maxCount: 4 },
    { name: 'Pirate Captain', monsterId: 'Bandit Captain', cr: '3', minCount: 1, maxCount: 1 },
  ],
  'hill-monsters': [
    { name: 'Ogre', monsterId: 'Ogre', cr: '2', minCount: 1, maxCount: 2 },
    { name: 'Troll', monsterId: 'Troll', cr: '5', minCount: 1, maxCount: 1 },
    { name: 'Cyclops', monsterId: 'Cyclops', cr: '6', minCount: 1, maxCount: 1 },
  ],
  caves: [
    { name: 'Goblin', monsterId: 'Goblin', cr: '1/4', minCount: 2, maxCount: 4 },
    { name: 'Giant Spider', monsterId: 'Giant Spider', cr: '1', minCount: 1, maxCount: 2 },
    { name: 'Cave Bear', monsterId: 'Cave Bear', cr: '2', minCount: 1, maxCount: 1 },
  ],
  dungeons: [
    { name: 'Skeleton', monsterId: 'Skeleton', cr: '1/4', minCount: 2, maxCount: 4 },
    { name: 'Zombie', monsterId: 'Zombie', cr: '1/4', minCount: 2, maxCount: 3 },
    { name: 'Ghoul', monsterId: 'Ghoul', cr: '1', minCount: 1, maxCount: 2 },
  ],
  'lake-monsters': [
    { name: 'Hydra', monsterId: 'Hydra', cr: '8', minCount: 1, maxCount: 1 },
    { name: 'Water Elemental', monsterId: 'Water Elemental', cr: '5', minCount: 1, maxCount: 1 },
    { name: 'Giant Crocodile', monsterId: 'Giant Crocodile', cr: '3', minCount: 1, maxCount: 1 },
  ],
  'sea-monsters': [
    { name: 'Kraken', monsterId: 'Kraken', cr: '12', minCount: 1, maxCount: 1 },
    { name: 'Giant Octopus', monsterId: 'Giant Octopus', cr: '5', minCount: 1, maxCount: 1 },
    { name: 'Sea Serpent', monsterId: 'Hydra', cr: '8', minCount: 1, maxCount: 1 },
  ],
  necropolises: [
    { name: 'Wraith', monsterId: 'Wraith', cr: '5', minCount: 1, maxCount: 1 },
    { name: 'Specter', monsterId: 'Specter', cr: '3', minCount: 1, maxCount: 2 },
    { name: 'Vampire', monsterId: 'Vampire', cr: '5', minCount: 1, maxCount: 1 },
  ],
  'disturbed-burials': [
    { name: 'Skeleton', monsterId: 'Skeleton', cr: '1/4', minCount: 2, maxCount: 3 },
    { name: 'Zombie', monsterId: 'Zombie', cr: '1/4', minCount: 2, maxCount: 4 },
    { name: 'Ghoul', monsterId: 'Ghoul', cr: '1', minCount: 1, maxCount: 2 },
  ],
  rifts: [
    { name: 'Imp', monsterId: 'Imp', cr: '1', minCount: 2, maxCount: 3 },
    { name: 'Shadow Demon', monsterId: 'Shadow Demon', cr: '4', minCount: 1, maxCount: 2 },
    { name: 'Elemental', monsterId: 'Water Elemental', cr: '5', minCount: 1, maxCount: 1 },
  ],
  encounters: [
    { name: 'Bandit', monsterId: 'Bandit', cr: '1/8', minCount: 1, maxCount: 2 },
    { name: 'Wolf', monsterId: 'Wolf', cr: '1/4', minCount: 1, maxCount: 2 },
    { name: 'Owlbear', monsterId: 'Owlbear', cr: '3', minCount: 1, maxCount: 1 },
  ],
};

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
export const DUNGEON_ENTRANCE_MARKER_TYPES: ReadonlySet<string> = new Set([
  'caves',
  'dungeons',
  'necropolises',
  'disturbed-burials',
]);

/**
 * Marker types considered hostile for ground-mode SURFACE spawn derivation —
 * every hostile-mapped type EXCEPT the dungeon-entrance types, which Pillar 2
 * surfaces as sealed doors instead.
 */
const HOSTILE_MARKER_TYPES = new Set(
  Object.keys(HOSTILE_MARKER_MAP).filter((t) => !DUNGEON_ENTRANCE_MARKER_TYPES.has(t)),
);

/**
 * Maximum scatter radius (meters) from the marker center for individual
 * creature placement. Scales loosely with creature count — lone bosses
 * stay tight to the marker, groups spread out a bit.
 */
const SCATTER_RADIUS_M = 8;

// ============================================================================
// Main derivation function
// ============================================================================

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
export function generateGroundHostiles(
  markers: RegionMarker[] | undefined,
  zones: RegionZone[] | undefined,
  seed: number,
  localBoundsX: number,
  localBoundsY: number,
  localBoundsWidth: number,
  localBoundsHeight: number,
): GroundHostile[] {
  const result: GroundHostile[] = [];
  // Seeded RNG for this specific derivation pass. Adding a fixed salt
  // ensures ground hostiles are deterministic but do not share a PRNG
  // stream with other generators.
  const rng = new SeededRandom(seed + 7919);

  const extentXM = localBoundsWidth * FEET_TO_METERS;
  const extentZM = localBoundsHeight * FEET_TO_METERS;
  let hostileCount = 0;
  const markerOccurrences = new Map<string, number>();
  const zoneOccurrences = new Map<string, number>();

  // ── Marker-based spawns ──────────────────────────────────────────────
  if (markers) {
    for (const marker of markers) {
      if (!HOSTILE_MARKER_TYPES.has(marker.type)) continue;

      const markerXM = (marker.x - localBoundsX) * FEET_TO_METERS;
      const markerZM = (marker.y - localBoundsY) * FEET_TO_METERS;

      // Skip markers outside the local window (with scatter margin).
      if (markerXM < -SCATTER_RADIUS_M || markerXM > extentXM + SCATTER_RADIUS_M) continue;
      if (markerZM < -SCATTER_RADIUS_M || markerZM > extentZM + SCATTER_RADIUS_M) continue;

      const templates = HOSTILE_MARKER_MAP[marker.type];
      if (!templates?.length) continue;

      // Pick a creature template deterministically for this marker.
      const templateIndex = Math.floor(rng.next() * templates.length);
      const template = templates[templateIndex];

      // Determine group count for this spawn site.
      const count = template.minCount + Math.floor(
        rng.next() * (template.maxCount - template.minCount + 1),
      );

      // Cohort metadata consumes no RNG and preserves every existing entity ID.
      const groupStart = hostileCount;
      const sourceKey = JSON.stringify([marker.type, marker.x, marker.y]);
      const occurrence = markerOccurrences.get(sourceKey) ?? 0;
      markerOccurrences.set(sourceKey, occurrence + 1);
      const sourceGroup = {kind: 'marker' as const,
        key: JSON.stringify(['marker', marker.type, marker.x, marker.y, occurrence]),
        memberIds: Array.from({length: count}, (_, i) => `wf-hostile-marker-${marker.type}-${groupStart + i}-${i}`)};

      // Generate individual creature positions scattered around the marker.
      for (let i = 0; i < count; i++) {
        const angle = rng.next() * Math.PI * 2;
        const radius = rng.next() * SCATTER_RADIUS_M;
        const creatureX = markerXM + Math.cos(angle) * radius;
        const creatureZ = markerZM + Math.sin(angle) * radius;

        // Clamp to the artifact bounds (no creatures outside the local window).
        const clampedX = Math.max(0, Math.min(extentXM, creatureX));
        const clampedZ = Math.max(0, Math.min(extentZM, creatureZ));

        result.push({
          id: `wf-hostile-marker-${marker.type}-${hostileCount++}-${i}`,
          sourceGroup,
          name: template.name,
          xM: clampedX,
          zM: clampedZ,
          monsterId: template.monsterId,
        });
      }
    }
  }

  // ── Zone-based spawns ────────────────────────────────────────────────
  // Zones like Invasion or Rebels add a small deterministic count of
  // creatures scattered across the local window.
  if (zones) {
    for (const zone of zones) {
      if (zone.type !== 'Invasion' && zone.type !== 'Rebels') continue;

      const sourceKey = JSON.stringify([zone.type, zone.name]);
      const occurrence = zoneOccurrences.get(sourceKey) ?? 0;
      zoneOccurrences.set(sourceKey, occurrence + 1);
      const numToSpawn = 1 + Math.floor(rng.next() * 2);
      for (let i = 0; i < numToSpawn; i++) {
        const id = `wf-hostile-zone-${zone.type}-${hostileCount++}`;
        result.push({
          id,
          // These bodies are independently scattered, not one distant pack.
          sourceGroup: {kind: 'zone', key: JSON.stringify(['zone', zone.type, zone.name, occurrence, i]), memberIds: [id]},
          name: zone.type === 'Invasion' ? 'Invader' : 'Rebel',
          monsterId: 'Bandit',
          xM: rng.next() * extentXM,
          zM: rng.next() * extentZM,
        });
      }
    }
  }

  return result;
}

/**
 * Check whether a region zone overlaps the local window with hostile context.
 * Zones like "Invasion" or "Rebels" tint the area as dangerous but do not
 * directly produce spawns (markers are the authoritative spawn source).
 * This is a utility for future zone-aware encounter difficulty scaling.
 */
export function hasHostileZoneContext(
  zones: RegionZone[] | undefined,
): boolean {
  if (!zones?.length) return false;
  const hostileZoneTypes = new Set(['Invasion', 'Rebels', 'Crusade']);
  return zones.some(z => hostileZoneTypes.has(z.type));
}

/** Read the original marker declaration without changing any generated placement.
 * This metadata is a consistency check, not a stat-scaling instruction. */
export function declaredGroundHostileChallengeRating(
  hostile: Pick<GroundHostile, 'name' | 'monsterId'>,
): string | undefined {
  // Exact profile references retain their declaration. An older ground packet
  // must not erase a unique named threat merely by retaining its old template.
  const named = Object.values(HOSTILE_MARKER_MAP).flat().filter(template => template.name === hostile.name);
  const matching = named.filter(template => template.monsterId === hostile.monsterId);
  const ratings = new Set((matching.length ? matching : named).map(template => template.cr));
  if (ratings.size > 1) throw new Error('The source creature has conflicting challenge declarations.');
  return ratings.values().next().value;
}
