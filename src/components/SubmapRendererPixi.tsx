/**
 * @file SubmapRendererPixi.tsx
 * Lightweight PixiJS renderer to prototype GPU-backed submap drawing.
 * The component deliberately favors simplicity and abundant comments so future contributors can iterate quickly.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { CaTileType } from '../services/cellularAutomataService';
import { WfcGrid } from '../services/wfcService';
import type { SeededFeatureConfig } from '../types';

interface SubmapRendererPixiProps {
  dimensions: { rows: number; cols: number };
  playerSubmapCoords: { x: number; y: number };
  wfcGrid?: WfcGrid;
  caGrid?: CaTileType[][];
  biomeBlendContext: { primaryBiomeId: string; secondaryBiomeId: string | null; blendFactor: number };
  seededFeatures: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }>;
  paletteOverrides?: Partial<Record<string, number>>;
  biomeTintColor?: number | null;
  onHoverTile?: (coords: { x: number; y: number } | null) => void;
  onRenderMetrics?: (metrics: { lastMs: number; fpsEstimate: number }) => void;
}

const TILE_SIZE = 20;

const fallbackPalette: Record<string, number> = {
  // Align these fill colors with the semantic terrain types used by SubmapPane so the preview matches gameplay tiles.
  grass: 0x3a5f0b,
  path: 0x8b5a2b,
  water: 0x1b4f72,
  rock: 0x7f8c8d,
  wall: 0x2c3e50,
  floor: 0x95a5a6,
  ore: 0xf1c40f,
  default: 0x2d3436,
};

function lerpChannel(base: number, tint: number, factor: number): number {
  return Math.round(base + (tint - base) * factor);
}

function blendHex(baseColor: number, tintColor: number, factor: number): number {
  // Guard the factor to avoid accidental overflow when callers send values outside [0,1].
  const clampedFactor = Math.max(0, Math.min(1, factor));
  const baseR = (baseColor >> 16) & 0xff;
  const baseG = (baseColor >> 8) & 0xff;
  const baseB = baseColor & 0xff;

  const tintR = (tintColor >> 16) & 0xff;
  const tintG = (tintColor >> 8) & 0xff;
  const tintB = tintColor & 0xff;

  const r = lerpChannel(baseR, tintR, clampedFactor);
  const g = lerpChannel(baseG, tintG, clampedFactor);
  const b = lerpChannel(baseB, tintB, clampedFactor);

  return (r << 16) | (g << 8) | b;
}

function pickPaletteColor(tileType: string, palette: Record<string, number>): number {
  // Palette merges happen at call time so the renderer can reuse the React visual configuration when provided.
  return palette[tileType] ?? palette.default ?? fallbackPalette.default;
}

const SubmapRendererPixi: React.FC<SubmapRendererPixiProps> = ({
  dimensions,
  playerSubmapCoords,
  wfcGrid,
  caGrid,
  biomeBlendContext,
  seededFeatures,
  paletteOverrides,
  biomeTintColor,
  onHoverTile,
  onRenderMetrics,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  const renderGrid = useCallback(() => {
    if (!appRef.current) return;
    const startedAt = performance.now();
    const stage = appRef.current.stage;
    stage.eventMode = 'static'; // Ensures pointer events bubble for hover callbacks.
    const removed = stage.removeChildren();
    removed.forEach((child) => child.destroy({ children: true }));

    const container = new PIXI.Container();

    // Merge caller-provided palette overrides with the baked-in defaults so biome-specific colors flow into Pixi.
    const palette: Record<string, number> = {
      ...fallbackPalette,
      ...(paletteOverrides || {}),
    };

    const gridSource: string[][] = (() => {
      if (caGrid) return caGrid.map((row) => row.map((cell) => cell));
      if (wfcGrid) return wfcGrid;
      // Without procedural helpers, render a neutral base.
      return Array.from({ length: dimensions.rows }, () => Array(dimensions.cols).fill('default'));
    })();

    // Apply biome blending by nudging the base color toward a secondary biome hue when available.
    const biomeTint = biomeTintColor ?? (biomeBlendContext.secondaryBiomeId ? 0x223344 : 0x000000);
    const blendIntensity = biomeBlendContext.blendFactor;

    for (let y = 0; y < dimensions.rows; y++) {
      for (let x = 0; x < dimensions.cols; x++) {
        const tileType = gridSource[y]?.[x] || 'default';
        const sprite = new PIXI.Graphics();
        // Apply the same color vocabulary as the React renderer, then gently blend toward the neighbor biome tint.
        const color = pickPaletteColor(tileType, palette);
        const blendedColor = blendHex(color, biomeTint, blendIntensity);
        sprite.beginFill(blendedColor);
        sprite.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
        sprite.endFill();

        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;

        // Hover interactions are handled here to avoid DOM overhead.
        sprite.eventMode = 'static';
        sprite.on('pointerover', () => onHoverTile?.({ x, y }));
        sprite.on('pointerout', () => onHoverTile?.(null));

        container.addChild(sprite);
      }
    }

    // Draw seeded features scaled to their true size (rectangular or circular) so Pixi mirrors gameplay placement.
    seededFeatures.forEach((feature) => {
      const overlay = new PIXI.Graphics();
      overlay.lineStyle({
        color: 0xf39c12,
        width: 2,
        alpha: 0.7,
      });

      const diameter = feature.actualSize * 2 + 1; // Tiles covered from center in both directions.
      if (feature.config.shapeType === 'rectangular') {
        overlay.drawRect(
          (feature.x - feature.actualSize) * TILE_SIZE,
          (feature.y - feature.actualSize) * TILE_SIZE,
          diameter * TILE_SIZE,
          diameter * TILE_SIZE,
        );
      } else {
        overlay.drawCircle(
          feature.x * TILE_SIZE + TILE_SIZE / 2,
          feature.y * TILE_SIZE + TILE_SIZE / 2,
          feature.actualSize * TILE_SIZE,
        );
      }

      container.addChild(overlay);
    });

    // Player marker for spatial orientation.
    const playerMarker = new PIXI.Graphics();
    playerMarker.beginFill(0xe74c3c);
    playerMarker.drawCircle(
      playerSubmapCoords.x * TILE_SIZE + TILE_SIZE / 2,
      playerSubmapCoords.y * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE / 3,
    );
    playerMarker.endFill();
    container.addChild(playerMarker);

    stage.addChild(container);
    appRef.current.render();

    const elapsed = performance.now() - startedAt;
    onRenderMetrics?.({ lastMs: elapsed, fpsEstimate: elapsed > 0 ? 1000 / elapsed : 0 });
  }, [
    appRef,
    biomeBlendContext,
    biomeTintColor,
    caGrid,
    dimensions.cols,
    dimensions.rows,
    onHoverTile,
    onRenderMetrics,
    paletteOverrides,
    playerSubmapCoords.x,
    playerSubmapCoords.y,
    seededFeatures,
    wfcGrid,
  ]);

  useEffect(() => {
    // Initialize Pixi once on mount so the WebGL context is stable across prop changes.
    if (canvasRef.current && !appRef.current) {
      const app = new PIXI.Application({
        width: dimensions.cols * TILE_SIZE,
        height: dimensions.rows * TILE_SIZE,
        background: '#0b0b0b',
        antialias: true,
      });
      appRef.current = app;

      // PixiJS v8 uses 'canvas' instead of 'view' - check both for compatibility
      const canvasElement = (app.canvas || app.view) as HTMLCanvasElement;
      if (canvasElement) {
        canvasRef.current.appendChild(canvasElement);
      } else {
        console.error('PixiJS: Unable to get canvas element from application');
      }
    }

    return () => {
      // Destroy on unmount only; avoids recreating the WebGL context on every prop change.
      appRef.current?.destroy(true, true);
      appRef.current = null;
    };
    // We intentionally leave dependencies empty so initialization/cleanup only run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep the canvas in sync with submap dimension changes without reallocating the app.
    if (appRef.current) {
      appRef.current.renderer.resize(dimensions.cols * TILE_SIZE, dimensions.rows * TILE_SIZE);
    }
  }, [dimensions.cols, dimensions.rows]);

  useEffect(() => {
    // Trigger draw when inputs change but avoid tearing down the Pixi instance.
    if (appRef.current) {
      renderGrid();
    }
  }, [renderGrid]);

  return <div ref={canvasRef} className="w-full overflow-hidden" />;
};

export default SubmapRendererPixi;
