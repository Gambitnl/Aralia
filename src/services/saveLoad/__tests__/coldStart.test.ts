import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SAVE_SLOT, EMERGENCY_SAVE_KEY, MIGRATION_FLAG_KEY } from '../saveLoadConstants';
import type { GameState } from '../../../types';

const storage = vi.hoisted(() => ({ available: vi.fn(), get: vi.fn(), put: vi.fn() }));
vi.mock('../../indexedDBStorageService', () => ({
  isAvailable: storage.available, getSave: storage.get, putSave: storage.put,
}));

const payload = (gold: number, cell: number) => JSON.stringify({ state: {
  gameTime: '0351-01-02T16:21:42.000Z', currentLocationId: `cell_${cell}`,
  worldSeed: 1793176397587, playerCell: { cellId: cell }, gold,
  party: [], inventory: [], discoveryLog: [], saveTimestamp: gold === 16 ? 200 : 100,
} });

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  localStorage.setItem(DEFAULT_SAVE_SLOT, payload(40, 1884));
  storage.put.mockResolvedValue(undefined);
  storage.get.mockResolvedValue(payload(16, 1885));
});

describe('cold-start save backend selection', () => {
  it('waits for startup before selecting the primary record instead of an older legacy journey', async () => {
    let complete!: (available: boolean) => void;
    storage.available.mockReturnValue(new Promise<boolean>(resolve => { complete = resolve; }));
    const { initializeStorage } = await import('../saveStorageInit');
    const { loadGame } = await import('../saveLoadCore');
    const startup = initializeStorage();
    let settled = false;
    const loading = loadGame(DEFAULT_SAVE_SLOT).then(value => { settled = true; return value; });
    await Promise.resolve(); await Promise.resolve();
    const settledBeforeBackend = settled;
    complete(true); await startup;
    const result = await loading;
    expect(settledBeforeBackend).toBe(false);
    expect(result.success).toBe(true);
    expect(result.data?.gold).toBe(16);
    expect(result.data?.currentLocationId).toBe('cell_1885');
  });

  it('shares one in-flight startup probe between simultaneous callers', async () => {
    let complete!: (available: boolean) => void;
    storage.available.mockReturnValue(new Promise<boolean>(resolve => { complete = resolve; }));
    const { initializeStorage } = await import('../saveStorageInit');
    const first = initializeStorage(), second = initializeStorage();
    const probes = storage.available.mock.calls.length;
    complete(true); await Promise.all([first, second]);
    expect(probes).toBe(1);
  });

  it('keeps legacy fallback when the completed backend check is unavailable', async () => {
    storage.available.mockResolvedValue(false);
    const { initializeStorage } = await import('../saveStorageInit');
    const { loadGame } = await import('../saveLoadCore');
    await initializeStorage();
    const result = await loadGame(DEFAULT_SAVE_SLOT);
    expect(result.success).toBe(true);
    expect(result.data?.gold).toBe(40);
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.available).toHaveBeenCalledTimes(1);
  });

  it('waits before a cold save so the new journey is written to its primary store', async () => {
    let complete!: (available: boolean) => void;
    storage.available.mockReturnValue(new Promise<boolean>(resolve => { complete = resolve; }));
    const { saveGame } = await import('../saveLoadCore');
    const state = JSON.parse(payload(16, 1885)).state as GameState;
    state.gameTime = new Date(state.gameTime);
    const saving = saveGame(state);
    await Promise.resolve();
    expect(storage.put).not.toHaveBeenCalled();
    complete(true);
    expect((await saving).success).toBe(true);
    expect(storage.put).toHaveBeenCalledWith(DEFAULT_SAVE_SLOT, expect.stringContaining('cell_1885'));
    expect(JSON.parse(localStorage.getItem(DEFAULT_SAVE_SLOT)!).state.gold).toBe(40);
  });

  it('also waits for recovery after availability is known, before reading the primary journey', async () => {
    storage.available.mockResolvedValue(true);
    storage.get.mockResolvedValue(payload(40, 1884));
    let finishRecovery!: () => void;
    storage.put.mockImplementation(() => new Promise<void>(resolve => {
      finishRecovery = () => { storage.get.mockResolvedValue(payload(16, 1885)); resolve(); };
    }));
    localStorage.setItem(EMERGENCY_SAVE_KEY, JSON.stringify({ slotId: DEFAULT_SAVE_SLOT, ...JSON.parse(payload(16, 1885)) }));
    const { initializeStorage } = await import('../saveStorageInit');
    const { loadGame } = await import('../saveLoadCore');
    const startup = initializeStorage();
    await vi.waitFor(() => expect(storage.put).toHaveBeenCalledTimes(1));
    let settled = false;
    const loading = loadGame(DEFAULT_SAVE_SLOT).then(result => { settled = true; return result; });
    await Promise.resolve(); await Promise.resolve();
    const readDuringRecovery = settled;
    finishRecovery(); await startup;
    const result = await loading;
    expect(readDuringRecovery).toBe(false);
    expect(result.data?.gold).toBe(16);
    expect(result.data?.currentLocationId).toBe('cell_1885');
  });
});
