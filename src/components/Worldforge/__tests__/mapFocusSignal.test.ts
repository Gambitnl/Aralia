/**
 * @file mapFocusSignal.test.ts — one-shot semantics of the cross-tree map-open signals.
 *
 * Both signals are module singletons: a producer (3D HUD button) sets a flag and
 * the next fresh map mount reads-and-clears it. The contract that matters is
 * "true at most once per request, and the two requests don't interfere."
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  requestMapCenterOnPlayer,
  consumeMapCenterOnPlayer,
  requestMapDrillToPlayerTown,
  consumeMapDrillToPlayerTown,
} from '../mapFocusSignal';

describe('mapFocusSignal', () => {
  beforeEach(() => {
    // Clear any stray request leaked from another test/order.
    consumeMapCenterOnPlayer();
    consumeMapDrillToPlayerTown();
  });

  it('defaults to not-wanted when nothing requested', () => {
    expect(consumeMapCenterOnPlayer()).toBe(false);
    expect(consumeMapDrillToPlayerTown()).toEqual({ wanted: false, burgId: null });
  });

  it('drill request carries the burg id, true exactly once, then clears', () => {
    requestMapDrillToPlayerTown(588);
    expect(consumeMapDrillToPlayerTown()).toEqual({ wanted: true, burgId: 588 });
    expect(consumeMapDrillToPlayerTown()).toEqual({ wanted: false, burgId: null });
  });

  it('drill request without a burg id is still a request', () => {
    requestMapDrillToPlayerTown();
    expect(consumeMapDrillToPlayerTown()).toEqual({ wanted: true, burgId: null });
  });

  it('center request is true exactly once, then clears', () => {
    requestMapCenterOnPlayer();
    expect(consumeMapCenterOnPlayer()).toBe(true);
    expect(consumeMapCenterOnPlayer()).toBe(false);
  });

  it('the two signals are independent (drill does not set center, and vice versa)', () => {
    requestMapDrillToPlayerTown(7);
    expect(consumeMapCenterOnPlayer()).toBe(false);
    expect(consumeMapDrillToPlayerTown()).toEqual({ wanted: true, burgId: 7 });

    requestMapCenterOnPlayer();
    expect(consumeMapDrillToPlayerTown()).toEqual({ wanted: false, burgId: null });
    expect(consumeMapCenterOnPlayer()).toBe(true);
  });
});
