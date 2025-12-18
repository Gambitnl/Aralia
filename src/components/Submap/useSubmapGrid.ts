/**
 * @file useSubmapGrid.ts
 * Generates the flattened grid data (visuals + tooltip) consumed by SubmapPane render.
 * Dependencies: visual resolver (getTileVisuals) + tile hint generator.
 */
import { useMemo } from 'react';
import { VisualLayerOutput } from './submapVisuals';
import { SeededFeatureConfig } from '../../types';

export interface SubmapGridTile {
  r: number;
  c: number;
  visuals: VisualLayerOutput;
  tooltipContent: string;
}

interface SubmapGridOptions {
  submapDimensions: { rows: number; cols: number };
  getTileVisuals: (rowIndex: number, colIndex: number) => VisualLayerOutput;
  getHintForTile: (
    submapX: number,
    submapY: number,
    effectiveTerrain: string,
    featureConfig: SeededFeatureConfig | null,
    isSeedTile: boolean
  ) => string;
}

export const useSubmapGrid = ({
  submapDimensions,
  getTileVisuals,
  getHintForTile,
}: SubmapGridOptions): SubmapGridTile[] => {
  const submapGrid = useMemo(() => {
    const grid = [];
    for (let r = 0; r < submapDimensions.rows; r++) {
      for (let c = 0; c < submapDimensions.cols; c++) {
        const visuals = getTileVisuals(r, c);
        grid.push({ r, c, visuals });
      }
    }
    return grid;
  }, [submapDimensions.rows, submapDimensions.cols, getTileVisuals]);

  return useMemo(
    () =>
      submapGrid.map((tile) => ({
        ...tile,
        tooltipContent: getHintForTile(
          tile.c,
          tile.r,
          tile.visuals.effectiveTerrainType,
          tile.visuals.activeSeededFeatureConfigForTile,
          tile.visuals.isSeedTile
        ),
      })),
    [submapGrid, getHintForTile]
  );
};

export default useSubmapGrid;
