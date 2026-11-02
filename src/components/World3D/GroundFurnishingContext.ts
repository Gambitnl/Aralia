/** Gives live building meshes one physical examination route through the game. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 02/11/2026, 23:06:19
 * Dependents: components/World3D/BuildingDoor.tsx, components/World3D/InteriorOccupants.tsx, components/World3D/NearbyBuildingDoor.tsx, components/World3D/NearbyFurnishing.tsx, components/World3D/World3DScene.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { createContext } from 'react';
import type { SceneOrigin } from '../../systems/world3d/sceneOrigin';
import type { FurnishingPick } from './groundFurnishingInteraction';
import type { ReadResidentPick } from './groundResidentInteraction';
import type { GroundDoorStore } from './groundDoorStore';

export const GroundFurnishingContext = createContext<{
  origin: SceneOrigin;
  onSelect?: (pick: FurnishingPick) => void;
  /** Transient focus from the already-reached list; it grants no interaction. */
  focusedFurnishingId?: string | null;
  /** Door picks reuse the same physical part receipt and actual-body gate. */
  onDoor?: (pick: FurnishingPick) => void;
  /** A named resident's current body and canonical household identity. */
  onResident?: (read: ReadResidentPick) => void;
  /** Live open doors and resident door users (GG-580). A store, not a value:
   * a door change must not make a new context value, because every building
   * reads this context. Leaves subscribe to their own key. */
  doors?: GroundDoorStore;
} | null>(null);
