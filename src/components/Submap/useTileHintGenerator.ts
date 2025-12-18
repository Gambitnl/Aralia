/**
 * @file useTileHintGenerator.ts
 * Centralizes tooltip string generation so the heavy logic is reusable and memoized.
 * Dependencies: submapTileHints data set + submap coordinates + inspected descriptions.
 */
import { useCallback } from 'react';
import { SeededFeatureConfig } from '../../types';
import { submapTileHints } from './submapData';

interface HintGeneratorOptions {
  inspectedTileDescriptions: Record<string, string>;
  playerSubmapCoords: { x: number; y: number };
  parentWorldMapCoords: { x: number; y: number };
  currentWorldBiomeId: string;
  currentBiomeName?: string;
  simpleHash: (x: number, y: number, seed: string) => number;
}

export const useTileHintGenerator = ({
  inspectedTileDescriptions,
  playerSubmapCoords,
  parentWorldMapCoords,
  currentWorldBiomeId,
  currentBiomeName,
  simpleHash,
}: HintGeneratorOptions) => {
  return useCallback(
    (
      submapX: number,
      submapY: number,
      effectiveTerrain: string,
      featureConfig: SeededFeatureConfig | null,
      isSeedTile: boolean
    ): string => {
      const tileKey = `${parentWorldMapCoords.x}_${parentWorldMapCoords.y}_${submapX}_${submapY}`;
      if (inspectedTileDescriptions[tileKey]) {
        return inspectedTileDescriptions[tileKey];
      }

      const dx = Math.abs(submapX - playerSubmapCoords.x);
      const dy = Math.abs(submapY - playerSubmapCoords.y);
      const isAdjacent = dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);

      const hintKeys: string[] = [];

      if (featureConfig) {
        hintKeys.push(`${currentWorldBiomeId}_${featureConfig.id}`);
        hintKeys.push(featureConfig.id);
      }

      if (effectiveTerrain !== 'default') {
        hintKeys.push(`${currentWorldBiomeId}_${effectiveTerrain}`);
        hintKeys.push(effectiveTerrain);
      }

      hintKeys.push(`${currentWorldBiomeId}_default`);
      hintKeys.push('default');

      if (isAdjacent) {
        for (const key of hintKeys) {
          if (submapTileHints[key] && submapTileHints[key].length > 0) {
            return submapTileHints[key][simpleHash(submapX, submapY, 'hint_adj') % submapTileHints[key].length];
          }
        }
      } else {
        if (isSeedTile && featureConfig?.name) {
          return `${featureConfig.name}.`;
        }
        if (featureConfig?.name) return `An area featuring a ${featureConfig.name.toLowerCase()}.`;
        if (effectiveTerrain !== 'default' && effectiveTerrain !== 'path_adj' && effectiveTerrain !== 'path') {
          return `A patch of ${effectiveTerrain.replace(/_/g, ' ')}.`;
        }
        return `A patch of ${currentBiomeName || 'terrain'}.`;
      }

      return submapTileHints['default'][
        simpleHash(submapX, submapY, 'hint_adj_fallback') % submapTileHints['default'].length
      ];
    },
    [
      inspectedTileDescriptions,
      playerSubmapCoords,
      parentWorldMapCoords,
      currentWorldBiomeId,
      currentBiomeName,
      simpleHash,
    ]
  );
};

export default useTileHintGenerator;
