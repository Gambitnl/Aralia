/** Only currently mounted bodies participate. This scene-local map is not a
 * population store and must never enter a save, worker packet or NPC memory. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 10:34:23
 * Dependents: components/World3D/InteriorOccupants.tsx, components/World3D/PlayerAvatar.tsx, components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {createContext} from 'react';
import type {ActorSpace} from './actorPersonalSpace';
export const ActorPersonalSpaceContext=createContext<ActorSpace|null>(null);
