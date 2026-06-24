/**
 * @file availableTransports.ts — which transports the party can choose for a trip.
 *
 * Feeds the travel-mode transport picker: the player can only pick transports the
 * party actually has. Today that's walking always, plus a riding horse when any
 * member is mounted (`transportMode === 'mounted'`). Designed to extend as richer
 * mount/vehicle ownership (carriages, boats, flying mounts) lands — add cases here.
 *
 * Pure: no React/DOM.
 */
import { STANDARD_VEHICLES, type TransportOption } from '../../types/travel';

/** Minimal party-member shape this selector needs (avoids importing the full character type). */
export interface TransportPartyMember {
  transportMode?: 'foot' | 'mounted';
}

export interface LabeledTransport {
  option: TransportOption;
  /** Short id for selection (e.g. 'walking', 'riding_horse'). */
  id: string;
  /** Display label, e.g. "On foot", "Riding horse". */
  label: string;
  /** Readout phrasing, e.g. "on foot", "by horse". */
  readoutLabel: string;
}

const WALKING: LabeledTransport = {
  option: { method: 'walking' },
  id: 'walking',
  label: 'On foot',
  readoutLabel: 'on foot',
};

/**
 * The transports the party may select, walking first (always available). A riding
 * horse is offered when any member travels mounted. Deduped, stable order.
 */
export function availableTransports(party: TransportPartyMember[] | null | undefined): LabeledTransport[] {
  const out: LabeledTransport[] = [WALKING];
  const anyMounted = (party ?? []).some((m) => m?.transportMode === 'mounted');
  if (anyMounted) {
    out.push({
      option: { method: 'mounted', vehicle: STANDARD_VEHICLES.riding_horse },
      id: 'riding_horse',
      label: 'Riding horse',
      readoutLabel: 'by horse',
    });
  }
  return out;
}
