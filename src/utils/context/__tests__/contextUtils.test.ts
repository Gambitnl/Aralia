
import { describe, it, expect, vi } from 'vitest';
import { generateGeneralActionContext } from '../contextUtils';
import { GameState, PlayerCharacter, NPC, Location, GamePhase } from '../../types';
// TODO(lint-intent): 'BIOMES' is unused in this test; use it in the assertion path or remove it.
import { BIOMES as _BIOMES, ITEMS as _ITEMS } from '../../constants';

// Mock constants
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

// Mock timeUtils to return a fixed description so tests don't flake on time
vi.mock('../timeUtils', () => ({
  getTimeModifiers: () => ({ description: 'The air is still.' }),
  formatGameTime: () => '12:00 PM'
}));

// Mock Backgrounds
vi.mock('../../data/backgrounds', () => ({
  BACKGROUNDS: {
    'soldier': {
      id: 'soldier',
      name: 'Soldier',
      description: 'You served in the army.',
      feature: { name: 'Rank', description: 'You have a rank.' }
    }
  }
}));

// Mock Classes
vi.mock('../../data/classes', () => ({
  CLASSES_DATA: {
    'fighter': {
      id: 'fighter',
      name: 'Fighter',
      description: 'A master of martial combat.'
    }
  }
}));


describe('contextUtils', () => {
  const mockPlayer: PlayerCharacter = {
    name: 'Hero',
    age: 30,
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
    conditions: [],
    background: 'soldier',
    visualDescription: 'A scarred veteran.'
  };

  const mockLocation: Location = {
    id: 'loc_1',
    name: 'Old Ruins',
    baseDescription: 'Crumbling walls.',
    exits: {},
    mapCoordinates: { x: 0, y: 0 },
    biomeId: 'biome_1',
    itemIds: ['item_1']
  };

  const mockGameState: GameState = {
    phase: GamePhase.PLAYING,
    party: [mockPlayer],
    tempParty: null,
    inventory: [],
    gold: 0,
    currentLocationId: 'loc_1',
    subMapCoordinates: null,
    messages: [
      { id: 1, text: 'Welcome to the game', sender: 'system', timestamp: new Date() },
      { id: 2, text: 'I look around', sender: 'player', timestamp: new Date() },
      { id: 3, text: 'You see nothing.', sender: 'system', timestamp: new Date() }
    ],
    isLoading: false,
    loadingMessage: null,
    isImageLoading: false,
    error: null,
    worldSeed: 123,
    mapData: null,
    isMapVisible: false,
    isSubmapVisible: false,
    isPartyOverlayVisible: false,
    isNpcTestModalVisible: false,
    isLogbookVisible: false,
    isGameGuideVisible: false,
    dynamicLocationItemIds: {},
    currentLocationActiveDynamicNpcIds: [],
    geminiGeneratedActions: [],
    characterSheetModal: { isOpen: false, character: null },
    gameTime: new Date('2024-01-01T12:00:00'),
    isDevMenuVisible: false,
    isPartyEditorVisible: false,
    isGeminiLogViewerVisible: false,
    geminiInteractionLog: [],
    hasNewRateLimitError: false,
    devModelOverride: null,
    isEncounterModalVisible: false,
    generatedEncounter: null,
    encounterSources: null,
    encounterError: null,
    currentEnemies: null,
    lastInteractedNpcId: null,
    lastNpcResponse: null,
    inspectedTileDescriptions: {},
    discoveryLog: [],
    unreadDiscoveryCount: 0,
    isDiscoveryLogVisible: false,
    isGlossaryVisible: false,
    npcMemory: {},
    locationResidues: {},
    metNpcIds: [],
    merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
    questLog: [
      {
        id: 'q1',
        title: 'Find the Sword',
        description: 'A lost relic.',
        status: 'Active',
        objectives: [
            { id: 'o1', description: 'Search the ruins', isCompleted: false },
            { id: 'o2', description: 'Return to town', isCompleted: false }
        ],
        dateStarted: 0,
        giverId: 'npc1'
      }
    ]
  } as unknown as GameState;

  it('generates rich context with character background and quest details', () => {
    const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    // Player Basics
    expect(context).toContain('## PLAYER');
    expect(context).toContain('Name: Hero | HP: 10/20');
    expect(context).toContain('Age: 30');
    expect(context).toContain('Race: Human');
    expect(context).toContain('Class: Fighter');
    expect(context).toContain('Class Flavor: A master of martial combat.');

    // Character Details
    expect(context).toContain('## CHARACTER DETAILS');
    expect(context).toContain('Background: Soldier');
    expect(context).toContain('Archetype: You served in the army.');
    expect(context).toContain('Background Feature: "Rank" - You have a rank.');
    expect(context).toContain('Appearance: A scarred veteran.');

    // Location
    expect(context).toContain('## LOCATION');
    expect(context).toContain('Old Ruins (Enchanted Forest)');
    expect(context).toContain('Visible Items: Rusty Sword');

    // Quests (Rich)
    expect(context).toContain('## ACTIVE QUESTS');
    expect(context).toContain('- **Find the Sword**: A lost relic.');
    expect(context).toContain('*Current Objectives:*');
    expect(context).toContain('- [ ] Search the ruins');
    expect(context).toContain('- [ ] Return to town');

    // History
    expect(context).toContain('## RECENT HISTORY');
    expect(context).toContain('[Narrator]: Welcome to the game');
  });

  it('generates fallback implicit appearance if visualDescription is missing', () => {
    const fallbackPlayer = {
        ...mockPlayer,
        visualDescription: undefined,
        visuals: { gender: 'Female', skinColor: 0 }
    } as PlayerCharacter;

    const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: fallbackPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).toContain('Appearance: A Female Human.');
  });

  it('handles empty history and quests gracefully', () => {
    const emptyState = { ...mockGameState, messages: [], questLog: [] };
    const context = generateGeneralActionContext({
      gameState: emptyState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).not.toContain('## ACTIVE QUESTS');
    expect(context).not.toContain('## RECENT HISTORY');
  });

  it('formats NPCs correctly', () => {
     const mockNPC: NPC = { id: 'npc1', name: 'Gandalf', baseDescription: '', initialPersonalityPrompt: '', role: 'unique' };
     const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: [mockNPC]
    });

    expect(context).toContain('## NPCS');
    expect(context).toContain('- Gandalf (unique): Neutral');
  });
});
