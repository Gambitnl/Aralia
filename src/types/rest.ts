/** Paid stays refer to existing guest beds. They never create rooms, move the
 * party, transfer household goods, or stand in for permission in another home. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 13:10:44
 * Dependents: components/MapPane.tsx, components/Worldforge/TownBuildingInspector.tsx, components/ui/LodgingModal.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleLodging.ts, hooks/actions/handleResourceActions.ts, state/actionTypes.ts, systems/gameplay/lodging.ts, types/actions.ts, types/state.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PlayerGroundPosition } from './state';

export interface GuestBedReference {
  level: number;
  index: number;
  roomId: number;
}

export interface LodgingOffer {
  businessId: string;
  businessName: string;
  keeperId: string;
  keeperName: string;
  worldSeed: number;
  cellId: number;
  locationId: string;
  burgId: number;
  plotId: number;
  partyIds: string[];
  beds: GuestBedReference[];
  /** Display text follows the blueprint legend; identity stays in beds. */
  roomLabels?: string[];
  costGp: number;
  quotedAt: string;
}

export interface LodgingReservation extends LodgingOffer {
  id: string;
  paidAt: string;
  expiresAt: string;
  usedAt?: string;
}

/** Issued only by a reached physical bed, then checked again at confirmation. */
export interface LodgingRestAdmission {
  reservationId: string;
  bed: GuestBedReference;
  position: PlayerGroundPosition;
}
