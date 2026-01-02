
import { describe, it, expect, vi } from 'vitest';
import { generateGeneralActionContext } from '../contextUtils';
import { GameState, PlayerCharacter, Location, GamePhase, WorldRumor, WeatherState } from '../../types';

// Mock dependencies
vi.mock('../../constants', () => ({
  BIOMES: {
    'biome_1': { name: 'Enchanted Forest' }
  },
  ITEMS: {
    'item_1': { name: 'Rusty Sword' }
  }
}));

vi.mock('../submapUtils', () => ({
  getSubmapTileInfo: () => null
}));

vi.mock('../timeUtils', () => ({
  getTimeModifiers: () => ({ description: 'The stars are bright.' }), // Fallback description
  formatGameTime: () => '12:00 AM'
}));

vi.mock('../../data/backgrounds', () => ({
  BACKGROUNDS: {}
}));

describe('contextUtils (Enhanced)', () => {
  const mockPlayer: PlayerCharacter = {
    name: 'Hero',
    race: { name: 'Human', id: 'human', description: '', traits: [] },
    class: { name: 'Fighter', id: 'fighter', description: '', hitDie: 10, primaryAbility: [], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] },
    hp: 10,
    maxHp: 20,
    transportMode: 'foot',
    abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    skills: [],
    speed: 30,
    darkvisionRange: 0,
    equippedItems: {},
    conditions: []
  };

  const mockLocation: Location = {
    id: 'loc_1',
    name: 'Test Location',
    baseDescription: 'A test place.',
    exits: {},
    mapCoordinates: { x: 0, y: 0 },
    biomeId: 'biome_1'
  };

  // Setup mock rumors
  const rumorOld: WorldRumor = {
    id: 'r1', text: 'Old news', type: 'misc', timestamp: 100, expiration: 200
  };
  const rumorNew: WorldRumor = {
    id: 'r2', text: 'Fresh news', type: 'misc', timestamp: 200, expiration: 300
  };
  const rumorWar: WorldRumor = {
    id: 'r3', text: 'War declared', type: 'skirmish', timestamp: 150, expiration: 250
  };

  // Setup mock weather
  const mockEnvironment: WeatherState = {
    currentCondition: { id: 'rain', name: 'Heavy Rain', description: 'Pouring rain.' },
    temperature: 65,
    windSpeed: 15,
    isPrecipitating: true,
    humidity: 0.8,
    visibility: 0.5,
    cloudCover: 1.0,
    forecast: []
  };

  const mockGameState: GameState = {
    phase: GamePhase.PLAYING,
    party: [mockPlayer],
    activeRumors: [rumorOld, rumorNew, rumorWar],
    environment: mockEnvironment,
    currentLocationId: 'loc_1',
    messages: [],
    gameTime: new Date('2024-01-01T00:00:00'),
    npcMemory: {},
    factions: {},
    playerFactionStandings: {},
    questLog: [],
    notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [] }
  } as unknown as GameState;

  it('includes ## ATMOSPHERE & ENVIRONMENT with rich weather data', () => {
    const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).toContain('## ATMOSPHERE & ENVIRONMENT');
    expect(context).toContain('Time: 12:00 AM');
    expect(context).toContain('Weather: Heavy Rain (Temp: 65°F, Wind: 15 mph)');
    expect(context).toContain('Look/Feel: Pouring rain.');
  });

  it('includes ## WORLD RUMORS & NEWS sorted by recency', () => {
    const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).toContain('## WORLD RUMORS & NEWS');

    // Check order: Fresh news (200) -> War (150) -> Old news (100)
    const lines = context.split('\n');
    const rumorSectionIndex = lines.findIndex(l => l.includes('## WORLD RUMORS & NEWS'));
    const rumors = lines.slice(rumorSectionIndex + 1, rumorSectionIndex + 4);

    expect(rumors[0]).toContain('Fresh news');
    expect(rumors[1]).toContain('War declared');
    expect(rumors[2]).toContain('Old news');
  });

  it('formats specific rumor types correctly', () => {
     const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).toContain('War News: "War declared"');
    expect(context).toContain('Rumor: "Fresh news"');
  });

  it('falls back gracefully when no environment state is present', () => {
     const fallbackState = { ...mockGameState, environment: undefined };
     const context = generateGeneralActionContext({
      gameState: fallbackState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).toContain('## ATMOSPHERE & ENVIRONMENT');
    expect(context).toContain('Time: 12:00 AM (The stars are bright.)');
    expect(context).not.toContain('Weather:');
  });
});
