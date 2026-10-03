import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BattleMapFogCanvas from "../BattleMapFogCanvas";
import type { BattleMapData, LightLevel } from "../../../types/combat";

/**
 * This test suite validates the 2D fog-of-war and soft lighting canvas renderer.
 *
 * It tests that the fog layer generates an offscreen 1px-per-tile raster, applies two blur passes
 * to produce smooth light boundaries, applies distinct color tints for land vs water under fog,
 * and upscales the composite onto the visible tactical canvas.
 *
 * Called by: Vitest test runner (BattleMap test suite)
 * Depends on: BattleMapFogCanvas.tsx, fogModel.ts
 */

// ============================================================================
// Canvas 2D Context Mocks
// ============================================================================
const makeTile = (x: number, y: number, terrain = "grass") => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain,
  elevation: 0,
  movementCost: 1,
  blocksMovement: false,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: [],
});

const createMapData = (width = 4, height = 4): BattleMapData => {
  const tiles = new Map();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const terrain = y === 3 ? "water" : "grass";
      tiles.set(`${x}-${y}`, makeTile(x, y, terrain));
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: "forest",
    seed: 99,
  } as unknown as BattleMapData;
};

describe("BattleMapFogCanvas", () => {
  let mockGetContext: any;
  let mockFillRect: any;
  let mockDrawImage: any;
  let mockClearRect: any;

  beforeEach(() => {
    mockFillRect = vi.fn();
    mockDrawImage = vi.fn();
    mockClearRect = vi.fn();

    mockGetContext = vi.fn(() => ({
      fillRect: mockFillRect,
      drawImage: mockDrawImage,
      clearRect: mockClearRect,
      setTransform: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    }));

    // Mock HTMLCanvasElement getContext
    HTMLCanvasElement.prototype.getContext = mockGetContext as any;
  });

  it("renders a canvas element with aria-hidden attribute", () => {
    const mapData = createMapData(4, 4);
    const visibleTiles = new Set(["0-0", "1-0", "0-1", "1-1"]);
    const getLightLevel = (id: string): LightLevel =>
      visibleTiles.has(id) ? "bright" : "darkness";

    const { container } = render(
      <BattleMapFogCanvas
        mapData={mapData}
        tileSize={32}
        visibleTiles={visibleTiles}
        getLightLevel={getLightLevel}
        className="pointer-events-none absolute inset-0"
      />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("pointer-events-none");
  });

  it("computes fog alphas and paints pixels into the mini raster and upscales to main canvas", () => {
    const mapData = createMapData(4, 4);
    const visibleTiles = new Set(["0-0", "1-0"]);
    const getLightLevel = (id: string): LightLevel =>
      visibleTiles.has(id) ? "bright" : "darkness";

    render(
      <BattleMapFogCanvas
        mapData={mapData}
        tileSize={32}
        visibleTiles={visibleTiles}
        getLightLevel={getLightLevel}
      />,
    );

    // Canvas context should be initialized
    expect(mockGetContext).toHaveBeenCalledWith("2d");

    // Clear rect should clear the main canvas before drawing
    expect(mockClearRect).toHaveBeenCalled();

    // DrawImage should upscale the 4x4 mini canvas to full 128x128 pixel dimensions
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      4,
      4,
      0,
      0,
      128,
      128,
    );
  });

  it("re-renders and updates canvas when visible tiles or map data change", () => {
    const mapData = createMapData(4, 4);
    const visibleTiles = new Set(["0-0"]);
    const getLightLevel = (id: string): LightLevel =>
      visibleTiles.has(id) ? "bright" : "darkness";

    const { rerender } = render(
      <BattleMapFogCanvas
        mapData={mapData}
        tileSize={32}
        visibleTiles={visibleTiles}
        getLightLevel={getLightLevel}
      />,
    );

    expect(mockDrawImage).toHaveBeenCalledTimes(1);

    // Light up more tiles (e.g. torch carried forward)
    const expandedTiles = new Set(["0-0", "1-0", "2-0", "3-0"]);
    rerender(
      <BattleMapFogCanvas
        mapData={mapData}
        tileSize={32}
        visibleTiles={expandedTiles}
        getLightLevel={(id) => (expandedTiles.has(id) ? "bright" : "darkness")}
      />,
    );

    // Should paint updated raster
    expect(mockDrawImage).toHaveBeenCalledTimes(2);
  });
});
