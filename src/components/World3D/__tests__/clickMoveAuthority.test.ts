import { describe, it, expect } from 'vitest';
import {
  cameraMayWriteGroundPos,
  hasArrivedAtIntent,
  isIntentOnTile,
  CLICK_MOVE_ARRIVE_EPSILON_M,
  type ClickMoveIntent,
} from '../clickMoveAuthority';

/**
 * The camera↔click-move referee. `playerGroundPos` has two writers (the camera
 * pan reporter ~10Hz, and a discrete ground click). Without this decision a
 * camera pan right after a click clobbers the clicked destination and the avatar
 * never arrives. These pin the pure rule so the coupling can't silently return.
 */
describe('cameraMayWriteGroundPos', () => {
  it('lets the camera write when NO click-move is armed (normal camera walk)', () => {
    expect(cameraMayWriteGroundPos(null, { xM: 5, zM: 5 })).toBe(true);
    expect(cameraMayWriteGroundPos(null, null)).toBe(true);
  });

  it('BLOCKS a camera report while a click-move is in progress (the core fix)', () => {
    const intent: ClickMoveIntent = { xM: 100, zM: 100, tileX: 3, tileY: 4 };
    // Avatar is still far from the clicked target → camera must not clobber it.
    expect(cameraMayWriteGroundPos(intent, { xM: 10, zM: 10 })).toBe(false);
  });

  it('a new click replaces the target — arming a fresh intent re-blocks the camera', () => {
    // First intent nearly reached; then the player clicks elsewhere (new intent).
    const firstTarget: ClickMoveIntent = { xM: 20, zM: 20, tileX: 1, tileY: 1 };
    const current = { xM: 20, zM: 20 };
    expect(cameraMayWriteGroundPos(firstTarget, current)).toBe(true); // arrived at first
    const secondTarget: ClickMoveIntent = { xM: 200, zM: 5, tileX: 1, tileY: 1 };
    // With the new target armed and the avatar still at the old spot, blocked again.
    expect(cameraMayWriteGroundPos(secondTarget, current)).toBe(false);
  });

  it('releases (camera may write) once the avatar ARRIVES within the epsilon', () => {
    const intent: ClickMoveIntent = { xM: 50, zM: 50, tileX: 0, tileY: 0 };
    // Just inside the arrival radius on one axis.
    const current = { xM: 50 + CLICK_MOVE_ARRIVE_EPSILON_M * 0.9, zM: 50 };
    expect(cameraMayWriteGroundPos(intent, current)).toBe(true);
  });

  it('stays blocked at exactly beyond the epsilon, releases at exactly within it', () => {
    const intent: ClickMoveIntent = { xM: 0, zM: 0, tileX: 0, tileY: 0 };
    // Distance just over epsilon → blocked.
    expect(cameraMayWriteGroundPos(intent, { xM: CLICK_MOVE_ARRIVE_EPSILON_M + 0.01, zM: 0 })).toBe(false);
    // Distance exactly epsilon → arrived (<=), released.
    expect(cameraMayWriteGroundPos(intent, { xM: CLICK_MOVE_ARRIVE_EPSILON_M, zM: 0 })).toBe(true);
  });

  it('blocks while the avatar position is unknown but an intent is armed', () => {
    // No current position (e.g. playerGroundPos not yet on this tile): treat the
    // click destination as still-unreached so the camera cannot win the race.
    expect(cameraMayWriteGroundPos({ xM: 1, zM: 1 }, null)).toBe(false);
  });

  it('respects a custom epsilon', () => {
    const intent: ClickMoveIntent = { xM: 0, zM: 0, tileX: 0, tileY: 0 };
    const current = { xM: 3, zM: 4 }; // distance 5
    expect(cameraMayWriteGroundPos(intent, current, 4)).toBe(false);
    expect(cameraMayWriteGroundPos(intent, current, 5)).toBe(true);
  });
});

describe('hasArrivedAtIntent', () => {
  it('is false with no target or no current position', () => {
    expect(hasArrivedAtIntent(null, { xM: 0, zM: 0 })).toBe(false);
    expect(hasArrivedAtIntent({ xM: 0, zM: 0 }, null)).toBe(false);
  });

  it('is true only within the arrival radius (planar distance)', () => {
    const target = { xM: 10, zM: 10 };
    expect(hasArrivedAtIntent(target, { xM: 10, zM: 10 })).toBe(true);
    expect(hasArrivedAtIntent(target, { xM: 10 + CLICK_MOVE_ARRIVE_EPSILON_M + 0.1, zM: 10 })).toBe(false);
  });
});

describe('isIntentOnTile', () => {
  it('null intent is never on any tile', () => {
    expect(isIntentOnTile(null, 0, 0)).toBe(false);
    expect(isIntentOnTile(null, 7, 3)).toBe(false);
  });

  it('is true only on the tile the intent was armed on', () => {
    const intent: ClickMoveIntent = { xM: 5, zM: 5, tileX: 2, tileY: 6 };
    expect(isIntentOnTile(intent, 2, 6)).toBe(true);
    // A TILE CROSSING (active tile is now (3,6)) → stale, so the caller clears it
    // and the camera-walk latch cannot stick forever after the crossing.
    expect(isIntentOnTile(intent, 3, 6)).toBe(false);
    expect(isIntentOnTile(intent, 2, 7)).toBe(false);
  });

  it('an intent armed on tile (a) is stale once the active tile is (b)', () => {
    const armedOnA: ClickMoveIntent = { xM: 12, zM: 34, tileX: 1, tileY: 1 };
    // While still on (a) the intent holds authority (camera blocked far away).
    expect(isIntentOnTile(armedOnA, 1, 1)).toBe(true);
    // Cross to tile (b): the intent is stale — the caller clears it, and after
    // clearing the camera may write again (cameraMayWriteGroundPos(null, ...)).
    expect(isIntentOnTile(armedOnA, 2, 1)).toBe(false);
    expect(cameraMayWriteGroundPos(null, { xM: 0, zM: 0 })).toBe(true);
  });
});
