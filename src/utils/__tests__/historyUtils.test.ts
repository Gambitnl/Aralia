import { describe, it, expect } from 'vitest';
import { createWorldEvent, addConsequence, recordEvent, getKnownEvents, learnEvent } from '../historyUtils';
import { GameState } from '../../types';
import { WorldEvent } from '../../types/history';

describe('HistoryUtils', () => {
  const mockDate = 1000;

  const mockState = {
    worldHistory: [],
    // ... minimal mock of other state if needed, but Utils shouldn't need more than what they touch
  } as unknown as GameState;

  it('should create a world event', () => {
    const event = createWorldEvent('evt-1', 'MAJOR_EVENT', mockDate, 'Something happened', 50);
    expect(event.id).toBe('evt-1');
    expect(event.type).toBe('MAJOR_EVENT');
    expect(event.timestamp).toBe(mockDate);
    expect(event.consequences).toEqual([]);
    expect(event.knownBy).toEqual([]);
  });

  it('should add consequences', () => {
    let event = createWorldEvent('evt-1', 'MAJOR_EVENT', mockDate, 'Something happened', 50);
    event = addConsequence(event, {
      type: 'faction_power',
      targetId: 'faction-a',
      value: -10,
      description: 'Lost power'
    });
    expect(event.consequences).toHaveLength(1);
    expect(event.consequences[0].targetId).toBe('faction-a');
  });

  it('should record events to state', () => {
    const event = createWorldEvent('evt-1', 'MAJOR_EVENT', mockDate, 'Something happened', 50);
    const newState = recordEvent(mockState, event);
    expect(newState.worldHistory).toHaveLength(1);
    expect(newState.worldHistory![0].id).toBe('evt-1');
  });

  it('should retrieve known events', () => {
    let state = { ...mockState };
    const event1 = { ...createWorldEvent('evt-1', 'MAJOR_EVENT', mockDate, 'Public event', 50), knownBy: ['public'] };
    const event2 = { ...createWorldEvent('evt-2', 'MAJOR_EVENT', mockDate, 'Secret event', 50), knownBy: ['player'] };
    const event3 = { ...createWorldEvent('evt-3', 'MAJOR_EVENT', mockDate, 'Unknown event', 50), knownBy: [] };

    state = recordEvent(state, event1);
    state = recordEvent(state, event2);
    state = recordEvent(state, event3);

    const playerEvents = getKnownEvents(state, 'player');
    expect(playerEvents).toHaveLength(2); // evt-2 (known) + evt-1 (public is not automatically 'player' unless handled, wait logic check)

    // Check public logic in getKnownEvents
    // Code: (event.knownBy.includes(entityId) || event.knownBy.includes('public'))
    // So yes, playerEvents should have evt-1 and evt-2.
    const ids = playerEvents.map(e => e.id);
    expect(ids).toContain('evt-1');
    expect(ids).toContain('evt-2');
    expect(ids).not.toContain('evt-3');
  });

  it('should allow learning events', () => {
    let state = { ...mockState };
    const event = createWorldEvent('evt-1', 'MAJOR_EVENT', mockDate, 'Secret', 50);
    state = recordEvent(state, event);

    expect(getKnownEvents(state, 'player')).toHaveLength(0);

    state = learnEvent(state, 'evt-1', 'player');
    expect(getKnownEvents(state, 'player')).toHaveLength(1);
  });
});
