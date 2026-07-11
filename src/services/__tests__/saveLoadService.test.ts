import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as SaveLoadService from '../saveLoadService';
import * as IDBStorage from '../indexedDBStorageService';
import { GameState, GamePhase, DiscoveryEntry, DiscoveryType } from '../../types';

import { migrateMapDataToWorldDataV2 } from '@/state/migrations/worldDataMigration';
import type { WorldDelta } from '../../systems/worldforge/delta/types';
import { MAX_DISCOVERY_LOG_ENTRIES } from '../../state/reducers/logReducer';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// IndexedDB is mocked with an in-memory store so the localStorage -> IndexedDB
// migration flow (initializeStorage / MIGRATION_FLAG_KEY) can be exercised in
// jsdom, which ships no real IndexedDB. The existing tests never trigger this
// path — `idbAvailable` stays false until `initializeStorage()` runs, and only
// the G5 "migration flow" describe below calls it — so they are unaffected by
// this mock.
// ---------------------------------------------------------------------------
vi.mock('../indexedDBStorageService', () => {
    const store = new Map<string, string>();
    return {
        isAvailable: vi.fn(async () => true),
        putSave: vi.fn(async (slotId: string, data: string) => { store.set(slotId, data); }),
        getSave: vi.fn(async (slotId: string) => (store.has(slotId) ? store.get(slotId)! : null)),
        deleteSave: vi.fn(async (slotId: string) => { store.delete(slotId); }),
        getAllKeys: vi.fn(async () => Array.from(store.keys())),
        clearAllSaves: vi.fn(async () => { store.clear(); }),
        closeDB: vi.fn(() => {}),
        resetAvailabilityCache: vi.fn(() => {}),
    };
});

// Internal saveLoadService storage keys, mirrored here so the G5 tests can
// assert on the durable migration/emergency/slot-index localStorage entries.
// (They are module-private constants in saveLoadService.ts.)
const MIGRATION_FLAG_KEY = 'aralia_rpg_migrated_to_idb';
const EMERGENCY_SAVE_KEY = 'aralia_rpg_emergency_save';
const SLOT_INDEX_KEY = 'aralia_rpg_save_slots_index';

// Mock NotificationSystem callback
const mockNotify = vi.fn();

// Sample GameState for testing
const mockGameState: GameState = {
    phase: GamePhase.PLAYING,
    party: [{ id: 'char1', name: 'Hero', level: 5 }],
    tempParty: null,
    inventory: [],
    gold: 100,
    currentLocationId: 'town_square',
    messages: [],
    isLoading: false,
    loadingMessage: null,
    isImageLoading: false,
    error: null,
    worldSeed: 12345,
    mapData: null,
    isMapVisible: false,
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
} as unknown as GameState;

// ============================================================================
// Worldforge Save Fixtures
// ============================================================================
// These fixtures are intentionally plain JSON-safe objects. They prove the save
// service can carry Worldforge's durable edit log without importing generation
// code or applying special serializer behavior.
// ============================================================================

const createWorldforgeDelta = (id: string, sequence: number): WorldDelta => ({
    id,
    schemaVersion: 1,
    opVersion: 1,
    artifactSeedPath: 'wf:456/cell:save/village:test',
    entityKey: `plot:${sequence}`,
    sequence,
    operation: {
        kind: 'modify-plot',
        plotId: sequence,
        role: sequence === 1 ? 'market' : 'home',
        storeys: sequence + 1,
    },
});

// ============================================================================
// Discovery Log Save Fixtures
// ============================================================================
// Save/load tests need complete discovery entries so the loaded Logbook can be
// checked the same way the player-facing reducer stores it during play.
// ============================================================================

const createDiscoveryEntry = (id: string, overrides: Partial<DiscoveryEntry> = {}): DiscoveryEntry => ({
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
});

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
            expect(result.message).toContain('Storage is full');
            expect(mockNotify).toHaveBeenCalledWith({ message: expect.stringContaining('Storage is full'), type: 'error' });
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

        it('migrateMapDataToWorldDataV2 backfills worldData when applied to a v1 mapData', () => {
            const cols = 6;
            const rows = 4;
            const legacyMap = {
                gridSize: { rows, cols },
                tiles: new Array(rows).fill(0).map((_, y) =>
                    new Array(cols).fill(0).map((__, x) => ({
                        x, y, biomeId: 'plains', discovered: false, isPlayerCurrent: false,
                    })),
                ),
                azgaarWorld: {
                    version: 1 as const,
                    templateId: 'continents',
                    heights: new Array(cols * rows).fill(30),
                    temperatures: new Array(cols * rows).fill(15),
                    moisture: new Array(cols * rows).fill(20),
                    rivers: new Array(cols * rows).fill(false),
                },
            };
            const migrated = migrateMapDataToWorldDataV2(legacyMap as any, 42);
            expect(migrated.worldData?.version).toBe(2);
        });

        // Grid retirement: loadGame no longer backfills mapData.worldData — saves
        // don't carry a world grid anymore (the world is the atlas from worldSeed).
        // The migration fn itself is still covered by the direct-call test above.

        // The loader should keep older saves bootable even when they predate the
        // first-build history payload; the new field should land as an empty shell.
        it('backfills an empty worldHistory for legacy saves that predate first-build attachment', async () => {
            await SaveLoadService.saveGame(mockGameState, 'legacy_history_slot');

            const result = await SaveLoadService.loadGame('legacy_history_slot');

            expect(result.success).toBe(true);
            expect(result.data?.worldHistory).toEqual({ events: [] });
        });

        it('round-trips worldforgeDeltas and playerGroundPos byte-equal through the real save service path', async () => {
            const worldforgeDeltas = [
                createWorldforgeDelta('wf-save-1', 1),
                createWorldforgeDelta('wf-save-2', 2),
            ];
            const playerGroundPos = { tileX: 44, tileY: 18, xM: 321.25, zM: 654.5 };
            const stateWithDeltas = {
                ...mockGameState,
                worldforgeDeltas,
                playerGroundPos,
            };

            await SaveLoadService.saveGame(stateWithDeltas, 'worldforge_delta_slot');
            const result = await SaveLoadService.loadGame('worldforge_delta_slot');

            expect(result.success).toBe(true);
            expect(JSON.stringify(result.data?.worldforgeDeltas)).toBe(JSON.stringify(worldforgeDeltas));
            expect(JSON.stringify(result.data?.playerGroundPos)).toBe(JSON.stringify(playerGroundPos));
        });

        it('round-trips open player-facing overlays (map/journal) so resume reopens them', async () => {
            const stateWithOverlays = {
                ...mockGameState,
                isMapVisible: false,
                isDiscoveryLogVisible: true,
            };
            await SaveLoadService.saveGame(stateWithOverlays as GameState, 'overlay_open_slot');

            const result = await SaveLoadService.loadGame('overlay_open_slot');

            expect(result.success).toBe(true);
            expect(result.data?.isMapVisible).toBe(false);
            expect(result.data?.isDiscoveryLogVisible).toBe(true);
        });

        it('still forces dev/debug surfaces closed across save+load', async () => {
            const stateWithDevSurfaces = {
                ...mockGameState,
                isDevMenuVisible: true,
                isGeminiLogViewerVisible: true,
                characterSheetModal: { isOpen: true, character: null },
            };
            await SaveLoadService.saveGame(stateWithDevSurfaces as GameState, 'dev_surfaces_slot');

            const result = await SaveLoadService.loadGame('dev_surfaces_slot');

            expect(result.success).toBe(true);
            expect(result.data?.isDevMenuVisible).toBe(false);
            expect(result.data?.isGeminiLogViewerVisible).toBe(false);
            expect(result.data?.characterSheetModal?.isOpen).toBe(false);
        });

        it('heals non-boolean overlay flags from hand-edited or legacy saves to closed', async () => {
            await SaveLoadService.saveGame(mockGameState, 'overlay_heal_slot');
            const key = SaveLoadService.getSlotStorageKey('overlay_heal_slot');
            const payload = JSON.parse(localStorage.getItem(key)!);
            payload.state.isMapVisible = 1;
            delete payload.state.isDiscoveryLogVisible;
            delete payload.checksum; // hand-edit scenario: checksum intentionally absent
            localStorage.setItem(key, JSON.stringify(payload));

            const result = await SaveLoadService.loadGame('overlay_heal_slot');

            expect(result.success).toBe(true);
            expect(result.data?.isMapVisible).toBe(false);
            expect(result.data?.isDiscoveryLogVisible).toBe(false);
        });

        it('heals a save written mid-combat back to PLAYING and announces the pre-combat checkpoint', async () => {
            const combatState = { ...mockGameState, phase: GamePhase.COMBAT };
            await SaveLoadService.saveGame(combatState as GameState, 'combat_checkpoint_slot');

            const result = await SaveLoadService.loadGame('combat_checkpoint_slot', mockNotify);

            expect(result.success).toBe(true);
            expect(result.data?.phase).toBe(GamePhase.PLAYING);
            expect(mockNotify).toHaveBeenCalledWith({
                message: 'Resumed from pre-combat checkpoint.',
                type: 'info',
            });
        });

        it('round-trips a cleared playerGroundPos through the real save service path', async () => {
            const stateWithClearedGroundPosition = {
                ...mockGameState,
                playerGroundPos: null,
            };

            // Null is meaningful because it clears stale ground camera anchors
            // without implying the player has a tile-local resume point.
            await SaveLoadService.saveGame(stateWithClearedGroundPosition, 'ground_position_null_slot');
            const result = await SaveLoadService.loadGame('ground_position_null_slot');

            expect(result.success).toBe(true);
            expect(result.data?.playerGroundPos).toBeNull();
        });

        it('prunes oversized legacy discovery logs on load and keeps unread count tied to retained entries', async () => {
            // Older saves can already contain more discoveries than the new
            // runtime cap. Loading should keep the newest player-visible rows
            // and make the badge match only those retained rows.
            const oversizedDiscoveryLog = Array.from({ length: MAX_DISCOVERY_LOG_ENTRIES + 5 }, (_, index) =>
                createDiscoveryEntry(`legacy-discovery-${index}`, {
                    isRead: index % 3 === 0,
                })
            );
            const legacyState = {
                ...mockGameState,
                discoveryLog: oversizedDiscoveryLog,
                unreadDiscoveryCount: oversizedDiscoveryLog.filter(entry => !entry.isRead).length,
            };
            const key = SaveLoadService.getSlotStorageKey('legacy_discovery_log_slot');

            localStorage.setItem(key, JSON.stringify({
                version: '0.1.0',
                slotId: key,
                slotName: 'legacy_discovery_log_slot',
                state: legacyState,
            }));

            const result = await SaveLoadService.loadGame('legacy_discovery_log_slot');

            expect(result.success).toBe(true);
            expect(result.data?.discoveryLog).toHaveLength(MAX_DISCOVERY_LOG_ENTRIES);
            expect(result.data?.discoveryLog[0]?.id).toBe('legacy-discovery-0');
            expect(result.data?.unreadDiscoveryCount).toBe(result.data?.discoveryLog.filter(entry => !entry.isRead).length);
        });

        // --------------------------------------------------------------------
        // G5: versioned-migration coverage across mixed / older payload shapes.
        // SAVE_GAME_VERSION is '0.1.0'; the loader keys compatibility off the
        // *inner* state.saveVersion, so these cases pin that contract down.
        // --------------------------------------------------------------------

        it('rejects a save whose version is newer than the current save format', async () => {
            // Version mismatch is symmetric: a future save is as incompatible as
            // an ancient one. Existing coverage only exercised the older side.
            const key = SaveLoadService.getSlotStorageKey('future_version');
            localStorage.setItem(key, JSON.stringify({
                version: '9.9.9',
                slotId: key,
                state: { ...mockGameState, saveVersion: '9.9.9' },
            }));

            const result = await SaveLoadService.loadGame('future_version', mockNotify);

            expect(result.success).toBe(false);
            expect(result.message).toContain('incompatible');
            expect(result.message).toContain('9.9.9');
            expect(mockNotify).toHaveBeenCalledWith({ message: expect.stringContaining('incompatible'), type: 'warning' });
        });

        it('loads a legacy save that predates version stamping (no saveVersion field)', async () => {
            // Pre-versioning payloads carry no saveVersion; the guard is
            // `if (loadedState.saveVersion && ...)`, so these must still boot.
            const key = SaveLoadService.getSlotStorageKey('unversioned_legacy');
            const { saveVersion: _dropped, ...legacyState } = mockGameState as any;
            localStorage.setItem(key, JSON.stringify({ slotId: key, state: legacyState }));

            const result = await SaveLoadService.loadGame('unversioned_legacy');

            expect(result.success).toBe(true);
            expect(result.data?.gold).toBe(100);
        });

        it('keys the compatibility check off the inner state version, not the wrapper version', async () => {
            // Mixed payload: current wrapper version but an older embedded state.
            // The embedded state is authoritative, so this must be rejected.
            const key = SaveLoadService.getSlotStorageKey('mixed_version');
            localStorage.setItem(key, JSON.stringify({
                version: '0.1.0',
                slotId: key,
                state: { ...mockGameState, saveVersion: '0.0.9' },
            }));

            const result = await SaveLoadService.loadGame('mixed_version', mockNotify);

            expect(result.success).toBe(false);
            expect(result.message).toContain('0.0.9');
        });

        it('loads a legacy bare GameState payload that has no StoredSavePayload wrapper', async () => {
            // The earliest single-slot saves wrote the GameState directly, with
            // no { version, slotId, state } envelope. loadGame falls back to
            // treating the parsed object itself as the state.
            const key = SaveLoadService.getSlotStorageKey('bare_state_legacy');
            localStorage.setItem(key, JSON.stringify({ ...mockGameState }));

            const result = await SaveLoadService.loadGame('bare_state_legacy');

            expect(result.success).toBe(true);
            expect(result.data?.gold).toBe(100);
        });

        // --------------------------------------------------------------------
        // G5: migratePlayerCell backfill across pre-cell-native saves.
        // --------------------------------------------------------------------

        it('backfills playerCell from a cell_<id> location on saves that predate the cell-native field', async () => {
            const key = SaveLoadService.getSlotStorageKey('cell_native_slot');
            const legacyState = { ...mockGameState, currentLocationId: 'cell_137' };
            delete (legacyState as any).playerCell;
            localStorage.setItem(key, JSON.stringify({ version: '0.1.0', slotId: key, state: legacyState }));

            const result = await SaveLoadService.loadGame('cell_native_slot');

            expect(result.success).toBe(true);
            expect(result.data?.playerCell).toEqual({ cellId: 137, localeCoords: null });
        });

        it('leaves an already-present playerCell untouched on load (idempotent migration)', async () => {
            const key = SaveLoadService.getSlotStorageKey('cell_present_slot');
            const state = { ...mockGameState, currentLocationId: 'cell_5', playerCell: { cellId: 999, localeCoords: null } };
            localStorage.setItem(key, JSON.stringify({ version: '0.1.0', slotId: key, state }));

            const result = await SaveLoadService.loadGame('cell_present_slot');

            expect(result.success).toBe(true);
            // Migration must NOT re-derive to cell 5 — the stored cell wins.
            expect(result.data?.playerCell).toEqual({ cellId: 999, localeCoords: null });
        });

        it('resolves playerCell to null when the save has no world seed to anchor into', async () => {
            const key = SaveLoadService.getSlotStorageKey('no_seed_slot');
            const state = { ...mockGameState, currentLocationId: 'town_square' };
            delete (state as any).playerCell;
            delete (state as any).worldSeed;
            localStorage.setItem(key, JSON.stringify({ version: '0.1.0', slotId: key, state }));

            const result = await SaveLoadService.loadGame('no_seed_slot');

            expect(result.success).toBe(true);
            expect(result.data?.playerCell).toBeNull();
        });
    });

    describe('getSaveSlots', () => {
        it('should return empty array when no saves exist', () => {
            const slots = SaveLoadService.getSaveSlots();
            expect(slots).toEqual([]);
        });

        it('should retrieve multiple slots sorted by date', async () => {
             // Save slot 1
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

    it('migrateMapDataToWorldDataV2 backfills worldData when applied to a v1 mapData', () => {
      const cols = 6;
      const rows = 4;
      const legacyMap = {
        gridSize: { rows, cols },
        tiles: new Array(rows).fill(0).map((_, y) =>
          new Array(cols).fill(0).map((__, x) => ({
            x, y, biomeId: 'plains', discovered: false, isPlayerCurrent: false,
          })),
        ),
        azgaarWorld: {
          version: 1 as const,
          templateId: 'continents',
          heights: new Array(cols * rows).fill(30),
          temperatures: new Array(cols * rows).fill(15),
          moisture: new Array(cols * rows).fill(20),
          rivers: new Array(cols * rows).fill(false),
        },
      };
      const migrated = migrateMapDataToWorldDataV2(legacyMap as any, 42);
      expect(migrated.worldData?.version).toBe(2);
    });

    // ------------------------------------------------------------------------
    // G5: anomalous slot-metadata index handling (localStorage-only mode).
    // getSaveSlots must never throw on malformed/ghost/orphaned metadata; it
    // heals to a best-effort list instead.
    // ------------------------------------------------------------------------
    describe('slot metadata anomalies (G5)', () => {
        it('recovers to an empty slot list when the persisted slot index is malformed JSON', () => {
            localStorage.setItem(SLOT_INDEX_KEY, '{ not valid json');

            // refreshSaveSlotIndex clears the in-memory + session caches so the
            // malformed localStorage value is actually re-parsed.
            const slots = SaveLoadService.refreshSaveSlotIndex();

            expect(slots).toEqual([]);
        });

        it('drops ghost slot-index entries whose payload no longer exists', () => {
            // Index references a slot, but no matching payload key was written.
            localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify([
                { slotId: 'aralia_rpg_slot_ghost', slotName: 'Ghost', lastSaved: 123 },
            ]));

            const slots = SaveLoadService.refreshSaveSlotIndex();

            expect(slots.find(slot => slot.slotId === 'aralia_rpg_slot_ghost')).toBeUndefined();
        });

        it('merges an orphaned slot payload that is missing from the metadata index', () => {
            // Payload exists on disk but the index never recorded it (interrupted
            // write, imported backup). mergeWithLegacySaves must surface it.
            const key = 'aralia_rpg_slot_orphan';
            localStorage.setItem(key, JSON.stringify({
                version: '0.1.0',
                slotId: key,
                slotName: 'Orphan Save',
                preview: { locationName: 'town_square', partyLevel: 5 },
                state: { ...mockGameState },
            }));

            const slots = SaveLoadService.refreshSaveSlotIndex();

            const orphan = slots.find(slot => slot.slotId === key);
            expect(orphan).toBeDefined();
            expect(orphan?.slotName).toBe('Orphan Save');
            expect(orphan?.partyLevel).toBe(5);
        });
    });

    // ------------------------------------------------------------------------
    // G5: localStorage -> IndexedDB migration flow (MIGRATION_FLAG_KEY).
    // Runs LAST because initializeStorage() flips the module-level idbAvailable
    // to true (via the mocked isAvailable); keeping it last avoids leaking that
    // state into the localStorage-only tests above.
    // ------------------------------------------------------------------------
    describe('localStorage -> IndexedDB migration flow (G5)', () => {
        beforeEach(async () => {
            // Reset the in-memory IndexedDB mock between migration cases.
            await (IDBStorage.clearAllSaves as any)();
        });

        it('migrates orphaned localStorage save payloads into IndexedDB and stamps the migration flag', async () => {
            const legacyKey = 'aralia_rpg_slot_pre_migration';
            const payload = JSON.stringify({
                version: '0.1.0',
                slotId: legacyKey,
                slotName: 'Legacy',
                state: { ...mockGameState },
            });
            localStorage.setItem(legacyKey, payload);

            await SaveLoadService.initializeStorage();

            expect(SaveLoadService.isUsingIndexedDB()).toBe(true);
            // Payload moved OUT of localStorage...
            expect(localStorage.getItem(legacyKey)).toBeNull();
            // ...and INTO IndexedDB...
            expect(await IDBStorage.getSave(legacyKey)).toBe(payload);
            expect(IDBStorage.putSave).toHaveBeenCalledWith(legacyKey, payload);
            // ...with the one-time flag set so migration never re-runs.
            expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('true');
        });

        it('does not re-migrate localStorage saves once the migration flag is already set', async () => {
            const keepKey = 'aralia_rpg_slot_keep_in_ls';
            const payload = JSON.stringify({
                version: '0.1.0',
                slotId: keepKey,
                slotName: 'Keep',
                state: { ...mockGameState },
            });
            localStorage.setItem(keepKey, payload);
            localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

            await SaveLoadService.initializeStorage();

            // Flag short-circuits migration: the payload stays put and nothing
            // is written to IndexedDB.
            expect(localStorage.getItem(keepKey)).toBe(payload);
            expect(IDBStorage.putSave).not.toHaveBeenCalled();
        });

        it('recovers a synchronous emergency save into IndexedDB on the next startup', async () => {
            const emergencyPayload = JSON.stringify({
                version: '0.1.0',
                slotId: 'aralia_rpg_autosave',
                slotName: 'Auto-Save',
                state: { ...mockGameState },
            });
            localStorage.setItem(EMERGENCY_SAVE_KEY, emergencyPayload);

            await SaveLoadService.initializeStorage();

            // The emergency blob is relocated into IndexedDB under its slotId and
            // cleared from localStorage.
            expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBeNull();
            expect(await IDBStorage.getSave('aralia_rpg_autosave')).toBe(emergencyPayload);
        });

        // ====================================================================
        // IndexedDB-First Runtime Contract
        // ====================================================================
        // Migration proves old saves can move, but ordinary play also needs to
        // prove that new writes, reads, fallback recovery, corruption handling,
        // and deletion all honor the initialized storage mode.
        // ====================================================================

        it('writes new save payloads to IndexedDB while keeping only preview metadata local', async () => {
            await SaveLoadService.initializeStorage();

            const result = await SaveLoadService.saveGame(mockGameState, 'idb_primary');
            const storageKey = 'aralia_rpg_slot_idb_primary';

            expect(result.success).toBe(true);
            expect(IDBStorage.putSave).toHaveBeenCalledWith(storageKey, expect.any(String));
            expect(await IDBStorage.getSave(storageKey)).not.toBeNull();
            expect(localStorage.getItem(storageKey)).toBeNull();
            expect(SaveLoadService.getSaveSlots()).toEqual(expect.arrayContaining([
                expect.objectContaining({ slotId: storageKey, partyLevel: 5 }),
            ]));
        });

        it('prefers the IndexedDB payload when stale localStorage data shares the slot key', async () => {
            const logSpy = vi.spyOn(logger, 'info');
            await SaveLoadService.initializeStorage();
            const storageKey = 'aralia_rpg_slot_idb_precedence';
            await SaveLoadService.saveGame(mockGameState, 'idb_precedence');

            // A malformed legacy copy would fail checksum/JSON validation if the
            // loader accidentally consulted localStorage before the primary store.
            localStorage.setItem(storageKey, '{ stale local copy');
            const result = await SaveLoadService.loadGame('idb_precedence');

            expect(result.success).toBe(true);
            expect(result.data?.gold).toBe(100);
            expect(IDBStorage.getSave).toHaveBeenCalledWith(storageKey);
            expect(logSpy).toHaveBeenCalledWith('Game loaded', expect.objectContaining({ storage: 'IndexedDB' }));
        });

        it('falls back to a valid localStorage payload when IndexedDB has no matching record', async () => {
            const logSpy = vi.spyOn(logger, 'info');
            await SaveLoadService.initializeStorage();
            const storageKey = 'aralia_rpg_slot_idb_fallback';
            await SaveLoadService.saveGame(mockGameState, 'idb_fallback');
            const validPayload = await IDBStorage.getSave(storageKey);
            expect(validPayload).not.toBeNull();

            // Simulate a browser where metadata/legacy payload survived but the
            // corresponding IndexedDB record was cleared or never migrated.
            await IDBStorage.deleteSave(storageKey);
            localStorage.setItem(storageKey, validPayload!);
            const result = await SaveLoadService.loadGame('idb_fallback');

            expect(result.success).toBe(true);
            expect(result.data?.gold).toBe(100);
            expect(logSpy).toHaveBeenCalledWith('Game loaded', expect.objectContaining({ storage: 'localStorage' }));
        });

        it('rejects corrupted JSON read from the primary IndexedDB store', async () => {
            await SaveLoadService.initializeStorage();
            const storageKey = 'aralia_rpg_slot_idb_corrupt';
            await IDBStorage.putSave(storageKey, '{ invalid indexeddb json');

            const result = await SaveLoadService.loadGame('idb_corrupt');

            expect(result.success).toBe(false);
            expect(result.message).toContain('corrupted');
        });

        it('deletes the same slot from IndexedDB, local fallback storage, and metadata', async () => {
            await SaveLoadService.initializeStorage();
            const storageKey = 'aralia_rpg_slot_idb_delete';
            await SaveLoadService.saveGame(mockGameState, 'idb_delete');
            const payload = await IDBStorage.getSave(storageKey);
            localStorage.setItem(storageKey, payload!);

            await SaveLoadService.deleteSaveGame('idb_delete');

            expect(IDBStorage.deleteSave).toHaveBeenCalledWith(storageKey);
            expect(await IDBStorage.getSave(storageKey)).toBeNull();
            expect(localStorage.getItem(storageKey)).toBeNull();
            expect(SaveLoadService.getSaveSlots().some(slot => slot.slotId === storageKey)).toBe(false);
        });
    });
});
