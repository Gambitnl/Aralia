/** Fit people who actually shared a committed route at its new locale entry.
 * Existing finite feet never enter this path. A failed fit leaves arrival
 * unresolved instead of moving the leader or placing someone in a structure. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 09:38:09
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { recipeFromCharacter, recipeFromRichNpc } from '@/systems/entities3d/recipeFromCharacter';
import { arrivingCompanions } from '@/systems/companions/companionJourney';
import { measureEntryActors, publicEntryBodyFits, type EntryOccupant } from './initialTownEntry';
import { groundSurfaceYM } from './terrain/groundSurfaceYM';

export function qualifyPartyJourneyArrival(ground: GroundWorld, state: GameState, leader: { x: number; z: number }, occupied: readonly EntryOccupant[] = []) {
  const people = arrivingCompanions(state), placements: Array<{ companionId: string; journeyId: string; position: { xM: number; yM: number; zM: number } }> = [];
  const taken = [...occupied, { id: state.party[0]?.id ?? 'player', xM: leader.x, zM: leader.z, radius: 1 }];
  for (const c of people) {
    const character = state.party.find(person => person.id === c.id)!;
    const npc = state.generatedNpcs[c.id];
    const [measured] = measureEntryActors([{ id: c.id, offset: { x: 0, z: 0 },
      recipe: npc ? recipeFromRichNpc(npc, c.identity.race) : recipeFromCharacter(character) }]);
    let accepted: { xM: number; yM: number; zM: number } | undefined;
    // A small arrival formation is chosen before these people have feet here.
    // Exact support, visible parts, dry ground, slopes and occupied bodies all
    // qualify the point. This is not a path or an old-save height correction.
    for (const radius of [2.25, 3, 4.5, 6, 8]) {
      for (let heading = 0; heading < 16 && !accepted; heading++) {
        const angle = heading * Math.PI / 8, x = leader.x + Math.cos(angle) * radius, z = leader.z + Math.sin(angle) * radius;
        if (taken.some(other => Math.hypot(x - other.xM, z - other.zM) < measured.body.halfWidthM + .15 + other.radius)) continue;
        if (!publicEntryBodyFits(ground, { x, z }, measured.body, !!ground.towns?.length)) continue;
        accepted = { xM: x, zM: z, yM: groundSurfaceYM(ground, x, z) };
      }
      if (accepted) break;
    }
    if (!accepted) return { arrivals: [], error: `No clear arrival fits ${c.identity.name}. The shared journey's placement remains unresolved.` };
    placements.push({ companionId: c.id, journeyId: c.journey!.id, position: accepted });
    taken.push({ id: c.id, ...accepted, radius: measured.body.halfWidthM + .15 });
  }
  return { arrivals: placements, error: undefined };
}
