// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/08/2026, 15:06:40
 * Dependents: components/World3D/GroundAgents.tsx, components/World3D/OccupantFigure.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file recipeFromOccupant.ts — interior villager render packet → entity recipe.
 *
 * Household members carry an ancestry GROUP (a raceGroups display name like
 * "Elf" or "Greenskins"), not a concrete race id. Each group maps to a few
 * townsfolk-plausible concrete races; the pick is deterministic per member id
 * so a villager's body never changes between visits. Villagers are commoners:
 * no gear. A packet with no race (older bakes) renders the human commoner;
 * an unrecognized group throws.
 *
 * Also contains crowdArchetypeForGroup to bake and cache crowd rendering models
 * per ancestry group. This keeps the core Three.js baking engine decoupled from
 * gameplay occupant adapters.
 *
 * Called by: OccupantFigure.tsx, GroundAgents.tsx
 * Depends on: SeededRandom, generateEntityBlueprint, bakeCrowdArchetype
 */

import { SeededRandom } from '../../utils/random/seededRandom';
import type { AgeBand, EntityRecipe } from './types';
import { generateEntityBlueprint } from './generateEntityBlueprint';
import { bakeCrowdArchetype, createCrowdClipBaker, type CrowdClipBaker } from './three/crowdBake';
import type { AnimationClip, BufferGeometry } from 'three';
import type { CrowdArchetype } from './three/crowdBake';

// ============================================================================
// Types & Ancestry Configurations
// ============================================================================
// This section lists the structural types and configuration maps that associate
// abstract ancestry group names with concrete in-game race IDs.
// ============================================================================

/** Ancestry group (raceGroups display name) → townsfolk-plausible race ids. */
const GROUP_CANDIDATES: Record<string, string[]> = {
  Human: ['human'],
  Elf: ['high_elf', 'wood_elf'],
  Eladrin: ['autumn_eladrin', 'summer_eladrin'],
  Dwarf: ['hill_dwarf', 'mountain_dwarf'],
  Halfling: ['halfling', 'lightfoot_halfling', 'stout_halfling'],
  Gnome: ['rock_gnome', 'forest_gnome'],
  'Half-Elf': ['half_elf'],
  Greenskins: ['half_orc', 'orc', 'hobgoblin', 'goblin'],
  Goliath: ['goliath'],
  Tiefling: ['tiefling'],
  Aasimar: ['protector_aasimar'],
  'Draconic Kin': ['bronze_dragonborn', 'copper_dragonborn', 'brass_dragonborn'],
  Beastfolk: ['tabaxi', 'harengon', 'tortle'],
  Genasi: ['earth_genasi', 'water_genasi'],
  Gith: ['githzerai'],
  Shapeshifters: ['changeling', 'beasthide_shifter'],
  Feyfolk: ['firbolg', 'satyr'],
  Constructed: ['warforged'],
  'Planar Travelers': ['triton', 'kalashtar'],
};

export interface OccupantIdentity {
  /** Stable per-member id (plotId * 100 + memberIndex). */
  id: number;
  ageBand: string;
  /** Ancestry group name; absent on packets from older bakes. */
  race?: string;
}

// ============================================================================
// Occupant-to-Recipe Mapping
// ============================================================================
// Resolves abstract villager attributes into direct 3D recipes with stable
// deterministic seeds.
// ============================================================================

/** Build the recipe for one interior villager. */
export function recipeFromOccupant(occ: OccupantIdentity): EntityRecipe {
  // Fall back to a default human race if the packet contains no race info.
  let raceId = 'human';
  if (occ.race) {
    const candidates = GROUP_CANDIDATES[occ.race];
    if (!candidates) {
      throw new Error(`entities3d: unknown ancestry group "${occ.race}" (occupant ${occ.id})`);
    }
    // Determinstically choose a race candidate based on the occupant ID.
    raceId = candidates[new SeededRandom(occ.id * 977 + 13).nextInt(0, candidates.length)];
  }
  // Standardize the age band to either child, elder, or adult.
  const ageBand: AgeBand =
    occ.ageBand === 'child' || occ.ageBand === 'elder' ? occ.ageBand : 'adult';
  return {
    kind: 'humanoid',
    raceId,
    classId: 'fighter', // accent tint only — commoners carry no gear
    seed: `occupant:${occ.id}`,
    gearOverride: [],
    ageBand,
  };
}

// ============================================================================
// Crowd Archetype Baking & Caching
// ============================================================================
// This section handles baking 3D crowd models for each ancestry group (e.g. Elf,
// Dwarf) and caching them in memory for the duration of the play session.
// Decoupled from crowdBake.ts to keep the engine boundary clean.
// ============================================================================

// Stable tiny hash to turn an ancestry group name into a stable representative ID seed.
// Ensures that the representative body for Dwarf/Elf is always same and stable.
function hashGroup(group: string): number {
  let h = 0;
  for (let i = 0; i < group.length; i++) h = ((h << 5) - h + group.charCodeAt(i)) | 0;
  return Math.abs(h) % 100000;
}

// In-memory cache for baked crowd archetypes to avoid expensive rebakes.
const archetypeCache = new Map<string, CrowdArchetype>();

/**
 * Looks up or generates a baked crowd archetype for a given ancestry group name.
 * 
 * It hashes the group name to build a deterministic representative occupant identity,
 * compiles that identity into an entity recipe and blueprint, and then bakes the
 * blueprint's keyframe geometries.
 */
/**
 * The cached archetype for a group, or null when it is not baked yet. It never
 * bakes. GG-574: GroundAgents bakes one group per task and draws only the
 * groups this returns, so the first crowd does not freeze the page.
 */
export function peekCrowdArchetype(group: string): CrowdArchetype | null {
  return archetypeCache.get(group) ?? null;
}

export function crowdArchetypeForGroup(group: string): CrowdArchetype {
  const cached = archetypeCache.get(group);
  if (cached) return cached;

  // Adapt the group name to a standard adult occupant recipe.
  const recipe = recipeFromOccupant({ id: hashGroup(group), ageBand: 'adult', race: group });

  // Compile the recipe into a concrete blueprint with part meshes and layouts.
  const blueprint = generateEntityBlueprint(recipe);

  // Bake the blueprint into idle and walking phase geometries.
  const arch = bakeCrowdArchetype(blueprint);

  // Cache the resulting geometries for future lookups.
  archetypeCache.set(group, arch);
  return arch;
}

// ============================================================================
// Crowd Activity Frames (NPC life, 2026-11-02)
// ============================================================================
// Outdoor people at an errand place talk and listen. Their frames come from
// the entity generator's clip system (bakeCrowdClipFrames), baked for the same
// representative body as the group's idle and walk frames.
// ============================================================================

/** One crowd activity: the clip, how many frames, and the clip's loop time. */
export interface CrowdActivity {
  name: 'talk' | 'listen';
  clip: string;
  frames: number;
  /** Seconds for one pass through the frames (the clip's own length). */
  periodS: number;
}

/** Talkers gesture through Idle_Talking; listeners stand with folded arms. */
export const CROWD_ACTIVITIES: readonly CrowdActivity[] = [
  { name: 'talk', clip: 'Idle_Talking', frames: 6, periodS: 3.67 },
  { name: 'listen', clip: 'Idle_FoldArms', frames: 3, periodS: 2.5 },
];

const activityCache = new Map<string, Map<string, BufferGeometry[]>>();

/** The baked activity frames of a group (keyed by activity name), or null. */
export function peekCrowdActivityFrames(group: string): Map<string, BufferGeometry[]> | null {
  return activityCache.get(group) ?? null;
}

const activityBakers = new Map<string, CrowdClipBaker>();

/**
 * Advance a group's activity bake by one unit of work: the first call poses
 * the group's body, each later call bakes one frame. Returns true once the
 * group's frames are cached (peekCrowdActivityFrames then has them). The
 * crowd calls this once per macrotask, so no task holds a whole group.
 */
export function stepCrowdActivityBake(group: string, clips: Map<string, AnimationClip>): boolean {
  if (activityCache.has(group)) return true;
  const baker = activityBakers.get(group);
  if (!baker) {
    const recipe = recipeFromOccupant({ id: hashGroup(group), ageBand: 'adult', race: group });
    const blueprint = generateEntityBlueprint(recipe);
    activityBakers.set(group, createCrowdClipBaker(blueprint, clips, CROWD_ACTIVITIES.map((a) => ({ clip: a.clip, frames: a.frames }))));
    return false;
  }
  if (!baker.step()) return false;
  const byClip = baker.result();
  baker.dispose();
  activityBakers.delete(group);
  activityCache.set(group, new Map(CROWD_ACTIVITIES.map((a) => [a.name, byClip.get(a.clip)!] as const)));
  return true;
}

/** Bake (once, in one go) and return a group's activity frames. */
export function crowdActivityFramesForGroup(group: string, clips: Map<string, AnimationClip>): Map<string, BufferGeometry[]> {
  while (!stepCrowdActivityBake(group, clips)) { /* one frame per step */ }
  return activityCache.get(group)!;
}
