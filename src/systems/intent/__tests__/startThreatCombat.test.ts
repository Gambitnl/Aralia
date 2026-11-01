/**
 * startThreatCombat: the one path from a threat roster into a battle (C14,
 * agora-9ed9.14). Pins the location-authority rule: without a ready projection
 * of a real GroundWorld the encounter launches WITHOUT a map, never on made-up
 * terrain, and a ready projection is recorded into world history first.
 *
 * Exercises: src/systems/intent/startThreatCombat.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const session = vi.hoisted(() => ({
  mounted: true,
  awaitResult: true,
  awaitCalls: [] as number[],
}));

vi.mock('../../combat/fightInPlace/activeGroundCombatSession', () => ({
  isActiveGroundOpeningProviderMounted: () => session.mounted,
  awaitActiveGroundOpeningProvider: async (timeoutMs: number) => {
    session.awaitCalls.push(timeoutMs);
    return session.awaitResult;
  },
  prepareActiveGroundOpeningEncounter: vi.fn(),
}));
// The real launcher is injected per test; keep its heavy module out of the graph.
vi.mock('../../combat/startBattleMapEncounter', () => ({ handleStartBattleMapEncounter: vi.fn() }));

import { GROUND_MOUNT_TIMEOUT_MS, startThreatCombat } from '../startThreatCombat';
import type { SituationThreat } from '../../gameEntry/types';

const source = { kind: 'test-receipt' } as unknown as NonNullable<SituationThreat['battlefieldSource']>;
const threat = (withSource = true): SituationThreat => ({
  hostile: true,
  enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }, { name: '  ', quantity: 1, cr: '1' }],
  deEscalationDC: 12,
  tension: 'a toll at the bridge',
  battlefieldSource: withSource ? source : undefined,
});
const banditMonsters = [{ name: 'Bandit', quantity: 2, cr: '1/8', description: 'Bandit · CR 1/8' }];

describe('startThreatCombat', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let startEncounter: ReturnType<typeof vi.fn>;
  let prepareOpeningEncounter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    session.mounted = true;
    session.awaitResult = true;
    session.awaitCalls = [];
    dispatch = vi.fn();
    startEncounter = vi.fn(async () => undefined);
    prepareOpeningEncounter = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  const run = (overrides: Partial<Parameters<typeof startThreatCombat>[0]> = {}) =>
    startThreatCombat({
      threat: threat(),
      dispatch: dispatch as never,
      startEncounter: startEncounter as never,
      prepareOpeningEncounter: prepareOpeningEncounter as never,
      ...overrides,
    });

  it('launches mapless, without projecting, when the threat has no battlefield source', async () => {
    await run({ threat: threat(false) });
    expect(prepareOpeningEncounter).not.toHaveBeenCalled();
    expect(startEncounter).toHaveBeenCalledWith(dispatch, { monsters: banditMonsters });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('launches mapless and records nothing when the projection is not ready', async () => {
    prepareOpeningEncounter.mockResolvedValue({ status: 'rejected', detail: 'outside the world' });
    await run();
    expect(prepareOpeningEncounter).toHaveBeenCalledWith({ source, enemies: threat().enemies });
    expect(startEncounter).toHaveBeenCalledWith(dispatch, { monsters: banditMonsters });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('records the receipt first, then launches on the projected map without the patch tiles', async () => {
    const receipt = { entities: [{ id: 'e1', sourceId: 'site-7', sourcePatchTile: { x: 3, y: 4 } }] };
    const mapData = { id: 'projected-map' };
    prepareOpeningEncounter.mockResolvedValue({ status: 'ready', receipt, mapData });
    await run();

    expect(dispatch).toHaveBeenCalledWith({ type: 'RECORD_WORLDFORGE_ENCOUNTER', payload: { receipt } });
    expect(startEncounter).toHaveBeenCalledWith(dispatch, {
      monsters: banditMonsters,
      extractedBattleMap: mapData,
      combatantWorldSources: [{ id: 'e1', sourceId: 'site-7' }],
    });
    // The history record must land before the combat phase replaces the scene.
    expect(dispatch.mock.invocationCallOrder[0]).toBeLessThan(startEncounter.mock.invocationCallOrder[0]);
  });

  it('mounts the GroundWorld first when none is live, and still projects after a mount timeout', async () => {
    session.mounted = false;
    session.awaitResult = false;
    const ensureGroundMounted = vi.fn();
    prepareOpeningEncounter.mockResolvedValue({ status: 'no-provider' });
    await run({ ensureGroundMounted });

    expect(ensureGroundMounted).toHaveBeenCalledTimes(1);
    expect(session.awaitCalls).toEqual([GROUND_MOUNT_TIMEOUT_MS]);
    expect(prepareOpeningEncounter).toHaveBeenCalledTimes(1);
    expect(startEncounter).toHaveBeenCalledWith(dispatch, { monsters: banditMonsters });
  });

  it('does not wait for a mount when a GroundWorld is already live', async () => {
    const ensureGroundMounted = vi.fn();
    prepareOpeningEncounter.mockResolvedValue({ status: 'rejected' });
    await run({ ensureGroundMounted });
    expect(ensureGroundMounted).not.toHaveBeenCalled();
    expect(session.awaitCalls).toEqual([]);
  });
});
