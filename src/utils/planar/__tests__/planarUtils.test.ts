
import { describe, it, expect } from 'vitest';
import { getPlanarSpellModifier, canActivatePortal, getCurrentPlane } from '../planarUtils';
import { PLANES } from '../../../data/planes';
import { SpellSchool } from '../../../types/spells';
import { GameState, GamePhase, Location, Portal, ItemType } from '../../../types';

describe('Planar Utils', () => {
  describe('getPlanarSpellModifier', () => {
    it('should return +1 for empowered schools in Feywild', () => {
      const modifier = getPlanarSpellModifier(SpellSchool.Illusion, PLANES['feywild']);
      expect(modifier).toBe(1);
    });

    it('should return 0 for unaffected schools in Feywild', () => {
      const modifier = getPlanarSpellModifier(SpellSchool.Evocation, PLANES['feywild']);
      expect(modifier).toBe(0);
    });

    it('should return +1 for Necromancy in Shadowfell', () => {
            const modifier = getPlanarSpellModifier(SpellSchool.Necromancy, PLANES['shadowfell']);
            expect(modifier).toBe(1);
          });

    it('should return -1 for Evocation (Light) in Shadowfell', () => {
      // Note: In our data, we just marked Evocation generally as impeded for simplicity in this test case logic,
      // or we need to check if the specific data entry matches.
      // Checking src/data/planes.ts:
      // affectsMagic: [{ school: 'Evocation', effect: 'impeded', description: 'Light spells are dimmed.' }]
            const modifier = getPlanarSpellModifier(SpellSchool.Evocation, PLANES['shadowfell']);
            expect(modifier).toBe(-1);
          });

    it('should return 0 for Material Plane', () => {
            const modifier = getPlanarSpellModifier(SpellSchool.Evocation, PLANES['material']);
            expect(modifier).toBe(0);
          });
  });

  describe('getCurrentPlane', () => {
    it('should return Material Plane if location has no planeId', () => {
      const location: Location = {
        id: 'loc1',
        name: 'Town',
        baseDescription: 'A town',
        exits: {},
        mapCoordinates: { x: 0, y: 0 },
        biomeId: 'plains'
      };
      const plane = getCurrentPlane(location);
      expect(plane.id).toBe('material');
    });

    it('should return Feywild if location has planeId="feywild"', () => {
      const location: Location = {
        id: 'loc2',
        name: 'Fey Glade',
        baseDescription: 'A glade',
        exits: {},
        mapCoordinates: { x: 0, y: 0 },
        biomeId: 'forest',
        planeId: 'feywild'
      };
      const plane = getCurrentPlane(location);
      expect(plane.id).toBe('feywild');
    });
  });

  describe('canActivatePortal', () => {
    const mockGameState: GameState = {
      phase: GamePhase.PLAYING,
      party: [],
      tempParty: null,
      inventory: [{ id: 'key1', name: 'Moonstone Key', type: ItemType.Key, description: 'A key' }],
      gold: 0,
      currentLocationId: 'loc1',
      subMapCoordinates: null,
      messages: [],
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
      currentLocationActiveDynamicNpcIds: null,
      geminiGeneratedActions: null,
      characterSheetModal: { isOpen: false, character: null },
      gameTime: new Date(),
      isDevMenuVisible: false,
      isPartyEditorVisible: false,
      isGeminiLogViewerVisible: false,
      geminiInteractionLog: [],
      isOllamaLogViewerVisible: false,
      ollamaInteractionLog: [],
      hasNewRateLimitError: false,
      devModelOverride: null,
      isDevModeEnabled: false,
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
      notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] },
      questLog: [],
      factions: {},
      playerFactionStandings: {},
      companions: {},
      economy: { marketEvents: [], tradeRoutes: [], globalInflation: 0, regionalWealth: {}, marketFactors: { scarcity: [], surplus: [] }, buyMultiplier: 1, sellMultiplier: 0.5, activeEvents: [] },
      religion: { divineFavor: {}, discoveredDeities: [], activeBlessings: [] },
      divineFavor: {},
      temples: {},
      fences: {},
      dynamicLocations: {},
      dynamicNPCs: {},
      playerFactionStandings: {},
      environment: { precipitation: 'none', temperature: 'temperate', wind: { direction: 'north', speed: 'calm' }, visibility: 'clear' },
      isThievesGuildVisible: false,
      isNavalDashboardVisible: false,
      activeDialogueSession: null,
      isDialogueInterfaceOpen: false,
      banterCooldowns: {},
      isQuestLogVisible: false,
      townState: null,
      townEntryDirection: null,
      activeRumors: [],
      worldHistory: undefined,
      activeHeist: null,
      activeContracts: [],
      playerIdentity: undefined,
      legacy: undefined,
      strongholds: {},
      activeRitual: null,
      underdark: { currentDepth: 0, currentBiomeId: 'cavern', lightLevel: 'dim', activeLightSources: [], faerzressLevel: 0, wildMagicChance: 0, sanity: { current: 100, max: 100, madnessLevel: 0 } },
      activeConversation: null
    } as any;

    it('should return true if requirement is met (item)', () => {
      const portal: Portal = {
        id: 'p1',
        originLocationId: 'loc1',
        destinationPlaneId: 'feywild',
        activationRequirements: [{ type: 'item', value: 'Moonstone Key', description: 'Need key' }],
        stability: 'permanent',
        isActive: false
      };

      expect(canActivatePortal(portal, mockGameState)).toBe(true);
    });

    it('should return false if requirement is not met (missing item)', () => {
      const portal: Portal = {
        id: 'p1',
        originLocationId: 'loc1',
        destinationPlaneId: 'feywild',
        activationRequirements: [{ type: 'item', value: 'Sunstone Key', description: 'Need key' }],
        stability: 'permanent',
        isActive: false
      };

      expect(canActivatePortal(portal, mockGameState)).toBe(false);
    });
  });
});
