import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBattleMapPointer } from "../useBattleMapPointer";
import type {
  BattleMapData,
  CombatCharacter,
  BattleMapTile as BattleMapTileData,
  Position,
} from "../../../../types/combat";

/**
 * This test suite validates the pointer, hover, zoom, and camera-centering hook for the 2D battle map.
 *
 * When a player hovers over tactical cells, clicks to move or cast spells, zooms the battlefield with the mouse wheel,
 * or switches between combatants, this hook coordinates all the math. It ensures that clicking a movable torch moves the
 * prop instead of the character, that hovering over a tile while aiming an area-of-effect spell updates the spell preview,
 * and that zooming or focusing camera requests center smoothly on the intended grid coordinates.
 *
 * Called by: Vitest test runner (BattleMap test suite)
 * Depends on: useBattleMapPointer.ts, useBattleMap, useTurnManager, useAbilitySystem
 */

// ============================================================================
// Mocks and Test Fixtures
// ============================================================================
// We mock the underlying useBattleMap hook to control movement and action modes
// without needing a full combat engine simulation.
const mockHandleTileClick = vi.fn();
const mockHandleCharacterClick = vi.fn();
const mockSetActionMode = vi.fn();

vi.mock("../../../../hooks/useBattleMap", () => ({
  useBattleMap: () => ({
    selectedCharacterId: "hero-1",
    validMoves: new Set(["1-0", "0-1"]),
    activePath: [{ id: "0-0" }],
    actionMode: "move",
    setActionMode: mockSetActionMode,
    handleTileClick: mockHandleTileClick,
    handleCharacterClick: mockHandleCharacterClick,
  }),
}));

const makeTile = (x: number, y: number, blocksMovement = false): BattleMapTileData => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: "grass",
  elevation: 0,
  movementCost: 1,
  blocksMovement,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: [],
});

const makeCharacter = (id: string, name: string, x: number, y: number): CombatCharacter =>
  ({
    id,
    name,
    team: "player",
    position: { x, y },
    currentHP: 20,
    maxHP: 20,
    abilities: [],
    statusEffects: [],
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      speed: 30,
      baseInitiative: 0,
    },
    actionEconomy: {
      action: {},
      bonusAction: {},
      reaction: {},
      movement: {},
    },
  }) as unknown as CombatCharacter;

const makeMapData = (width = 10, height = 10): BattleMapData => {
  const tiles = new Map<string, BattleMapTileData>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.set(`${x}-${y}`, makeTile(x, y));
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: "forest",
    seed: 12345,
    targetableObjects: [
      {
        id: "torch-1",
        name: "Carried Torch",
        position: { x: 2, y: 2 },
        isFixedToSurface: false,
      },
    ],
  } as unknown as BattleMapData;
};

// ============================================================================
// Pointer Interaction Tests
// ============================================================================
describe("useBattleMapPointer - Pointer & Click Interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes standard tile clicks directly to the underlying battle map handler", () => {
    const mapData = makeMapData();
    const hero = makeCharacter("hero-1", "Hero", 0, 0);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockAbilitySystem = { previewAoE: vi.fn(), targetingMode: false } as any;

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
      }),
    );

    const targetTile = makeTile(1, 0);
    act(() => {
      result.current.handleObjectAwareTileClick(targetTile);
    });

    // Clicking an ordinary tile without an active movable object should command
    // the character to walk or act there.
    expect(mockHandleTileClick).toHaveBeenCalledTimes(1);
    expect(mockHandleTileClick).toHaveBeenCalledWith(targetTile);
  });

  it("intercepts tile clicks to move an active sandbox object when one is selected", () => {
    const mapData = makeMapData();
    const hero = makeCharacter("hero-1", "Hero", 0, 0);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockAbilitySystem = { previewAoE: vi.fn(), targetingMode: false } as any;
    const mockOnObjectMove = vi.fn();
    const mockOnObjectSelect = vi.fn();

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
        objectInteraction: {
          activeObjectId: "torch-1",
          movableObjectIds: ["torch-1"],
          onObjectSelect: mockOnObjectSelect,
          onObjectMove: mockOnObjectMove,
        },
      }),
    );

    const targetTile = makeTile(3, 4);
    act(() => {
      result.current.handleObjectAwareTileClick(targetTile);
    });

    // When the sandbox torch is selected, clicking a tile should relocate the torch
    // instead of moving the character token.
    expect(mockOnObjectMove).toHaveBeenCalledTimes(1);
    expect(mockOnObjectMove).toHaveBeenCalledWith("torch-1", { x: 3, y: 4 });
    expect(mockHandleTileClick).not.toHaveBeenCalled();
  });

  it("ignores object moves when the destination tile blocks movement", () => {
    const mapData = makeMapData();
    const hero = makeCharacter("hero-1", "Hero", 0, 0);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockAbilitySystem = { previewAoE: vi.fn(), targetingMode: false } as any;
    const mockOnObjectMove = vi.fn();
    const mockOnObjectSelect = vi.fn();

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
        objectInteraction: {
          activeObjectId: "torch-1",
          movableObjectIds: ["torch-1"],
          onObjectSelect: mockOnObjectSelect,
          onObjectMove: mockOnObjectMove,
        },
      }),
    );

    const wallTile = makeTile(3, 4, true); // blocks movement
    act(() => {
      result.current.handleObjectAwareTileClick(wallTile);
    });

    // Objects cannot be placed inside solid stone walls or impassable terrain obstacles.
    expect(mockOnObjectMove).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tile Hover & AoE Preview Tests
// ============================================================================
describe("useBattleMapPointer - Tile Hover & AoE Targeting Previews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates hoveredTile state and triggers live AoE preview when in targeting mode", () => {
    const mapData = makeMapData();
    const hero = makeCharacter("hero-1", "Hero", 2, 2);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockPreviewAoE = vi.fn();
    const mockAbilitySystem = {
      previewAoE: mockPreviewAoE,
      targetingMode: true,
    } as any;

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
      }),
    );

    const hoverTarget = makeTile(5, 5);
    act(() => {
      result.current.handleTileHover(hoverTarget);
    });

    // Hovering a tile updates the elevation readout data and tells the spell
    // system to project the spell cone or sphere centered on that cell.
    expect(result.current.hoveredTile).toEqual(hoverTarget);
    expect(mockPreviewAoE).toHaveBeenCalledTimes(1);
    expect(mockPreviewAoE).toHaveBeenCalledWith({ x: 5, y: 5 }, hero);
  });

  it("updates hoveredTile but skips AoE preview when not in targeting mode", () => {
    const mapData = makeMapData();
    const hero = makeCharacter("hero-1", "Hero", 2, 2);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockPreviewAoE = vi.fn();
    const mockAbilitySystem = {
      previewAoE: mockPreviewAoE,
      targetingMode: false,
    } as any;

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
      }),
    );

    const hoverTarget = makeTile(4, 4);
    act(() => {
      result.current.handleTileHover(hoverTarget);
    });

    // Normal movement hover updates the HUD elevation label without computing spell cones.
    expect(result.current.hoveredTile).toEqual(hoverTarget);
    expect(mockPreviewAoE).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Board Zoom & Fit Scaling Tests
// ============================================================================
describe("useBattleMapPointer - Zoom Scaling & Fit Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adjusts userZoom when zoomBy is invoked and clamps within safe bounds", () => {
    const mapData = makeMapData();
    const hero = makeCharacter("hero-1", "Hero", 0, 0);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockAbilitySystem = { previewAoE: vi.fn(), targetingMode: false } as any;

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
      }),
    );

    // Initial scale defaults to 1 when fitScale is not constrained
    expect(result.current.boardScale).toBe(1);

    // Zooming in by 1.25 increases the scale
    act(() => {
      result.current.zoomBy(1.25);
    });
    expect(result.current.userZoom).toBeCloseTo(1.25);
    expect(result.current.boardScale).toBeCloseTo(1.25);

    // Extreme zoom in is clamped to 3.0 maximum
    act(() => {
      result.current.zoomBy(10.0);
    });
    expect(result.current.userZoom).toBe(3.0);

    // Extreme zoom out is clamped to 0.15 minimum
    act(() => {
      result.current.zoomBy(0.01);
    });
    expect(result.current.userZoom).toBe(0.15);

    // Resetting zoom with setUserZoom(null) returns control to automatic scale
    act(() => {
      result.current.setUserZoom(null);
    });
    expect(result.current.userZoom).toBeNull();
    expect(result.current.boardScale).toBe(1);
  });
});

// ============================================================================
// Camera Centering & Focus Request Tests
// ============================================================================
describe("useBattleMapPointer - Camera Centering & Roster Focus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports centering requests on specific characters and coordinates", () => {
    const mapData = makeMapData(20, 20);
    const hero = makeCharacter("hero-1", "Hero", 10, 10);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockAbilitySystem = { previewAoE: vi.fn(), targetingMode: false } as any;

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
      }),
    );

    // Provide mock DOM elements for wrap ref
    const mockScrollTo = vi.fn();
    const mockWrap = {
      clientWidth: 800,
      clientHeight: 600,
      scrollTo: mockScrollTo,
    } as unknown as HTMLDivElement;

    // Attach wrap ref
    (result.current.fitWrapRef as any).current = mockWrap;

    // Request centering on hero position
    act(() => {
      result.current.centerBoardOnCharacter(hero);
    });

    // Centering schedules an animation frame scrollTo call
    expect(result.current.requestCameraCenter).toBeDefined();
    expect(result.current.centerBoardOnPosition).toBeDefined();
  });

  it("listens for global custom event 'aralia:battle-map-center-character' to refocus camera", () => {
    const mapData = makeMapData(20, 20);
    const hero = makeCharacter("hero-1", "Hero", 5, 5);
    const ally = makeCharacter("ally-2", "Ally", 12, 14);
    const mockTurnManager = {} as any;
    const mockTurnState = { currentCharacterId: "hero-1", turnOrder: ["hero-1"] } as any;
    const mockAbilitySystem = { previewAoE: vi.fn(), targetingMode: false } as any;

    const { result } = renderHook(() =>
      useBattleMapPointer({
        mapData,
        characters: [hero, ally],
        turnManager: mockTurnManager,
        turnState: mockTurnState,
        abilitySystem: mockAbilitySystem,
      }),
    );

    // Dispatch custom event as if the player clicked a unit in the side initiative tracker
    act(() => {
      const event = new CustomEvent("aralia:battle-map-center-character", {
        detail: { characterId: "ally-2" },
      });
      window.dispatchEvent(event);
    });

    // Resetting user zoom allows auto-centering onto the requested ally
    expect(result.current.userZoom).toBeNull();
  });
});
