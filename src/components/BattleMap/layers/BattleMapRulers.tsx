/**
 * @file layers/BattleMapRulers.tsx
 * The two coordinate rulers that frame the 2D tactical board.
 *
 * WHAT MOVED HERE (agora-9950): the column-number strip and the row-letter
 * gutter that used to be written inline in BattleMap.tsx, plus the
 * `RULER_GUTTER_PX` constant both of them depend on. The constant is the reason
 * they share a file: the column strip pads its left edge by exactly the width
 * the row gutter occupies, so numbers sit centered over their columns. Keeping
 * the two apart invites a silent one-sided edit that shifts every column label.
 *
 * WHY TWO EXPORTS AND NOT ONE COMPONENT: the rulers are NOT siblings in the
 * DOM. The column strip is a block above the board row; the row gutter is the
 * first child inside that row. One component could not emit both without
 * changing the element tree, and this extraction is required to be pixel- and
 * pointer-identical to what it replaced.
 *
 * Called by: BattleMap.tsx
 * Depends on: TILE_SIZE_PX for label pitch, BattleMapHUD's `rowLabel` for the
 * A-P letters (the HUD's hovered-tile readout spells rows with the same helper,
 * so the ruler and the readout can never disagree).
 */

import React from "react";
import { TILE_SIZE_PX } from "../../../config/mapConfig";
import { rowLabel } from "../BattleMapHUD";

/**
 * Width of the row-letter gutter to the left of the grid.
 *
 * The column ruler uses the same value as a leading offset so numbers sit
 * centered over their columns.
 */
export const RULER_GUTTER_PX = 20;

/** Column numbers (1-N) across the top of the board. */
export const BattleMapColumnRuler: React.FC<{ width: number }> = ({ width }) => (
  <div className="flex" style={{ paddingLeft: RULER_GUTTER_PX }}>
    {Array.from({ length: width }).map((_, i) => (
      <div
        key={`col-${i}`}
        style={{ width: TILE_SIZE_PX }}
        className="text-center text-[10px] font-semibold leading-4 text-amber-200/50"
      >
        {i + 1}
      </div>
    ))}
  </div>
);

/** Row letters (A-P) down the left edge of the board. */
export const BattleMapRowRuler: React.FC<{ height: number }> = ({ height }) => (
  <div className="flex flex-col" style={{ width: RULER_GUTTER_PX }}>
    {Array.from({ length: height }).map((_, i) => (
      <div
        key={`row-${i}`}
        style={{ height: TILE_SIZE_PX }}
        className="flex items-center justify-center text-[10px] font-semibold text-amber-200/50"
      >
        {rowLabel(i)}
      </div>
    ))}
  </div>
);
