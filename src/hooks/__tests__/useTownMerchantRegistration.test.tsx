/** Saved towns must retain their people until their source layout is known.
 * These checks exercise the hook's actual dispatch boundary, including loading
 * another save in the same town without remounting the application. */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../types';
import { useTownMerchantRegistration } from '../useTownMerchantRegistration';

const fixture = vi.hoisted(() => ({ compute: vi.fn() }));
vi.mock('../../systems/worldforge/townsim/chronicleForLocation', () => ({ burgIdForLocation: () => 200 }));
vi.mock('../../systems/worldforge/townsim/registerBurgMerchants', () => ({ computeBurgMerchants: fixture.compute }));

function state(revision?: 1 | 2, savedTown = true): GameState {
  return {
    worldSeed: 1793176397587, playerCell: { cellId: 2016 },
    gameTime: new Date('0351-01-05T16:22:15Z'),
    townSim: savedTown ? { 200: { burgId: 200, layoutRevision: revision } } : {},
    generatedNpcs: { savedKeeper: { id: 'savedKeeper', name: 'Wat Westcroft' } },
    worldBusinesses: { savedBusiness: { id: 'savedBusiness', ownerId: 'savedKeeper' } },
  } as unknown as GameState;
}

beforeEach(() => {
  fixture.compute.mockReset();
  fixture.compute.mockReturnValue({ npcs: [{ id: 'sourceKeeper' }], businesses: [{ id: 'sourceBusiness' }] });
});

describe('town merchant source admission', () => {
  it('does not rewrite an unversioned saved town or create merchant memory', () => {
    const value = state(), before = JSON.stringify(value), dispatch = vi.fn();
    renderHook(() => useTownMerchantRegistration(value, dispatch));
    expect(fixture.compute).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(value)).toBe(before);
  });

  it('registers a first arrival without a saved town', () => {
    const dispatch = vi.fn();
    renderHook(() => useTownMerchantRegistration(state(undefined, false), dispatch));
    expect(fixture.compute).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual(['REGISTER_GENERATED_NPC', 'REGISTER_WORLD_BUSINESS']);
  });

  it('resumes with the admitted revision and does not loop on its own dispatches', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(({ value }) => useTownMerchantRegistration(value, dispatch), { initialProps: { value: state() } });
    const qualified = state(1);
    rerender({ value: qualified });
    expect(fixture.compute).toHaveBeenCalledTimes(1);
    expect(fixture.compute.mock.calls[0][5]).toBe(qualified.townSim[200]);
    rerender({ value: { ...qualified, generatedNpcs: { ...qualified.generatedNpcs } } });
    expect(fixture.compute).toHaveBeenCalledTimes(1);
  });

  it('respects a different save revision in the same town', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(({ value }) => useTownMerchantRegistration(value, dispatch), { initialProps: { value: state(2) } });
    rerender({ value: state() });
    expect(fixture.compute).toHaveBeenCalledTimes(1);
    const historical = state(1);
    rerender({ value: historical });
    expect(fixture.compute).toHaveBeenCalledTimes(2);
    expect(fixture.compute.mock.calls[1][5]).toBe(historical.townSim[200]);
  });
});
