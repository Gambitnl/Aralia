
import { describe, it, expect, vi } from 'vitest';
import { generateGeneralActionContext } from '../contextUtils';
import { GameState, PlayerCharacter, NPC, Location, GamePhase } from '../../types';
import { BIOMES, ITEMS } from '../../constants';

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

describe('contextUtils', () => {
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
    equippedItems: {}
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
      { id: 'q1', title: 'Find the Sword', description: '', status: 'Active', objectives: [], dateStarted: 0, giverId: 'npc1' }
    ]
  } as unknown as GameState; // Cast to partial match

  it('generates context with player, location, history, and quests', () => {
    const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).toContain('Player: Hero, a Human Fighter (HP: 10/20)');
    expect(context).toContain('Location: The location is Old Ruins');
    expect(context).toContain('Biome: Enchanted Forest');
    expect(context).toContain('Visible Items: Rusty Sword');
    expect(context).toContain('Active Quests: Find the Sword');
    expect(context).toContain('Recent Events: [Narrator]: Welcome to the game | [Player]: I look around | [Narrator]: You see nothing.');
  });

  it('handles empty history and quests', () => {
    const emptyState = { ...mockGameState, messages: [], questLog: [] };
    const context = generateGeneralActionContext({
      gameState: emptyState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: []
    });

    expect(context).not.toContain('Active Quests:');
    expect(context).not.toContain('Recent Events:');
  });

  it('formats NPCs correctly', () => {
     const mockNPC: NPC = { id: 'npc1', name: 'Gandalf', baseDescription: '', initialPersonalityPrompt: '', role: 'unique' };
     const context = generateGeneralActionContext({
      gameState: mockGameState,
      playerCharacter: mockPlayer,
      currentLocation: mockLocation,
      npcsInLocation: [mockNPC]
    });

    expect(context).toContain('NPCs Present: Gandalf');
  });
});
