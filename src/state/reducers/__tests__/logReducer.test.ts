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
});
