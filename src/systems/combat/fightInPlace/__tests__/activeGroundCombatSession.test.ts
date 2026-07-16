/**
 * This file proves the mounted GroundWorld encounter provider has explicit,
 * ownership-safe lifecycle behavior.
 *
 * The provider is runtime-only state. These tests guard against a stale React
 * cleanup deleting a newer ground session and against callers mistaking a
 * missing provider for a source-backed encounter.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  prepareActiveGroundOpeningEncounter,
  prepareActiveGroundSettlementEncounter,
  registerActiveGroundCombatProvider,
  registerActiveGroundOpeningCombatProvider,
} from '../activeGroundCombatSession';

const request = {
  trigger: {
    kind: 'watch-confrontation' as const,
    source: 'player-interaction' as const,
    sourceId: 'talk:test-watch',
    locationId: 'cell_829',
    summary: 'Test watch confrontation.',
  },
  knownCrimes: [],
  playerFactionStandings: {},
};

let cleanup: (() => void) | undefined;
let openingCleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  openingCleanup?.();
  openingCleanup = undefined;
});

describe('active GroundWorld combat session', () => {
  it('reports unavailable when gameplay is not inside a mounted GroundWorld', async () => {
    const result = await prepareActiveGroundSettlementEncounter(request);
    expect(result.status).toBe('unavailable');
  });

  it('forwards current player evidence to the mounted provider', async () => {
    const provider = vi.fn(async () => ({
      status: 'withheld' as const,
      detail: 'Evidence was inspected.',
    }));
    cleanup = registerActiveGroundCombatProvider(provider);

    const result = await prepareActiveGroundSettlementEncounter(request);

    expect(provider).toHaveBeenCalledWith(request);
    expect(result).toEqual({ status: 'withheld', detail: 'Evidence was inspected.' });
  });

  it('does not let an old cleanup erase a newer mounted provider', async () => {
    const oldCleanup = registerActiveGroundCombatProvider(async () => ({
      status: 'source-gap' as const,
      detail: 'Old provider.',
    }));
    cleanup = registerActiveGroundCombatProvider(async () => ({
      status: 'withheld' as const,
      detail: 'New provider.',
    }));

    oldCleanup();
    const result = await prepareActiveGroundSettlementEncounter(request);

    expect(result).toEqual({ status: 'withheld', detail: 'New provider.' });
  });
});

// ============================================================================
// Opening Threat Provider
// ============================================================================
// The opening path has its own lifecycle because it projects terrain only; the
// social threat already owns the bestiary roster and de-escalation outcome.
// ============================================================================

const openingRequest = {
  source: {
    kind: 'worldforge-opening-location' as const,
    receiptId: 'opening:42:cell:476',
    worldSeed: 42,
    cellId: 476,
    locationLabel: 'Legium',
  },
};

describe('active GroundWorld opening session', () => {
  it('reports unavailable when the opening has no mounted GroundWorld', async () => {
    const result = await prepareActiveGroundOpeningEncounter(openingRequest);

    expect(result).toEqual({
      status: 'unavailable',
      detail: 'No live WorldForge GroundWorld is mounted for this opening threat.',
    });
  });

  it('forwards the frozen opening source receipt to the mounted projector', async () => {
    const provider = vi.fn(async () => ({
      status: 'source-gap' as const,
      detail: 'Receipt was inspected.',
    }));
    openingCleanup = registerActiveGroundOpeningCombatProvider(provider);

    const result = await prepareActiveGroundOpeningEncounter(openingRequest);

    expect(provider).toHaveBeenCalledWith(openingRequest);
    expect(result).toEqual({ status: 'source-gap', detail: 'Receipt was inspected.' });
  });

  it('does not let stale opening cleanup remove a newer GroundWorld projector', async () => {
    const oldCleanup = registerActiveGroundOpeningCombatProvider(async () => ({
      status: 'source-gap' as const,
      detail: 'Old opening provider.',
    }));
    openingCleanup = registerActiveGroundOpeningCombatProvider(async () => ({
      status: 'source-gap' as const,
      detail: 'New opening provider.',
    }));

    oldCleanup();
    const result = await prepareActiveGroundOpeningEncounter(openingRequest);

    expect(result).toEqual({ status: 'source-gap', detail: 'New opening provider.' });
  });
});
