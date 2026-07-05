import { describe, it, expect } from 'vitest';
import {
  appendAdventureLogEntry,
  makeAdventureLogEntry,
  recentAdventureLog,
  formatGameClock,
  ADVENTURE_LOG_CAP,
} from '../adventureLog';
import { createMockGameState } from '../../../utils/core/factories';
import type { AdventureLogEntry } from '../../../types/state';

describe('adventureLog helpers', () => {
  it('formats the game clock as HH:MM', () => {
    const t = new Date(2024, 0, 1, 9, 5, 0);
    expect(formatGameClock(t)).toBe('09:05');
  });

  it('stamps a new entry with day/time and trims the summary', () => {
    const state = createMockGameState({ gameTime: new Date(2024, 0, 1, 14, 30, 0) });
    const entry = makeAdventureLogEntry(state, { kind: 'opening', summary: '  It begins.  ' });
    expect(entry.kind).toBe('opening');
    expect(entry.summary).toBe('It begins.');
    expect(entry.time).toBe('14:30');
    expect(typeof entry.day).toBe('number');
    expect(entry.id).toBeTruthy();
  });

  it('appends entries in play order', () => {
    let state = createMockGameState({ adventureLog: [] });
    state = { ...state, ...appendAdventureLogEntry(state, { kind: 'opening', summary: 'A' }) };
    state = { ...state, ...appendAdventureLogEntry(state, { kind: 'travel', summary: 'B' }) };
    expect(state.adventureLog.map(e => e.summary)).toEqual(['A', 'B']);
  });

  it('is idempotent for identical consecutive events (StrictMode double-fire safe)', () => {
    let state = createMockGameState({ adventureLog: [] });
    state = { ...state, ...appendAdventureLogEntry(state, { kind: 'quest', summary: 'Same' }) };
    state = { ...state, ...appendAdventureLogEntry(state, { kind: 'quest', summary: 'Same' }) };
    expect(state.adventureLog).toHaveLength(1);
  });

  it('allows the same summary again once a different event intervenes', () => {
    let state = createMockGameState({ adventureLog: [] });
    state = { ...state, ...appendAdventureLogEntry(state, { kind: 'quest', summary: 'X' }) };
    state = { ...state, ...appendAdventureLogEntry(state, { kind: 'rest', summary: 'Y' }) };
    state = { ...state, ...appendAdventureLogEntry(state, { kind: 'quest', summary: 'X' }) };
    expect(state.adventureLog.map(e => e.summary)).toEqual(['X', 'Y', 'X']);
  });

  it('records npcIds and placeIds only when provided', () => {
    const state = createMockGameState({ adventureLog: [] });
    const withRefs = appendAdventureLogEntry(state, {
      kind: 'met-npc',
      summary: 'Met Kael.',
      npcIds: ['npc-1'],
      placeIds: ['loc-1'],
    }).adventureLog[0];
    expect(withRefs.npcIds).toEqual(['npc-1']);
    expect(withRefs.placeIds).toEqual(['loc-1']);

    const noRefs = appendAdventureLogEntry(state, { kind: 'rest', summary: 'Rested.' }).adventureLog[0];
    expect(noRefs.npcIds).toBeUndefined();
    expect(noRefs.placeIds).toBeUndefined();
  });

  it('caps the log at ADVENTURE_LOG_CAP newest entries', () => {
    const many: AdventureLogEntry[] = Array.from({ length: ADVENTURE_LOG_CAP + 5 }, (_, i) => ({
      id: `e${i}`,
      day: 1,
      time: '00:00',
      timestamp: i,
      kind: 'travel',
      summary: `entry ${i}`,
    }));
    const state = createMockGameState({ adventureLog: many });
    const result = appendAdventureLogEntry(state, { kind: 'travel', summary: 'newest' });
    expect(result.adventureLog).toHaveLength(ADVENTURE_LOG_CAP);
    expect(result.adventureLog[result.adventureLog.length - 1].summary).toBe('newest');
    // Oldest entries were dropped.
    expect(result.adventureLog.some(e => e.summary === 'entry 0')).toBe(false);
  });

  it('recentAdventureLog returns the newest N in order', () => {
    const many: AdventureLogEntry[] = Array.from({ length: 30 }, (_, i) => ({
      id: `e${i}`, day: 1, time: '00:00', timestamp: i, kind: 'travel', summary: `entry ${i}`,
    }));
    const state = createMockGameState({ adventureLog: many });
    const recent = recentAdventureLog(state, 20);
    expect(recent).toHaveLength(20);
    expect(recent[0].summary).toBe('entry 10');
    expect(recent[19].summary).toBe('entry 29');
  });
});
