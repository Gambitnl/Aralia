/** Connects an actual inn's guest beds and keeper to a quoted, paid reservation.
 * Requesting a room never moves the party, starts a rest or assigns an NPC a job. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 12:04:05
 * Dependents: hooks/actions/actionHandlers.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type React from 'react';
import { GamePhase } from '../../types';
import type { GameState } from '../../types/state';
import type { LodgingOffer } from '../../types/rest';
import type { AppAction } from '../../state/actionTypes';
import type { AddMessageFn } from './actionHandlerTypes';
import { guestBedsForVisit, guestBedDescription, lodgingKeeperOnDuty, lodgingOfferError, activeLodgingReservation, LODGING_COST_PER_MEMBER_GP } from '../../systems/gameplay/lodging';

type Props = { gameState: GameState; dispatch: React.Dispatch<AppAction>; addMessage: AddMessageFn };

async function sourceOffer(state: GameState, businessId: string): Promise<LodgingOffer> {
  const business = state.worldBusinesses?.[businessId];
  if (state.phase !== GamePhase.PLAYING || !business || state.worldSeed == null
    || business.burgId == null || business.plotId == null || state.playerCell?.cellId == null
    || business.locationId !== state.currentLocationId) throw new Error('Visit the inn’s settlement before requesting a room.');
  if (!state.party.length || !state.party.some(member => member.hp > 0) || state.party.some(member => !member.id)) throw new Error('The party cannot arrange a stay.');
  const keeper = state.generatedNpcs?.[business.ownerId];
  if (!keeper) throw new Error('There is no registered keeper to arrange this stay.');
  const { townBuildingVisit } = await import('../../components/Worldforge/townBuildingVisit');
  const visit = townBuildingVisit(state.worldSeed, business.burgId, business.plotId,
    state.townSim?.[business.burgId]?.buildingEvents?.[business.plotId],
      state.townSim?.[business.burgId]?.buildingSources?.[business.plotId], state.townSim?.[business.burgId]?.layoutRevision);
  const beds = guestBedsForVisit(visit);
  if (!beds.length) throw new Error('This building has no guest beds available for lodging.');
  if (!lodgingKeeperOnDuty(visit, new Date(state.gameTime).getUTCHours())) throw new Error('No innkeeper is on duty to arrange a stay. Private or occupied beds are not available.');
  if (beds.length < state.party.length) throw new Error(`Only ${beds.length} guest beds are available for ${state.party.length} travelers.`);
  const reserved = activeLodgingReservation(state, businessId);
  if (reserved) throw new Error(`Your paid guest bed is already reserved here: ${reserved.beds.map(bed => guestBedDescription(visit, bed)).join('; ')}. It expires at ${reserved.expiresAt}. Reach that bed before resting; you will not be charged again.`);
  return {
    businessId, businessName: business.name, keeperId: business.ownerId, keeperName: keeper.name,
    worldSeed: state.worldSeed, cellId: state.playerCell.cellId, locationId: state.currentLocationId,
    burgId: business.burgId, plotId: business.plotId,
    partyIds: state.party.map(member => member.id!), beds: beds.slice(0, state.party.length),
    roomLabels: beds.slice(0, state.party.length).map(bed => guestBedDescription(visit, bed)),
    costGp: state.party.length * LODGING_COST_PER_MEMBER_GP,
    quotedAt: new Date(state.gameTime).toISOString(),
  };
}

export async function handleRequestLodging({ gameState, dispatch, addMessage }: Props, businessId: string): Promise<void> {
  dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: 'Asking about guest rooms…' } });
  try {
    const offer = await sourceOffer(gameState, businessId);
    dispatch({ type: 'SHOW_LODGING_OFFER', payload: { offer, error: lodgingOfferError(gameState, offer) ?? undefined } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'No lodging offer is available.';
    addMessage(message, 'system');
    dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'warning', message } });
  } finally { dispatch({ type: 'SET_LOADING', payload: { isLoading: false } }); }
}

export async function handleBookLodging({ gameState, dispatch, addMessage }: Props, offer: LodgingOffer): Promise<void> {
  try {
    const error = lodgingOfferError(gameState, offer);
    if (error) throw new Error(error);
    const fresh = await sourceOffer(gameState, offer.businessId);
    if (fresh.keeperId !== offer.keeperId || JSON.stringify(fresh.beds) !== JSON.stringify(offer.beds)) throw new Error('The available guest beds have changed. Ask for a new offer.');
    // The world reducer commits coin and permission together. A duplicate quote
    // cannot spend again or create another lease; recovery is a separate action.
    dispatch({ type: 'RESERVE_LODGING', payload: offer });
    addMessage(`You reserve ${offer.beds.length} guest bed(s) at ${offer.businessName} for ${offer.costGp} GP. Reach a reserved bed to begin your rest. Food and water are separate.`, 'system');
  } catch (cause) {
    dispatch({ type: 'SHOW_LODGING_OFFER', payload: { offer, error: cause instanceof Error ? cause.message : 'The stay could not be reserved.' } });
  } finally { dispatch({type: 'SET_LOADING', payload: {isLoading: false}}); }
}
