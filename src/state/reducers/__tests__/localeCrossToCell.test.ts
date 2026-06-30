import { worldReducer } from '../worldReducer';
import { createMockGameState } from '../../../utils/core/factories';

describe('LOCALE_CROSS_TO_CELL — seamless edge re-anchor (Stage 5 S5.3)', () => {
  it('re-anchors the canonical cell to the neighbour at the entry feet', () => {
    const state = createMockGameState({
      playerCell: { cellId: 110, localeCoords: { x: 2980, y: 1500 } },
      playerGroundPos: { tileX: 5, tileY: 7, xM: 900, zM: 12 },
    });
    const slice = worldReducer(state, {
      type: 'LOCALE_CROSS_TO_CELL',
      payload: { cellId: 562, enterFeet: { x: 1, y: 1500 } },
    });
    expect(slice.playerCell).toEqual({ cellId: 562, localeCoords: { x: 1, y: 1500 } });
  });

  it('clears the stale playerGroundPos (it was tied to the OLD cell)', () => {
    const state = createMockGameState({
      playerCell: { cellId: 110, localeCoords: { x: 0, y: 0 } },
      playerGroundPos: { tileX: 5, tileY: 7, xM: 900, zM: 12 },
    });
    const slice = worldReducer(state, {
      type: 'LOCALE_CROSS_TO_CELL',
      payload: { cellId: 562, enterFeet: { x: 5, y: 5 } },
    });
    // Null = honest "unknown until the new cell's ground session reports a position".
    expect(slice.playerGroundPos).toBeNull();
  });

  it('establishes presence even if no cell was recorded yet (defensive)', () => {
    const state = createMockGameState({ playerCell: null, playerGroundPos: null });
    const slice = worldReducer(state, {
      type: 'LOCALE_CROSS_TO_CELL',
      payload: { cellId: 77, enterFeet: { x: 10, y: 20 } },
    });
    expect(slice.playerCell).toEqual({ cellId: 77, localeCoords: { x: 10, y: 20 } });
  });
});
