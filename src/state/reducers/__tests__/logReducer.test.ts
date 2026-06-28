/**
 * This file proves the Logbook reducer keeps the player's discovery memory bounded and honest.
 *
 * The discovery log is the player's record of places, items, quests, and events.
 * These tests pin the retention and unread-count rules so long campaigns do not
 * silently grow save data forever or show a badge count that no longer matches
 * what the player can actually open.
 */

import { describe, expect, it } from 'vitest';
import { DiscoveryEntry, DiscoveryType } from '../../../types';
import { createMockGameState } from '../../../utils/factories';
import { AppAction } from '../../actionTypes';
import { logReducer, MAX_DISCOVERY_LOG_ENTRIES } from '../logReducer';

// ============================================================================
// Discovery Entry Fixtures
// ============================================================================
// These helpers create small, complete discovery entries so each test can focus
// on the Logbook behavior being protected instead of repeating boilerplate.
// ============================================================================

function createDiscoveryEntry(id: string, overrides: Partial<DiscoveryEntry> = {}): DiscoveryEntry {
  return {
    id,
    timestamp: Number(id.replace(/\D/g, '')) || 1,
    gameTime: '2026-06-18T12:00:00.000Z',
    type: DiscoveryType.MISC_EVENT,
    title: `Discovery ${id}`,
    content: `Discovery content ${id}`,
    source: { type: 'SYSTEM' },
    flags: [],
    isRead: false,
    ...overrides,
  };
}

describe('logReducer', () => {
  it('caps discovery entries at the retained limit and counts only retained unread entries', () => {
    // Build an oversized log where the oldest entry is unread. Adding one new
    // entry should keep the newest memories and remove that old unread entry
    // from both the visible log and the unread badge.
    const existingEntries = Array.from({ length: MAX_DISCOVERY_LOG_ENTRIES }, (_, index) =>
      createDiscoveryEntry(`existing-${index}`, {
        isRead: index % 2 === 0,
      })
    );
    const state = createMockGameState({
      discoveryLog: existingEntries,
      unreadDiscoveryCount: existingEntries.filter(entry => !entry.isRead).length,
    });

    const nextState = logReducer(state, {
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        id: 'newest-entry',
        type: DiscoveryType.MISC_EVENT,
        title: 'Newest entry',
        content: 'The newest retained discovery.',
      },
    });

    expect(nextState.discoveryLog).toHaveLength(MAX_DISCOVERY_LOG_ENTRIES);
    expect(nextState.discoveryLog?.[0]?.id).toBe('newest-entry');
    expect(nextState.discoveryLog?.some(entry => entry.id === `existing-${MAX_DISCOVERY_LOG_ENTRIES - 1}`)).toBe(false);
    expect(nextState.unreadDiscoveryCount).toBe(nextState.discoveryLog?.filter(entry => !entry.isRead).length);
  });

  it('still dedupes repeated location discoveries without changing unread count', () => {
    // Location discovery has special dedupe behavior that predates this cap.
    // Keep that guard intact so repeated movement triggers do not create noise.
    const state = createMockGameState({
      discoveryLog: [
        createDiscoveryEntry('existing-location', {
          type: DiscoveryType.LOCATION_DISCOVERY,
          flags: [{ key: 'locationId', value: 'green-harbor' }],
          isRead: false,
        }),
      ],
      unreadDiscoveryCount: 1,
    });

    const nextState = logReducer(state, {
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        id: 'duplicate-location',
        type: DiscoveryType.LOCATION_DISCOVERY,
        title: 'Green Harbor',
        content: 'The player returned to Green Harbor.',
        flags: [{ key: 'locationId', value: 'green-harbor' }],
      },
    });

    expect(nextState).toEqual({});
  });

  it('dedupes the same acquired item from the same source but keeps a new source entry', () => {
    // Picking up the same persistent item from the same location should not
    // create duplicate discovery memories. The same item found somewhere else
    // is still a separate player-facing discovery.
    const state = createMockGameState({
      discoveryLog: [
        createDiscoveryEntry('old-map-first', {
          type: DiscoveryType.ITEM_ACQUISITION,
          title: 'Item Acquired: Old Map',
          source: { type: 'LOCATION', id: 'green-harbor', name: 'Green Harbor' },
          flags: [{ key: 'itemId', value: 'old_map', label: 'Old Map' }],
          isRead: false,
        }),
      ],
      unreadDiscoveryCount: 1,
    });

    const duplicateResult = logReducer(state, {
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        type: DiscoveryType.ITEM_ACQUISITION,
        title: 'Item Acquired: Old Map',
        source: { type: 'LOCATION', id: 'green-harbor', name: 'Green Harbor' },
        flags: [{ key: 'itemId', value: 'old_map', label: 'Old Map' }],
      },
    });

    expect(duplicateResult).toEqual({});

    const newSourceResult = logReducer(state, {
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        type: DiscoveryType.ITEM_ACQUISITION,
        title: 'Item Acquired: Old Map',
        source: { type: 'LOCATION', id: 'bright-market', name: 'Bright Market' },
        flags: [{ key: 'itemId', value: 'old_map', label: 'Old Map' }],
      },
    });

    expect(newSourceResult.discoveryLog).toHaveLength(2);
    expect(newSourceResult.unreadDiscoveryCount).toBe(2);
  });

  it('dedupes repeated past-action discoveries but keeps harvest events append-only', () => {
    // Evidence found by the same NPC at the same location is a stable memory.
    // Harvest entries are intentionally repeatable because each harvest can be
    // a separate resource event even when the same item appears again.
    const state = createMockGameState({
      discoveryLog: [
        createDiscoveryEntry('old-evidence', {
          type: DiscoveryType.ACTION_DISCOVERED,
          title: 'Past Action Discovered',
          content: 'A guard found bootprints near the shrine.',
          source: { type: 'NPC', id: 'guard-1', name: 'Guard' },
          flags: [
            { key: 'npcId', value: 'guard-1', label: 'Guard' },
            { key: 'locationId', value: 'shrine', label: 'Shrine' },
          ],
          isRead: false,
        }),
        createDiscoveryEntry('old-harvest', {
          type: DiscoveryType.HARVEST,
          title: 'Harvested: Silverleaf',
          source: { type: 'PLAYER_ACTION', name: 'Harvest' },
          flags: [{ key: 'itemId', value: 'silverleaf', label: 'Silverleaf' }],
          isRead: false,
        }),
      ],
      unreadDiscoveryCount: 2,
    });

    const duplicateEvidenceResult = logReducer(state, {
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        type: DiscoveryType.ACTION_DISCOVERED,
        title: 'Past Action Discovered',
        content: 'A guard found bootprints near the shrine.',
        source: { type: 'NPC', id: 'guard-1', name: 'Guard' },
        flags: [
          { key: 'npcId', value: 'guard-1', label: 'Guard' },
          { key: 'locationId', value: 'shrine', label: 'Shrine' },
        ],
      },
    });

    expect(duplicateEvidenceResult).toEqual({});

    const repeatHarvestResult = logReducer(state, {
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        type: DiscoveryType.HARVEST,
        title: 'Harvested: Silverleaf',
        source: { type: 'PLAYER_ACTION', name: 'Harvest' },
        flags: [{ key: 'itemId', value: 'silverleaf', label: 'Silverleaf' }],
      },
    });

    expect(repeatHarvestResult.discoveryLog).toHaveLength(3);
    expect(repeatHarvestResult.unreadDiscoveryCount).toBe(3);
  });

  it('counts every quest entry that becomes unread during a quest update', () => {
    // A quest update rewrites every matching quest-linked discovery. If several
    // matching entries were already read, each one becomes newly unread and must
    // be reflected in the badge count.
    const state = createMockGameState({
      discoveryLog: [
        createDiscoveryEntry('quest-read-1', { isQuestRelated: true, questId: 'quest-1', isRead: true }),
        createDiscoveryEntry('quest-read-2', { isQuestRelated: true, questId: 'quest-1', isRead: true }),
        createDiscoveryEntry('quest-unread', { isQuestRelated: true, questId: 'quest-1', isRead: false }),
        createDiscoveryEntry('other-quest', { isQuestRelated: true, questId: 'quest-2', isRead: true }),
      ],
      unreadDiscoveryCount: 1,
    });

    const nextState = logReducer(state, {
      type: 'UPDATE_QUEST_IN_DISCOVERY_LOG',
      payload: {
        questId: 'quest-1',
        newStatus: 'completed',
        newContent: 'The courier reached the harbor.',
      },
    } as AppAction);

    expect(nextState.discoveryLog?.filter(entry => entry.questId === 'quest-1' && !entry.isRead)).toHaveLength(3);
    expect(nextState.unreadDiscoveryCount).toBe(3);
  });

  it('keeps only the newest appended quest update notes on matching discovery entries', () => {
    // Quest entries keep their original discovery text, but repeated quest
    // updates should not grow one content string forever in state and saves.
    let state = createMockGameState({
      discoveryLog: [
        createDiscoveryEntry('quest-entry', {
          isQuestRelated: true,
          questId: 'quest-long',
          isRead: true,
          content: 'The quest began at the harbor.',
        }),
      ],
      unreadDiscoveryCount: 0,
    });

    for (let index = 1; index <= 50; index += 1) {
      const nextState = logReducer(state, {
        type: 'UPDATE_QUEST_IN_DISCOVERY_LOG',
        payload: {
          questId: 'quest-long',
          newStatus: 'active',
          newContent: `Update ${index}`,
        },
      } as AppAction);

      state = createMockGameState({
        ...state,
        ...nextState,
      });
    }

    const questContent = state.discoveryLog[0]?.content ?? '';
    const retainedUpdates = questContent.match(/Update: Update \d+/g) ?? [];

    expect(questContent).toContain('The quest began at the harbor.');
    expect(retainedUpdates).toHaveLength(10);
    expect(questContent).not.toContain('Update: Update 40');
    expect(questContent).toContain('Update: Update 41');
    expect(questContent).toContain('Update: Update 50');
    expect(state.unreadDiscoveryCount).toBe(1);
  });

  it('stamps ADD_MESSAGE log entries with in-game time, overriding the real-world clock', () => {
    // Adventure-log entries must reflect the in-game clock (consistent with the
    // HUD date/time), not the real-world wall clock at which the message object
    // happened to be constructed. The reducer is the single source of truth.
    const inGameTime = new Date(Date.UTC(351, 0, 1, 7, 1, 0)); // 1 Deepwinter 351, 07:01
    const state = createMockGameState({ gameTime: inGameTime, messages: [] });

    const wallClock = new Date('2026-06-27T15:48:00.000Z'); // creator-set real-world stamp
    const nextState = logReducer(state, {
      type: 'ADD_MESSAGE',
      payload: { id: 1, text: 'You head North.', sender: 'system', timestamp: wallClock },
    } as AppAction);

    const stamped = nextState.messages?.[nextState.messages.length - 1];
    expect(new Date(stamped!.timestamp).getTime()).toBe(inGameTime.getTime());
    expect(new Date(stamped!.timestamp).getTime()).not.toBe(wallClock.getTime());
  });
});
