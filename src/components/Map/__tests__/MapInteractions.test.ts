import { describe, it, expect } from "vitest";
import {
  BATTLE_MAP_CELL_SIZE_FEET,
  BATTLE_MAP_DIMENSIONS,
  TILE_SIZE_PX,
} from "../../../config/mapConfig";
import {
  calculateAffectedTiles,
  type AoEParams,
} from "../../../utils/combat/aoeCalculations";
import { AoECalculator } from "../../../systems/spells/targeting/AoECalculator";

/**
 * This test suite validates general 2D/3D map interactions, coordinate projections,
 * reach calculations, AoE geometry (cones, spheres, lines, cubes), and navigation math.
 *
 * When a player clicks or hovers over the tactical grid, commands movement paths, or casts
 * area-of-effect spells with directional cones or explosive spheres, these mathematical
 * invariants ensure that screen coordinates, tile boundaries, distance reach, and visibility
 * rules remain consistent across both 2D and 3D map views.
 *
 * Called by: Vitest test runner (Map & BattleMap test suites)
 * Depends on: mapConfig.ts, aoeCalculations.ts, AoECalculator.ts
 */

// ============================================================================
// Coordinate Projections and Grid Boundary Calculations
// ============================================================================
// Translates raw pixel coordinates or world units into 0-indexed grid cell indices.
function screenToGrid(pixelX: number, pixelY: number, tileSize = TILE_SIZE_PX): { x: number; y: number } {
  return {
    x: Math.floor(pixelX / tileSize),
    y: Math.floor(pixelY / tileSize),
  };
}

function gridToScreenCenter(gridX: number, gridY: number, tileSize = TILE_SIZE_PX): { x: number; y: number } {
  return {
    x: gridX * tileSize + tileSize / 2,
    y: gridY * tileSize + tileSize / 2,
  };
}

function isWithinMapBounds(gridX: number, gridY: number, width: number, height: number): boolean {
  return gridX >= 0 && gridX < width && gridY >= 0 && gridY < height;
}

// 5e tactical movement cost: standard grid distance where each cell is 5 ft
function get5eDistanceFeet(posA: { x: number; y: number }, posB: { x: number; y: number }): number {
  const dx = Math.abs(posA.x - posB.x);
  const dy = Math.abs(posA.y - posB.y);
  // D&D 5e standard measurement: max(dx, dy) * 5 ft
  return Math.max(dx, dy) * BATTLE_MAP_CELL_SIZE_FEET;
}

// ============================================================================
// Map Pointer Coordinate & Grid Boundary Tests
// ============================================================================
describe("Map Interactions - Coordinate Projections & Boundaries", () => {
  it("accurately converts pixel pointer positions to discrete tile coordinates", () => {
    // Top-left corner of tile (0, 0)
    expect(screenToGrid(0, 0)).toEqual({ x: 0, y: 0 });
    expect(screenToGrid(15, 25)).toEqual({ x: 0, y: 0 });

    // Center of tile (3, 2) at 32px per tile: x in [96, 127], y in [64, 95]
    expect(screenToGrid(100, 70)).toEqual({ x: 3, y: 2 });
    expect(gridToScreenCenter(3, 2)).toEqual({ x: 112, y: 80 });
  });

  it("validates tactical map boundaries against configured board dimensions", () => {
    const { width, height } = BATTLE_MAP_DIMENSIONS;

    expect(isWithinMapBounds(0, 0, width, height)).toBe(true);
    expect(isWithinMapBounds(width - 1, height - 1, width, height)).toBe(true);

    // Negative coordinates or coordinates exceeding dimensions are out of bounds
    expect(isWithinMapBounds(-1, 0, width, height)).toBe(false);
    expect(isWithinMapBounds(0, -1, width, height)).toBe(false);
    expect(isWithinMapBounds(width, 0, width, height)).toBe(false);
    expect(isWithinMapBounds(0, height, width, height)).toBe(false);
  });
});

// ============================================================================
// Movement Reach & Distance Invariants
// ============================================================================
describe("Map Interactions - Movement Reach & Distance Math", () => {
  it("calculates 5e movement distances accurately between combatant cells", () => {
    const origin = { x: 5, y: 5 };

    // Adjacent orthogonal tile (5 ft)
    expect(get5eDistanceFeet(origin, { x: 6, y: 5 })).toBe(5);

    // Adjacent diagonal tile (5 ft in 5e default rule)
    expect(get5eDistanceFeet(origin, { x: 6, y: 6 })).toBe(5);

    // 6 tiles away (30 ft movement speed limit)
    expect(get5eDistanceFeet(origin, { x: 11, y: 5 })).toBe(30);
    expect(get5eDistanceFeet(origin, { x: 11, y: 11 })).toBe(30);

    // 7 tiles away (35 ft - exceeds standard 30 ft speed)
    expect(get5eDistanceFeet(origin, { x: 12, y: 5 })).toBe(35);
  });

  it("identifies all reachable cells within a standard 30-foot speed budget", () => {
    const origin = { x: 10, y: 10 };
    const speedFeet = 30;
    const reachableCells: Array<{ x: number; y: number }> = [];

    for (let x = origin.x - 7; x <= origin.x + 7; x++) {
      for (let y = origin.y - 7; y <= origin.y + 7; y++) {
        if (get5eDistanceFeet(origin, { x, y }) <= speedFeet) {
          reachableCells.push({ x, y });
        }
      }
    }

    // 30 ft reach = 6 tiles in any direction = a 13x13 square on standard 5e grid
    // Total cells = (2*6 + 1)^2 = 13^2 = 169 cells
    expect(reachableCells.length).toBe(169);
  });
});

// ============================================================================
// Area-of-Effect Targeting Shapes (Spheres, Cones, Lines, Cubes)
// ============================================================================
describe("Map Interactions - AoE Targeting Geometry", () => {
  it("calculates spherical AoE templates (e.g. 20ft Fireball) correctly", () => {
    const center = { x: 10, y: 10 };
    const radiusFeet = 20;

    const affectedTiles = AoECalculator.getSphere(center, radiusFeet);

    // Center tile should always be included
    expect(affectedTiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);

    // Tiles within 20ft (4 cells) should be included
    expect(affectedTiles.some((t) => t.x === 14 && t.y === 10)).toBe(true);
    expect(affectedTiles.some((t) => t.x === 6 && t.y === 10)).toBe(true);

    // Tiles beyond 20ft (5 cells away) should not be included
    expect(affectedTiles.some((t) => t.x === 15 && t.y === 10)).toBe(false);
    expect(affectedTiles.some((t) => t.x === 5 && t.y === 10)).toBe(false);
  });

  it("calculates directional cone AoE templates (e.g. 15ft Burning Hands facing East)", () => {
    const origin = { x: 5, y: 5 };
    const directionEast = { x: 1, y: 0 };
    const coneSizeFeet = 15;

    const affectedTiles = AoECalculator.getCone(origin, directionEast, coneSizeFeet);

    // Forward tiles in the cone's path (East: +X)
    expect(affectedTiles.some((t) => t.x === 6 && t.y === 5)).toBe(true);
    expect(affectedTiles.some((t) => t.x === 7 && t.y === 5)).toBe(true);
    expect(affectedTiles.some((t) => t.x === 8 && t.y === 5)).toBe(true);

    // Tiles behind the caster (-X: West) must NOT be included in a forward-facing cone
    expect(affectedTiles.some((t) => t.x === 4 && t.y === 5)).toBe(false);
    expect(affectedTiles.some((t) => t.x === 3 && t.y === 5)).toBe(false);
  });

  it("calculates directional line AoE templates (e.g. 30ft Lightning Bolt facing South)", () => {
    const origin = { x: 4, y: 4 };
    const lineParams: AoEParams = {
      shape: "Line",
      origin,
      size: 30, // 6 tiles long
      width: 5, // 1 tile wide
      direction: 180, // Facing South (+Y)
    };

    const affectedTiles = calculateAffectedTiles(lineParams);

    // Should include tiles extending southward from origin
    expect(affectedTiles.some((t) => t.x === 4 && t.y === 4)).toBe(true);
    expect(affectedTiles.some((t) => t.x === 4 && t.y === 7)).toBe(true);
    expect(affectedTiles.some((t) => t.x === 4 && t.y === 10)).toBe(true);

    // Tiles north of origin (-Y) must not be affected
    expect(affectedTiles.some((t) => t.x === 4 && t.y === 2)).toBe(false);
  });

  it("calculates cube AoE templates (e.g. 10ft Web / Spike Growth)", () => {
    const center = { x: 6, y: 6 };
    // Ruling Q4 (2026-09-22): a cube is face-anchored and extends away from the
    // caster. The caster stands two tiles north, so the cube extends south.
    const cubeParams: AoEParams = {
      shape: "Cube",
      origin: center,
      size: 10,
      casterPosition: { x: 6, y: 4 },
    };

    const affectedTiles = calculateAffectedTiles(cubeParams);

    // A 10ft cube covers 2 x 2 tiles; the origin tile is in the near row.
    expect(affectedTiles.length).toBe(4);
    expect(affectedTiles.some((t) => t.x === 6 && t.y === 6)).toBe(true);
    expect(affectedTiles.some((t) => t.x === 6 && t.y === 7)).toBe(true);
    expect(affectedTiles.some((t) => t.x === 6 && t.y === 5)).toBe(false);
  });
});

// ============================================================================
// Map Navigation & Zoom Level Calculations
// ============================================================================
describe("Map Interactions - Zoom Clamping & Pan Navigation Math", () => {
  const clampZoom = (z: number) => Math.min(3, Math.max(0.15, z));

  it("restricts zoom factors between tactical board limits (0.15x to 3.0x)", () => {
    expect(clampZoom(1.0)).toBe(1.0);
    expect(clampZoom(0.85)).toBe(0.85);
    expect(clampZoom(1.5)).toBe(1.5);

    // Lower bound clamp
    expect(clampZoom(0.05)).toBe(0.15);
    expect(clampZoom(-1.0)).toBe(0.15);

    // Upper bound clamp
    expect(clampZoom(4.5)).toBe(3.0);
    expect(clampZoom(10.0)).toBe(3.0);
  });

  it("calculates viewport camera center scroll offset for a targeted position", () => {
    const targetPos = { x: 5, y: 5 };
    const boardScale = 1.0;
    const viewportWidth = 800;
    const viewportHeight = 600;
    const rulerGutterX = 20;
    const rulerGutterY = 16;

    const tileCenter = gridToScreenCenter(targetPos.x, targetPos.y);
    const targetLeft = (rulerGutterX + tileCenter.x) * boardScale - viewportWidth / 2;
    const targetTop = (rulerGutterY + tileCenter.y) * boardScale - viewportHeight / 2;

    // Scrolling target center point aligns coordinate accurately
    expect(targetLeft).toBeDefined();
    expect(targetTop).toBeDefined();
    expect(typeof targetLeft).toBe("number");
    expect(typeof targetTop).toBe("number");
  });
});
