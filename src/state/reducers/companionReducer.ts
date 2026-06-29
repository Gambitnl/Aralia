// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:53:17
 * Dependents: state/appState.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/companionReducer.ts
 * Handles companion-related state updates.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { RelationshipManager } from '../../systems/companions/RelationshipManager';
import { inGameTimestamp } from '../../utils/core/timeUtils';
import { isOverSoftCap } from '../../systems/party/partyConstants';

export function companionReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
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
      const { character, companion } = action.payload;

      // Idempotency / safety: if this id is already an active party member,
      // don't double-append. (Re-recruiting a former member is fine: they were
      // removed from `party` on leave, so this path adds them back.)
      const alreadyInParty = state.party.some(member => member.id === character.id);
      const nextParty = alreadyInParty ? state.party : [...state.party, character];

      const messages = [...state.messages];
      messages.push({
        id: Date.now(),
        text: `${companion.identity.name} joins the party.`,
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
        party: nextParty,
        companions: {
          ...state.companions,
          [companion.id]: { ...companion, inParty: true },
        },
        messages,
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
          [memberId]: { ...companion, inParty: false },
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
        reason
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
          [companionId]: { ...companion, inParty: false },
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
      return {
        archivedBanters: [moment, ...(state.archivedBanters || [])]
      };
    }

    default:
      return {};
  }
}
