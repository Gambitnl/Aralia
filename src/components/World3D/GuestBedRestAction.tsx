/** Show a bed-use action only for the guest bed the party actually reserved.
 * The world furnishing card calls this beside its ownership explanation. Other
 * beds give directions to the paid sleeping place; they grant no rest or goods.
 * The existing click handler still rechecks reached feet and current permission.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 13:31:48
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import type {GameState} from '../../types/state';
import type {TownBuildingVisit} from '../Worldforge/townBuildingVisit';
import {activeLodgingReservation, guestBedDescription, guestBedsForVisit} from '../../systems/gameplay/lodging';
import {Button} from '../ui/Button';

export function GuestBedRestAction({state, visit, businessId, level, index, onUse}: {
  state: GameState; visit: TownBuildingVisit; businessId: string;
  level: number; index: number; onUse: () => void;
}) {
  // A family-assigned bedroom stays private even if an old reservation happens
  // to contain the same array index. Reuse the inn's existing bed catalogue.
  const bed = guestBedsForVisit(visit).find(bed => bed.level === level && bed.index === index);
  if (!bed) return null;
  const stay = activeLodgingReservation(state, businessId);
  if (!stay) return <p>Ask the innkeeper to reserve a guest bed before sleeping here.</p>;
  const included = stay.beds.some(reserved => reserved.level === bed.level
    && reserved.index === bed.index && reserved.roomId === bed.roomId);
  if (!included) {
    const rooms = [...new Set(stay.beds.map(reserved => guestBedDescription(visit, reserved)))];
    return <p>This bed is not included in your reservation. Your reserved sleeping place: {rooms.join('; ')}.</p>;
  }
  // This offers the normal review, not recovery. Live reach, party, expiry and
  // rest eligibility still belong to the existing action and confirmation.
  return <Button onClick={onUse}>Use reserved guest bed</Button>;
}
