import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SAVE_SLOT, EMERGENCY_SAVE_KEY, MIGRATION_FLAG_KEY } from '../saveLoadConstants';
import { simpleHash } from '../../../utils/core';

const storage = vi.hoisted(() => ({ available: vi.fn(), get: vi.fn(), put: vi.fn() }));
vi.mock('../../indexedDBStorageService', () => ({
  isAvailable: storage.available, getSave: storage.get, putSave: storage.put,
}));

const save = (saveTimestamp: number, gold: number) => {
  const state = { gameTime: '0351-01-07T07:25:57Z', worldSeed: 1793225896251, gold, saveTimestamp };
  return JSON.stringify({
    version: '0.1.0', slotId: AUTO_SAVE_SLOT, slotName: 'Auto-Save', isAutoSave: true,
    preview: {}, state, checksum: simpleHash(JSON.stringify(state)),
  });
};

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  storage.available.mockResolvedValue(true);
  storage.get.mockResolvedValue(null);
  storage.put.mockResolvedValue(undefined);
});

describe('emergency save startup recovery', () => {
  it('preserves a newer valid IndexedDB autosave over an older emergency snapshot', async () => {
    const current = save(1793828577572, 86);
    const emergency = save(1793828577561, 85);
    storage.get.mockResolvedValue(current);
    localStorage.setItem(EMERGENCY_SAVE_KEY, emergency);

    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();

    expect(storage.put).not.toHaveBeenCalled();
    expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBeNull();
  });

  it('preserves an equal-time target and recovers a newer emergency normally', async () => {
    const current = save(200, 86);
    storage.get.mockResolvedValue(current);
    localStorage.setItem(EMERGENCY_SAVE_KEY, save(200, 85));
    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();
    expect(storage.put).not.toHaveBeenCalled();
    expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBeNull();

    vi.resetModules(); vi.clearAllMocks(); localStorage.clear();
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    storage.available.mockResolvedValue(true); storage.get.mockResolvedValue(current);
    storage.put.mockResolvedValue(undefined);
    const newerEmergency = save(201, 85);
    localStorage.setItem(EMERGENCY_SAVE_KEY, newerEmergency);
    const next = await import('../saveStorageInit');
    await next.initializeStorage();
    expect(storage.put).toHaveBeenCalledWith(AUTO_SAVE_SLOT, newerEmergency);
  });

  it('does not let a corrupt high-timestamp target suppress a valid emergency', async () => {
    const corrupt = JSON.parse(save(999, 86));
    corrupt.checksum++;
    const emergency = save(200, 85);
    storage.get.mockResolvedValue(JSON.stringify(corrupt));
    localStorage.setItem(EMERGENCY_SAVE_KEY, emergency);
    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();
    expect(storage.put).toHaveBeenCalledWith(AUTO_SAVE_SLOT, emergency);
  });

  it('treats an explicit zero checksum as invalid instead of as a legacy omission', async () => {
    const corrupt = JSON.parse(save(999, 86));
    corrupt.checksum = 0;
    const emergency = save(200, 85);
    storage.get.mockResolvedValue(JSON.stringify(corrupt));
    localStorage.setItem(EMERGENCY_SAVE_KEY, emergency);
    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();
    expect(storage.put).toHaveBeenCalledWith(AUTO_SAVE_SLOT, emergency);
  });

  it('does not let an incompatible high-timestamp target suppress recovery', async () => {
    const incompatible = JSON.parse(save(999, 86));
    incompatible.state.saveVersion = '99.0.0';
    incompatible.checksum = simpleHash(JSON.stringify(incompatible.state));
    const emergency = save(200, 85);
    storage.get.mockResolvedValue(JSON.stringify(incompatible));
    localStorage.setItem(EMERGENCY_SAVE_KEY, emergency);
    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();
    expect(storage.put).toHaveBeenCalledWith(AUTO_SAVE_SLOT, emergency);
  });

  it('preserves an invalid modern emergency without overwriting a valid target', async () => {
    const current = save(200, 86);
    const corruptEmergency = JSON.parse(save(201, 85));
    corruptEmergency.checksum = 0;
    const rawEmergency = JSON.stringify(corruptEmergency);
    storage.get.mockResolvedValue(current);
    localStorage.setItem(EMERGENCY_SAVE_KEY, rawEmergency);
    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();
    expect(storage.put).not.toHaveBeenCalled();
    expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBe(rawEmergency);
  });

  it('keeps legacy bare payload recovery when neither save has a timestamp', async () => {
    const legacyTarget = JSON.stringify({ gameTime: '0351-01-06T07:25:57Z', gold: 86 });
    const legacyEmergency = JSON.stringify({ gameTime: '0351-01-07T07:25:57Z', gold: 85 });
    storage.get.mockResolvedValue(legacyTarget);
    localStorage.setItem(EMERGENCY_SAVE_KEY, legacyEmergency);
    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();
    expect(storage.put).toHaveBeenCalledWith(AUTO_SAVE_SLOT, legacyEmergency);
    expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBeNull();
  });

  it('recovers when the target is missing and preserves emergency bytes replaced during a pending write', async () => {
    const emergency = save(200, 85);
    const newerEmergency = save(201, 86);
    storage.get.mockResolvedValue(null);
    let finishWrite!: () => void;
    storage.put.mockImplementation(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    localStorage.setItem(EMERGENCY_SAVE_KEY, emergency);
    const { initializeStorage } = await import('../saveStorageInit');
    const startup = initializeStorage();
    await vi.waitFor(() => expect(storage.put).toHaveBeenCalledOnce());
    localStorage.setItem(EMERGENCY_SAVE_KEY, newerEmergency);
    finishWrite();
    await startup;
    expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBe(newerEmergency);
  });

  it('preserves emergency bytes when target reads or writes fail', async () => {
    const emergency = save(200, 85);
    localStorage.setItem(EMERGENCY_SAVE_KEY, emergency);
    storage.get.mockRejectedValueOnce(new Error('read failed'));
    const { initializeStorage } = await import('../saveStorageInit');
    await initializeStorage();
    expect(storage.put).not.toHaveBeenCalled();
    expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBe(emergency);

    vi.resetModules(); vi.clearAllMocks(); localStorage.clear();
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    storage.available.mockResolvedValue(true); storage.get.mockResolvedValue(null);
    storage.put.mockRejectedValue(new Error('write failed'));
    localStorage.setItem(EMERGENCY_SAVE_KEY, emergency);
    const next = await import('../saveStorageInit');
    await next.initializeStorage();
    expect(localStorage.getItem(EMERGENCY_SAVE_KEY)).toBe(emergency);
  });
});
