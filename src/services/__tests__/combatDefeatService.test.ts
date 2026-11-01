/** Uses the real save codec; only IndexedDB's disposable browser backend is replaced. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GamePhase } from '../../types/core';
import { createMockGameState, createMockPlayerCharacter, createMockSpellSlots } from '../../utils/core/factories';
import * as SaveLoadService from '../saveLoadService';
import * as IDBStorage from '../indexedDBStorageService';
import { setIndexedDbAvailable } from '../saveLoad/saveLoadHelpers';
import { writeEmergencySnapshot } from '../saveLoad/emergencySnapshot';
import { DEFEAT_SLOT_PREFIX, loadDefeatChronicle, saveDefeatChronicle } from '../combatDefeatService';

const backend = vi.hoisted(() => ({ records: new Map<string, string>() }));
vi.mock('../indexedDBStorageService', () => ({
  isAvailable: vi.fn(async () => true),
  putSave: vi.fn(async (id: string, data: string) => { backend.records.set(id, data); }),
  getSave: vi.fn(async (id: string) => backend.records.get(id) ?? null),
  deleteSave: vi.fn(async (id: string) => { backend.records.delete(id); }),
  getAllKeys: vi.fn(async () => [...backend.records.keys()]),
  clearAllSaves: vi.fn(async () => { backend.records.clear(); }),
  closeDB: vi.fn(), resetAvailabilityCache: vi.fn(),
}));

const slot = `${DEFEAT_SLOT_PREFIX}test_record`;
function defeatedState() {
  const hero = createMockPlayerCharacter({ id: 'hero', name: 'Hero', hp: 0, maxHp: 10,
    spellSlots: createMockSpellSlots({ level_1: { current: 0, max: 2 } }),
    limitedUses: { second_wind: { name: 'Second Wind', current: 0, max: 1, resetOn: 'short_rest' } },
  });
  return createMockGameState({ phase: GamePhase.GAME_OVER, party: [hero], gold: 22,
    worldSeed: 42, currentLocationId: 'cell_123', playerCell: { cellId: 123, localeCoords: null },
    playerGroundPos: { tileX: 123, tileY: 0, xM: 12, zM: 5, yM: 3 },
    lastCombatOutcome: { result: 'defeat', worldSeed: 42, currentLocationId: 'cell_123',
      gameTime: '0351-01-01T12:00:00.000Z',
      party: [{ id: 'hero', name: 'Hero', currentHP: 0, maxHP: 10,
        deathSaves: { successes: 0, failures: 3 } }],
      enemies: [{ id: 'ghoul', name: 'Ghoul', currentHP: 22, maxHP: 22 }],
      events: [{ id: 'hit', type: 'damage', timestamp: 1, message: 'Massive damage kills Hero at 0 HP.' }],
    },
  });
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); backend.records.clear();
  window.history.replaceState({}, '', '/Aralia/?phase=game_over');
  vi.clearAllMocks();
  vi.mocked(IDBStorage.putSave).mockReset().mockImplementation(async (id, data) => { backend.records.set(id, data); });
  setIndexedDbAvailable(true);
  SaveLoadService.refreshSaveSlotIndex();
});

describe('dedicated defeat Chronicles', () => {
  it('round-trips fate and source while leaving both manual and rolling recovery bytes untouched', async () => {
    const state = defeatedState();
    const recovery = { ...state, phase: GamePhase.PLAYING,
      party: state.party.map(member => ({ ...member, hp: 10 })), lastCombatOutcome: undefined };
    await SaveLoadService.saveGame(recovery);
    await SaveLoadService.saveGame(recovery, SaveLoadService.AUTO_SAVE_SLOT_KEY, undefined, { isAutoSave: true });
    const manual = backend.records.get(SaveLoadService.DEFAULT_SAVE_SLOT_KEY);
    const rolling = backend.records.get(SaveLoadService.AUTO_SAVE_SLOT_KEY);
    expect((await saveDefeatChronicle(state, slot)).success).toBe(true);
    const loaded = await loadDefeatChronicle(slot);
    expect(loaded.success).toBe(true);
    expect(loaded.data?.phase).toBe(GamePhase.GAME_OVER);
    expect(loaded.data?.party[0].hp).toBe(0);
    expect(loaded.data?.lastCombatOutcome).toEqual({ ...state.lastCombatOutcome, chronicleSlotId: slot });
    expect(loaded.data?.playerGroundPos).toEqual(state.playerGroundPos);
    expect(loaded.data?.gold).toBe(22);
    expect(loaded.data?.party[0].spellSlots).toEqual(state.party[0].spellSlots);
    expect(loaded.data?.party[0].limitedUses).toEqual(state.party[0].limitedUses);
    expect(backend.records.get(SaveLoadService.DEFAULT_SAVE_SLOT_KEY)).toBe(manual);
    expect(backend.records.get(SaveLoadService.AUTO_SAVE_SLOT_KEY)).toBe(rolling);
    expect(localStorage.getItem(slot)).toBeNull();
  });

  it('has a loadable exact fallback before a pending IndexedDB write completes', async () => {
    let release: (() => void) | undefined;
    vi.mocked(IDBStorage.putSave).mockImplementationOnce((id, data) => new Promise(resolve => {
      release = () => { backend.records.set(id, data); resolve(); };
    }));
    const saving = saveDefeatChronicle(defeatedState(), slot);
    const backup = JSON.parse(localStorage.getItem(slot)!);
    expect(backup.state.phase).toBe(GamePhase.GAME_OVER);
    expect(backup.state.lastCombatOutcome.chronicleSlotId).toBe(slot);
    expect(new URLSearchParams(window.location.search).get('defeat')).toBe(slot);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const recovered = await loadDefeatChronicle(slot);
    expect(recovered.data?.party[0].hp).toBe(0);
    expect(recovered.data?.lastCombatOutcome?.party[0].deathSaves?.failures).toBe(3);
    release!();
    expect((await saving).success).toBe(true);
    expect(localStorage.getItem(slot)).toBeNull();
  });

  it('does not delete a newer writer’s backup when an older write settles', async () => {
    let release: (() => void) | undefined;
    vi.mocked(IDBStorage.putSave).mockImplementationOnce((id, data) => new Promise(resolve => {
      release = () => { backend.records.set(id, data); resolve(); };
    }));
    const saving = saveDefeatChronicle(defeatedState(), slot);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    writeEmergencySnapshot({ ...defeatedState(), gold: 21 }, {
      slotId: slot, slotName: 'Newer exact backup', isAutoSave: false, backupKey: slot,
    });
    const newer = localStorage.getItem(slot);
    release!(); await saving;
    expect(localStorage.getItem(slot)).toBe(newer);
  });

  it('keeps the permanent slot when IndexedDB is unavailable', async () => {
    setIndexedDbAvailable(false);
    expect((await saveDefeatChronicle(defeatedState(), slot)).success).toBe(true);
    expect(localStorage.getItem(slot)).not.toBeNull();
    const loaded = await loadDefeatChronicle(slot);
    expect(loaded.data?.phase).toBe(GamePhase.GAME_OVER);
    expect(loaded.data?.gold).toBe(22);
  });

  it('refuses an inconsistent outcome or a recovery key instead of overwriting recovery', async () => {
    const state = defeatedState();
    const inconsistent = { ...state, party: state.party.map(member => ({ ...member, hp: 10 })) };
    expect((await saveDefeatChronicle(inconsistent, slot)).success).toBe(false);
    expect((await saveDefeatChronicle(state, SaveLoadService.DEFAULT_SAVE_SLOT_KEY)).success).toBe(false);
    expect(IDBStorage.putSave).not.toHaveBeenCalled();
    expect(localStorage.getItem(slot)).toBeNull();
  });

  it('rejects a record attached to another world without substituting a different saved journey', async () => {
    const state = defeatedState();
    await SaveLoadService.saveGame({ ...state, lastCombatOutcome: {
      ...state.lastCombatOutcome!, worldSeed: 99, chronicleSlotId: slot,
    } }, slot);
    const loaded = await loadDefeatChronicle(slot);
    expect(loaded.success).toBe(false);
  });
});
