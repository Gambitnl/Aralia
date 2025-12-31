import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as SaveLoadService from '../saveLoadService';
// TODO(lint-intent): 'NotificationType' is unused in this test; use it in the assertion path or remove it.
import { GameState, GamePhase, NotificationType as _NotificationType } from '../../types';
// TODO(lint-intent): 'simpleHash' is unused in this test; use it in the assertion path or remove it.
import { simpleHash as _simpleHash } from '../../utils/hashUtils';

// Mock NotificationSystem callback
const mockNotify = vi.fn();

// Sample GameState for testing
const mockGameState: GameState = {
    phase: GamePhase.PLAYING,
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    party: [{ id: 'char1', name: 'Hero', level: 5 } as unknown],
    tempParty: null,
    inventory: [],
    gold: 100,
    currentLocationId: 'town_square',
    subMapCoordinates: { x: 10, y: 10 },
    messages: [],
    isLoading: false,
    loadingMessage: null,
    isImageLoading: false,
    error: null,
    worldSeed: 12345,
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
    gameTime: new Date('2024-01-01T12:00:00Z'),
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
    saveVersion: '0.1.0',
    saveTimestamp: Date.now(),
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
    questLog: [],
    isQuestLogVisible: false,
    notifications: []
};

describe('SaveLoadService', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
        // Reset internal cache by refreshing
        SaveLoadService.refreshSaveSlotIndex();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('saveGame', () => {
        it('should save game state to localStorage with correct key', async () => {
            const result = await SaveLoadService.saveGame(mockGameState, 'slot_1', mockNotify);

            expect(result.success).toBe(true);
            expect(localStorage.getItem('aralia_rpg_slot_slot_1')).not.toBeNull();
            expect(mockNotify).toHaveBeenCalledWith({ message: "Game saved successfully.", type: 'success' });
        });

        it('should save metadata index correctly', async () => {
            await SaveLoadService.saveGame(mockGameState, 'slot_1');
            const slots = SaveLoadService.getSaveSlots();

            expect(slots).toHaveLength(1);
            expect(slots[0].slotId).toBe('aralia_rpg_slot_slot_1');
            expect(slots[0].slotName).toBe('slot_1');
            expect(slots[0].partyLevel).toBe(5);
        });

        it('should handle QuotaExceededError', async () => {
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            setItemSpy.mockImplementation(() => {
                const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
                Object.defineProperty(error, 'code', { value: 22 });
                throw error;
            });

            const result = await SaveLoadService.saveGame(mockGameState, 'slot_big', mockNotify);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Local storage is full');
            expect(mockNotify).toHaveBeenCalledWith({ message: expect.stringContaining('Local storage is full'), type: 'error' });
        });

        it('should handle general save errors', async () => {
             const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
             setItemSpy.mockImplementation(() => { throw new Error('Random write error'); });

             const result = await SaveLoadService.saveGame(mockGameState, 'slot_error', mockNotify);
             expect(result.success).toBe(false);
             expect(result.message).toContain('Failed to save game');
        });
    });

    describe('loadGame', () => {
        it('should load saved game successfully', async () => {
            await SaveLoadService.saveGame(mockGameState, 'slot_1');
            const result = await SaveLoadService.loadGame('slot_1', mockNotify);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.gold).toBe(100);
            expect(result.data?.gameTime).toBeInstanceOf(Date);
            expect(mockNotify).toHaveBeenCalledWith({ message: "Game loaded successfully.", type: 'success' });
        });

        it('should return failure if save does not exist', async () => {
            const result = await SaveLoadService.loadGame('non_existent', mockNotify);

            expect(result.success).toBe(false);
            expect(result.message).toBe("No save game found.");
            expect(mockNotify).toHaveBeenCalledWith({ message: "No save game found.", type: 'info' });
        });

        it('should handle corrupted JSON', async () => {
            localStorage.setItem('aralia_rpg_slot_corrupt', '{ invalid json ');
            const result = await SaveLoadService.loadGame('corrupt', mockNotify);

            expect(result.success).toBe(false);
            expect(result.message).toContain("corrupted");
            expect(mockNotify).toHaveBeenCalledWith({ message: expect.stringContaining("corrupted"), type: 'error' });
        });

        it('should handle version mismatch', async () => {
            const oldState = { ...mockGameState, saveVersion: '0.0.1' };
            // Manually write old state wrapped in payload structure
            const key = SaveLoadService.getSlotStorageKey('old_version');
            localStorage.setItem(key, JSON.stringify({
                version: '0.0.1',
                slotId: key,
                state: oldState
            }));

            const result = await SaveLoadService.loadGame('old_version', mockNotify);

            expect(result.success).toBe(false);
            expect(result.message).toContain("incompatible");
            expect(mockNotify).toHaveBeenCalledWith({ message: expect.stringContaining("incompatible"), type: 'warning' });
        });

        it('should detect checksum mismatch', async () => {
             await SaveLoadService.saveGame(mockGameState, 'checksum_test');
             const key = SaveLoadService.getSlotStorageKey('checksum_test');

             // Read the valid save
             const raw = localStorage.getItem(key);
             const payload = JSON.parse(raw!);

             // Mutate the state but keep the checksum original
             payload.state.gold = 999999;

             // Write back the corrupted payload
             localStorage.setItem(key, JSON.stringify(payload));

             const result = await SaveLoadService.loadGame('checksum_test', mockNotify);

             expect(result.success).toBe(false);
             expect(result.message).toContain("integrity check failed");
             expect(mockNotify).toHaveBeenCalledWith({ message: expect.stringContaining("integrity check failed"), type: 'error' });
        });
    });

    describe('getSaveSlots', () => {
        it('should return empty array when no saves exist', () => {
            const slots = SaveLoadService.getSaveSlots();
            expect(slots).toEqual([]);
        });

        it('should retrieve multiple slots sorted by date', async () => {
             // Save slot 1
             // TODO(lint-intent): 'state1' is unused in this test; use it in the assertion path or remove it.
             const _state1 = { ...mockGameState, saveTimestamp: 1000 };
             // Use mock timers to ensure distinct timestamps if needed,
             // but here we are setting saveTimestamp manually in the state object passed to internal logic?
             // Actually saveGame overwrites saveTimestamp with Date.now().
             // So we rely on execution order.

             vi.useFakeTimers();
             vi.setSystemTime(new Date(2024, 1, 1, 10, 0, 0));
             await SaveLoadService.saveGame(mockGameState, 'slot_early');

             vi.setSystemTime(new Date(2024, 1, 1, 12, 0, 0));
             await SaveLoadService.saveGame(mockGameState, 'slot_late');

             const slots = SaveLoadService.getSaveSlots();
             expect(slots).toHaveLength(2);
             expect(slots[0].slotName).toBe('slot_late');
             expect(slots[1].slotName).toBe('slot_early');

             vi.useRealTimers();
        });
    });

    describe('deleteSaveGame', () => {
        it('should remove save data and metadata', async () => {
            await SaveLoadService.saveGame(mockGameState, 'slot_delete');
            expect(SaveLoadService.hasSaveGame('slot_delete')).toBe(true);

            SaveLoadService.deleteSaveGame('slot_delete');

            expect(SaveLoadService.hasSaveGame('slot_delete')).toBe(false);
            expect(SaveLoadService.getSaveSlots()).toHaveLength(0);
        });
    });

    describe('hasSaveGame', () => {
        it('should return true if save exists', async () => {
            await SaveLoadService.saveGame(mockGameState, 'slot_exist');
            expect(SaveLoadService.hasSaveGame('slot_exist')).toBe(true);
        });

        it('should return false if save does not exist', () => {
            expect(SaveLoadService.hasSaveGame('ghost_slot')).toBe(false);
        });
    });
});
