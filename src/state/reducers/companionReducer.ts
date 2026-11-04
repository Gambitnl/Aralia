/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/companionReducer.ts
 * Handles companion-related state updates.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 17:38:23
 * Dependents: state/appState.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { payPartyFunds } from '../../systems/economy/partyFunds';
import { RelationshipManager } from '../../systems/companions/RelationshipManager';
import { inGameTimestamp } from '../../utils/core/timeUtils';
import { isOverSoftCap } from '../../systems/party/partyConstants';
import { appendAdventureLogEntry } from '../../systems/adventureLog/adventureLog';
import { applyCompanionPreparationChoice } from './companionPreparationReducer';
import { applyCompanionTravelChoice } from './companionTravelReducer';
import { discussCompanionRumor } from './companionRumorReducer';
import { discussCompanionDestination } from './companionGoalDestinationReducer';
import { applyCompanionGoalWorkChoice } from './companionGoalWorkReducer';
import { separatedCompanion, retainCompanionWhereabouts, validCompanionPosition } from '../../systems/companions/companionWhereabouts';
import { arrivingCompanions } from '../../systems/companions/companionJourney';
import { spendPartyProvisions } from '../../systems/travel/partyProvisions';
import { promoteCompanionToMember } from '../../systems/party/npcToPartyMember';
import { authoredCompanionCapabilities } from '../../systems/party/authoredCompanionCapabilities';
import { mergeConversationArchive } from '../../systems/companions/conversationTranscript';

export function companionReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'SPEND_TRAVEL_PROVISIONS':
      return spendPartyProvisions(state, action.payload.rations, action.payload.water, action.payload.destinationCellId) ?? {};
    case 'RECORD_COMPANION_ARRIVALS': {
      const { worldSeed, locationId, arrivals } = action.payload;
      const expected = arrivingCompanions(state), feet = state.playerGroundPos;
      if (worldSeed !== state.worldSeed || locationId !== state.currentLocationId || !feet || !validCompanionPosition(feet)
        || arrivals.length !== expected.length || !expected.length || new Set(arrivals.map(a => a.companionId)).size !== arrivals.length) return {};
      for (const c of expected) {
        const found = arrivals.find(a => a.companionId === c.id);
        if (!found || found.journeyId !== c.journey!.id || !validCompanionPosition(found.position)
          || Math.hypot(found.position.xM - feet.xM, found.position.zM - feet.zM) > 8.1) return {};
      }
      const companions = { ...state.companions };
      for (const c of expected) {
        const position = arrivals.find(a => a.companionId === c.id)!.position, leg = c.journey!;
        companions[c.id] = { ...c, journey: { ...leg, status: 'arrived' },
          whereabouts: { worldSeed, locationId, observedAt: state.gameTime.getTime(), source: 'party', position: { ...position } },
          following: { worldSeed, locationId, trail: [{ xM: feet.xM, yM: feet.yM, zM: feet.zM }] },
          memories: [...c.memories, { id: `${leg.id}:arrived`, type: 'event', timestamp: leg.arrivalAt, importance: 5,
            text: c.travelAgreement?.response === 'accepted' ? `Traveled together on the agreed ${c.travelAgreement.destinationName} expedition.` : 'Shared a journey with the party.',
            tags: ['shared-journey', 'arrived', leg.id] }],
        };
      }
      return { companions };
    }
    case 'RECORD_COMPANION_POSITION': {
      const { companionId, worldSeed, locationId, position, trail } = action.payload;
      const companion = state.companions[companionId];
      // Moving party bodies checkpoint their own reached feet and unresolved
      // route. Membership alone cannot relocate a person from another cell.
      if (companion?.inParty && state.party.some(member => member.id === companionId)) {
        if (worldSeed !== state.worldSeed || locationId !== state.currentLocationId
          || companion.whereabouts?.worldSeed !== worldSeed || companion.whereabouts.locationId !== locationId
          || !validCompanionPosition(position) || !Array.isArray(trail) || trail.length > 512
          || !trail.every(point => point && validCompanionPosition(point))) return {};
        const previous = companion.whereabouts.position, following = companion.following;
        // Remounting unchanged feet is not a new event. Preserve the exact
        // checkpoint and its time rather than changing a resting save on Load.
        if (companion.whereabouts.source === 'party' && previous
          && previous.xM === position.xM && previous.yM === position.yM && previous.zM === position.zM
          && following?.worldSeed === worldSeed && following.locationId === locationId
          && following.trail.length === trail.length && following.trail.every((point, index) =>
            point.xM === trail[index].xM && point.yM === trail[index].yM && point.zM === trail[index].zM)) return {};
        return { companions: { ...state.companions, [companionId]: { ...companion,
          journeyDeparture: companion.journeyDeparture ?? companion.whereabouts,
          whereabouts: { ...companion.whereabouts, source: 'party', observedAt: state.gameTime.getTime(), position: { ...position } },
          following: { worldSeed, locationId, trail: trail.map(point => ({ ...point })) },
        } } };
      }
      // Ignore an old scene's callback, remote knowledge, and camera re-entry.
      // Only the first actual cast placement may attach a point to this sojourn.
      if (!companion || worldSeed !== state.worldSeed || locationId !== state.currentLocationId
        || !state.currentLocationActiveDynamicNpcIds?.includes(companionId)
        || companion.inParty || state.party.some(member => member.id === companionId)
        || !state.generatedNpcs[companionId] || !validCompanionPosition(position)) return {};
      const companions = retainCompanionWhereabouts(state);
      const placed = companions[companionId];
      if (!placed.whereabouts || placed.whereabouts.position) return {};
      return { companions: { ...companions, [companionId]: { ...placed,
        whereabouts: { ...placed.whereabouts, position: { ...position } },
      } } };
    }
    case 'COMPANION_TRAVEL_CHOICE': {
      const result=applyCompanionTravelChoice(state,action.payload.companionId,action.payload.choice);
      // Dialogue owns consent and its remembered terms. Existing recruitment
      // still owns both party/companion stores, under the same latest state.
      return {...result.patch,...(result.recruit?companionReducer({...state,...result.patch},
        {type:'RECRUIT_COMPANION',payload:result.recruit}):{})};
    }
    case 'COMPANION_GOAL_WORK_CHOICE':
      return applyCompanionGoalWorkChoice(state, action.payload.companionId, action.payload.choice);
    case 'DISCUSS_COMPANION_DESTINATION':
      return discussCompanionDestination(state, action.payload);
    case 'DISCUSS_COMPANION_RUMOR':
      return discussCompanionRumor(state, action.payload);
    case 'COMPANION_PREPARATION_CHOICE':
      return applyCompanionPreparationChoice(state, action.payload.companionId, action.payload.choice);
    // Recruit an NPC (or promote an authored companion) into the party.
    //
    // Membership spans TWO unlinked stores (see DISCOVERY §1): the playable
    // roster `state.party: PlayerCharacter[]` and the relationship layer
    // `state.companions`. A correct join writes BOTH under one shared id
    // (`payload.character.id === payload.companion.id`). This membership-pair
    // mutation is deliberately consolidated HERE rather than split across
    // characterReducer.ts, so the two halves never drift out of sync.
    //
    // DESIGN §5.1: there is NO hard cap — recruiting is never blocked by size.
    // The soft cap is only a UI hint; we surface a non-blocking notice when the
    // party grows past it, but the recruit always succeeds.
    case 'RECRUIT_COMPANION': {
      const { character, companion, source, hireCostGp } = action.payload;

      // Idempotency / safety: if this id is already an active party member,
      // don't double-append. (Re-recruiting a former member is fine: they were
      // removed from `party` on leave, so this path adds them back.)
      const alreadyInParty = state.party.some(member => member.id === character.id);
      // Paid consent has already been evaluated by the existing offer owner.
      // Money and membership still settle against this latest state together:
      // stale funds, repeated hires or altered quotes cannot recruit for free.
      let payment: ReturnType<typeof payPartyFunds> = null;
      if (hireCostGp !== undefined) {
        const expectedCost = 15 * Math.max(1, character.level ?? 1);
        if (source !== 'tavern' || alreadyInParty || character.id !== companion.id
          || !Number.isFinite(hireCostGp) || hireCostGp !== expectedCost) return {};
        payment = payPartyFunds(state, hireCostGp);
        if (!payment) return {};
      }
      // Both authored invitation paths converge here. The same met NPC keeps
      // their rolled mechanics and worn gear when consent actually recruits
      // them; repeated recruitment never replaces an active, injured member.
      const recruitedCharacter = !alreadyInParty && source === 'promote' && state.generatedNpcs?.[companion.id]
        ? promoteCompanionToMember(companion, character.class.id, character.level, state.generatedNpcs[companion.id]).character
        : character;
      const withCapabilities = !alreadyInParty && source === 'promote'
        ? authoredCompanionCapabilities(recruitedCharacter, companion, 'new-recruit', state) : recruitedCharacter;
      const nextParty = alreadyInParty ? state.party : [...state.party, withCapabilities];

      const messages = [...state.messages];
      messages.push({
        id: Date.now(),
        text: payment
          ? `You pay ${hireCostGp} gold and ${companion.identity.name} joins your party.`
          : `${companion.identity.name} joins the party.`,
        sender: 'system',
        timestamp: inGameTimestamp(state.gameTime),
      });

      // Soft-cap notice only — never blocks the recruit (DESIGN §5.1).
      if (isOverSoftCap(nextParty)) {
        messages.push({
          id: Date.now() + 1,
          text: 'Your party has grown quite large — managing this many companions may be unwieldy.',
          sender: 'system',
          timestamp: inGameTimestamp(state.gameTime),
        });
      }

      return {
        ...(payment ?? {}),
        party: nextParty,
        // Recruitment and Load use the same local-roster convention. Leaving
        // a joined id here previously changed the save on its first reload.
        ...(state.currentLocationActiveDynamicNpcIds?.includes(companion.id) ? {
          currentLocationActiveDynamicNpcIds: state.currentLocationActiveDynamicNpcIds.filter(id => id !== companion.id).length
            ? state.currentLocationActiveDynamicNpcIds.filter(id => id !== companion.id) : null,
        } : {}),
        companions: {
          ...state.companions,
          [companion.id]: { ...companion, inParty: true },
        },
        messages,
        ...(alreadyInParty
          ? {}
          : appendAdventureLogEntry(state, {
              kind: 'met-npc',
              summary: `${companion.identity.name} joined the party.`,
              npcIds: [companion.id],
            })),
      };
    }

    // Player-initiated removal of a party member. Mirrors COMPANION_DESERT's
    // dual-store removal but without the loyalty/abandonment framing.
    //
    // DESIGN §5: the party leader (index 0, or the `player` id) CANNOT be
    // dismissed. The Companion record is KEPT and marked `inParty:false` so the
    // relationship persists and the character is re-recruitable.
    case 'DISMISS_PARTY_MEMBER': {
      const { memberId } = action.payload;

      const leaderId = state.party[0]?.id;
      if (memberId === 'player' || memberId === leaderId) {
        return {
          messages: [
            ...state.messages,
            {
              id: Date.now(),
              text: 'The party leader cannot be dismissed.',
              sender: 'system',
              timestamp: inGameTimestamp(state.gameTime),
            },
          ],
        };
      }

      const nextParty = state.party.filter(member => member.id !== memberId);
      const companion = state.companions[memberId];

      const result: Partial<GameState> = { party: nextParty };

      if (companion) {
        result.companions = {
          ...state.companions,
          [memberId]: state.party.some(member => member.id === memberId)
            ? separatedCompanion(state, companion, 'dismissed') : { ...companion, inParty: false },
        };
        result.messages = [
          ...state.messages,
          {
            id: Date.now(),
            text: `${companion.identity.name} leaves the party.`,
            sender: 'system',
            timestamp: inGameTimestamp(state.gameTime),
          },
        ];
      }

      return result;
    }

    case 'UPDATE_COMPANION_APPROVAL': {
      // `source` stays in the payload as provenance for upstream routing, but this reducer
      // still resolves the approval delta through the player-targeted relationship path.
      // Keep any future companion-vs-companion branching explicit instead of hiding it here.
      const { companionId, change, reason, source: _source } = action.payload;
      const companion = state.companions[companionId];

      if (!companion) {
        console.warn(`Companion ${companionId} not found`);
        return {};
      }

      // Default to updating player relationship
      // In future, targetId could be dynamic if companions interact with each other
      const targetId = 'player';

      const updatedCompanion = RelationshipManager.processApprovalEvent(
        companion,
        targetId,
        change,
        reason,
        state.gameTime.getTime()
      );

      // If approval changed significantly, maybe queue a message
      let messages = state.messages;
      const oldApproval = companion.relationships[targetId]?.approval || 0;
      const newApproval = updatedCompanion.relationships[targetId].approval;

      const oldUnlocks = companion.relationships[targetId]?.unlocks || [];
      const newUnlocks = updatedCompanion.relationships[targetId].unlocks || [];

      // Notify on significant approval change (25+ on 500 scale = quarter of a level)
      if (Math.abs(newApproval - oldApproval) >= 25) {
        const sign = change > 0 ? 'approves' : 'disapproves';
        messages = [
          ...messages,
          {
            id: Date.now(),
            text: `${companion.identity.name} ${sign} of that.`,
            sender: 'system',
            timestamp: inGameTimestamp(state.gameTime)
          }
        ];
      }

      // Notify on New Unlocks
      if (newUnlocks.length > oldUnlocks.length) {
        // Find the new ones
        const newlyUnlocked = newUnlocks.filter(u => !oldUnlocks.some(old => old.id === u.id));
        newlyUnlocked.forEach(unlock => {
          messages = [
            ...messages,
            {
              id: Date.now() + Math.random(), // slight offset
              text: `RELATIONSHIP MILESTONE: ${companion.identity.name} has unlocked "${unlock.description}"`,
              sender: 'system',
              timestamp: inGameTimestamp(state.gameTime)
            }
          ];
        });
      }

      return {
        companions: {
          ...state.companions,
          [companionId]: updatedCompanion
        },
        messages
      };
    }

    // ADVANCE_TIME reaches this reducer after worldReducer has already advanced
    // GameState.gameTime. Re-evaluating romance here ties the 24-hour policy to the
    // existing durable Chronos action without adding a second clock or action.
    case 'ADVANCE_TIME': {
      let companionsChanged = false;

      // Most time advances do nothing. Only companions with a newly started or
      // completed hostile-romance interval receive a new persisted object.
      const companions = Object.fromEntries(
        Object.entries(state.companions).map(([companionId, companion]) => {
          const updatedCompanion = RelationshipManager.processInWorldTime(
            companion,
            state.gameTime.getTime()
          );
          if (updatedCompanion !== companion) {
            companionsChanged = true;
          }
          return [companionId, updatedCompanion];
        })
      );

      return companionsChanged ? { companions } : {};
    }

    // Adjust a companion's loyalty (0–100), the "will they leave/betray" meter.
    // Used by travel provisioning to drain loyalty on a starving march.
    case 'ADJUST_COMPANION_LOYALTY': {
      const { companionId, delta } = action.payload;
      const companion = state.companions[companionId];
      if (!companion) return {};
      const loyalty = Math.max(0, Math.min(100, companion.loyalty + delta));
      return {
        companions: { ...state.companions, [companionId]: { ...companion, loyalty } },
      };
    }

    // A companion abandons the party (e.g. marched too long while starving).
    // Removes them from BOTH stores' active membership and announces it.
    //
    // DESIGN §5: like dismiss, this KEEPS the Companion record (marked
    // `inParty:false`) so the relationship/loyalty persists and they remain
    // re-recruitable, AND it drops the matching `state.party` entry so the
    // playable roster stays consistent with the relationship layer.
    case 'COMPANION_DESERT': {
      const { companionId } = action.payload;
      const companion = state.companions[companionId];
      if (!companion) return {};
      return {
        party: state.party.filter(member => member.id !== companionId),
        companions: {
          ...state.companions,
          [companionId]: state.party.some(member => member.id === companionId)
            ? separatedCompanion(state, companion, 'deserted') : { ...companion, inParty: false },
        },
        messages: [
          ...state.messages,
          {
            id: Date.now(),
            text: `${companion.identity.name} can bear no more and abandons the party.`,
            sender: 'system',
            timestamp: inGameTimestamp(state.gameTime),
          },
        ],
      };
    }

    case 'ADD_COMPANION_REACTION': {
      const { companionId, reaction } = action.payload;
      const companion = state.companions[companionId];

      if (!companion) return {};

      return {
        messages: [
          ...state.messages,
          {
            id: Date.now(),
            text: `${companion.identity.name}: "${reaction}"`,
            sender: 'npc',
            timestamp: inGameTimestamp(state.gameTime),
            metadata: {
              companionId: companion.id,
              reactionType: 'comment'
            }
          }
        ]
      };
    }

    case 'ADD_COMPANION_MEMORY': {
      const { companionId, memory } = action.payload;
      const companion = state.companions[companionId];
      if (!companion) return {};

      // Append new memory
      const updatedCompanion = {
        ...companion,
        memories: [...(companion.memories || []), memory]
      };

      return {
        companions: {
          ...state.companions,
          [companionId]: updatedCompanion
        }
      };
    }

    case 'ADD_DISCOVERED_FACT': {
      const { companionId, fact } = action.payload;
      const companion = state.companions[companionId];
      if (!companion) return {};

      // Check for duplicate facts (case-insensitive comparison)
      const existingFacts = companion.discoveredFacts || [];
      const isDuplicate = existingFacts.some(
        existing => existing.fact.toLowerCase().trim() === fact.fact.toLowerCase().trim()
      );

      if (isDuplicate) {
        console.debug(`Skipping duplicate fact for ${companionId}: "${fact.fact}"`);
        return {};
      }

      const updatedCompanion = {
        ...companion,
        discoveredFacts: [...existingFacts, fact]
      };

      return {
        companions: {
          ...state.companions,
          [companionId]: updatedCompanion
        }
      };
    }

    case 'ARCHIVE_BANTER': {
      // Add the new banter moment to the archive
      // We prepend it so the newest are first (or append if preferred, but usually history is newest-first)
      // Actually, standard arrays are usually push, and UI sorts. Let's prepend for easy "recent" access.
      const moment = action.payload;
      const archivedBanters = mergeConversationArchive(state.archivedBanters, moment);
      return archivedBanters === state.archivedBanters ? {} : { archivedBanters };
    }

    default:
      return {};
  }
}
