import { describe, it, expect } from 'vitest';
import { HistoryService } from '../HistoryService';
// TODO(lint-intent): 'GameState' is unused in this test; use it in the assertion path or remove it.
import { GameState as _GameState } from '../../../types';
import { createMockGameState } from '../../../utils/factories';

describe('HistoryService', () => {
  const mockState = createMockGameState();

  // Setup minimal faction data for tests
  mockState.factions = {
    'faction_a': {
      id: 'faction_a',
      name: 'The Red Hand',
      description: 'Test military faction',
      type: 'MILITARY',
      colors: { primary: '#aa0000', secondary: '#550000' },
      ranks: [],
      allies: [],
      enemies: [],
      rivals: [],
      relationships: {},
      values: [],
      hates: [],
      power: 10,
      assets: []
    },
    'faction_b': {
      id: 'faction_b',
      name: 'The Blue Shield',
      description: 'Test religious faction',
      type: 'RELIGIOUS_ORDER',
      colors: { primary: '#0044aa', secondary: '#002255' },
      ranks: [],
      allies: [],
      enemies: [],
      rivals: [],
      relationships: {},
      values: [],
      hates: [],
      power: 10,
      assets: []
    }
  };
  mockState.gameTime = new Date('2024-01-01T12:00:00Z');

  it('should create a valid Faction Conflict event', () => {
    const event = HistoryService.createFactionConflictEvent(
      mockState,
      'Battle of the Bridge',
      'Red Hand attacked Blue Shield',
      'faction_a',
      'faction_b',
      'faction_a',
      'loc_bridge'
    );

    expect(event.type).toBe('FACTION_WAR');
    expect(event.title).toBe('Battle of the Bridge');
    expect(event.tags).toContain('war');
    expect(event.tags).toContain('victory');
    expect(event.participants).toHaveLength(2);
    expect(event.participants[0].name).toBe('The Red Hand');
    expect(event.locationId).toBe('loc_bridge');
    expect(event.id).toContain('HIST-');
  });

  it('should create a valid Political Shift event', () => {
    const event = HistoryService.createPoliticalShiftEvent(
      mockState,
      'Peace Treaty',
      'They signed a treaty',
      'faction_a',
      'faction_b',
      'peace'
    );

    expect(event.type).toBe('POLITICAL_SHIFT');
    expect(event.tags).toContain('peace');
    expect(event.participants).toHaveLength(2);
  });

  it('should create a valid Discovery event', () => {
    const event = HistoryService.createDiscoveryEvent(
      mockState,
      'Found Ancient Ruins',
      'The party discovered a temple',
      'loc_ruins'
    );

    expect(event.type).toBe('DISCOVERY');
    expect(event.locationId).toBe('loc_ruins');
    expect(event.participants[0].type).toBe('player');
  });

  it('should create a valid Catastrophe event', () => {
    const event = HistoryService.createCatastropheEvent(
      mockState,
      'Volcanic Eruption',
      'The mountain exploded',
      'loc_volcano'
    );

    expect(event.type).toBe('CATASTROPHE');
    expect(event.importance).toBe(8);
    expect(event.tags).toContain('disaster');
  });
});
