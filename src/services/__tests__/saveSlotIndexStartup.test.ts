/** Proves cold title-menu reads preserve real IndexedDB save listings. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

describe('save menu startup', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(async () => {
    const { teardownSlotIndexStorageSync } = await import('../saveLoad/saveSlotIndex');
    teardownSlotIndexStorageSync();
  });

  const slot = { slotId: 'aralia_rpg_autosave', slotName: 'Mara in Serara', lastSaved: 123 };
  const seedIndex = () => localStorage.setItem('aralia_rpg_save_slots_index', JSON.stringify([slot]));

  it('keeps an IDB-only slot before and after asynchronous backend availability resolves', async () => {
    seedIndex();
    const { getSaveSlots } = await import('../saveLoad/saveSlotIndex');
    const { setIndexedDbAvailable } = await import('../saveLoad/saveLoadHelpers');
    expect(getSaveSlots()).toEqual([slot]);
    expect(JSON.parse(localStorage.getItem('aralia_rpg_save_slots_index')!)).toEqual([slot]);
    setIndexedDbAvailable(true);
    expect(getSaveSlots()).toEqual([slot]);
  });

  it('rechecks an early cache and removes a ghost only after confirming local-only storage', async () => {
    seedIndex();
    const { getSaveSlots } = await import('../saveLoad/saveSlotIndex');
    const { setIndexedDbAvailable } = await import('../saveLoad/saveLoadHelpers');
    expect(getSaveSlots()).toEqual([slot]);
    setIndexedDbAvailable(false);
    expect(getSaveSlots()).toEqual([]);
  });

  it('retains a real local payload after the local-only check', async () => {
    seedIndex();
    localStorage.setItem(slot.slotId, JSON.stringify({state:{saveTimestamp:123}}));
    const { getSaveSlots } = await import('../saveLoad/saveSlotIndex');
    const { setIndexedDbAvailable } = await import('../saveLoad/saveLoadHelpers');
    expect(getSaveSlots()).toEqual([slot]);
    setIndexedDbAvailable(false);
    expect(getSaveSlots()).toEqual([slot]);
  });
});
