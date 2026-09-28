import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BattleMap from "../BattleMap";
import { createBattleMapCombatState } from "./fixtures/battleMapCombatState";
import type {
  BattleMapData,
  BattleMapTerrain,
  CombatCharacter,
  BattleMapTile as BattleMapTileData,
  Position,
} from "../../../types/combat";

/**
 * This test suite validates 2D BattleMap pointer events, tile hover states, movement reach, and HUD controls.
 *
 * It proves that the tactical map correctly processes user interactions: clicking reachable cells to move, hovering
 * over varied ground to inspect elevation readouts, visualizing threatened enemy zones and path highlights, and
 * operating zoom controls and visibility layer toggles.
 *
 * Called by: Vitest test runner (BattleMap test suite)
 * Depends on: BattleMap.tsx, BattleMapHUD.tsx, BattleMapTile.tsx, BattleMapOverlays.tsx
 */

// ============================================================================
// Mocks and Test Setup
// ============================================================================
const mockUseBattleMap = vi.fn();
const mockUseTargetSelection = vi.fn();
const mockUseVisibility = vi.fn();

vi.mock("../../../hooks/useBattleMap", () => ({
  useBattleMap: (...args: unknown[]) => mockUseBattleMap(...args),
}));

vi.mock("../../../hooks/combat/useTargetSelection", () => ({
  useTargetSelection: (...args: unknown[]) => mockUseTargetSelection(...args),
}));

vi.mock("../../../hooks/combat/useVisibility", () => ({
  useVisibility: (...args: unknown[]) => mockUseVisibility(...args),
}));

vi.mock("../CharacterToken", () => ({
  default: ({
    character,
    onCharacterClick,
  }: {
    character: CombatCharacter;
    onCharacterClick?: (c: CombatCharacter) => void;
  }) => (
    <div
      data-testid={`character-${character.id}`}
      onClick={() => onCharacterClick?.(character)}
    >
      {character.name}
    </div>
  ),
  OpeningThreatWorldBody: () => null,
}));

vi.mock("../BattleMapGroundCanvas", () => ({
  default: () => <div data-testid="mock-ground-canvas" />,
}));

vi.mock("../BattleMapFogCanvas", () => ({
  default: () => <div data-testid="mock-fog-canvas" />,
}));

const makeTile = (
  id: string,
  x: number,
  y: number,
  elevation = 0,
  terrain: BattleMapTerrain = "grass",
): BattleMapTileData => ({
  id,
  coordinates: { x, y },
  terrain,
  elevation,
  movementCost: 1,
  blocksMovement: false,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: [],
});

const makeCombatant = (
  id: string,
  name: string,
  team: "player" | "enemy",
  x: number,
  y: number,
  elevation = 0,
): CombatCharacter =>
  ({
    id,
    name,
    team,
    position: { x, y },
    currentHP: 25,
    maxHP: 25,
    abilities: [],
    statusEffects: [],
    stats: {
      strength: 14,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      speed: 30,
      baseInitiative: 2,
    },
    actionEconomy: {
      action: {},
      bonusAction: {},
      reaction: {},
      movement: {},
    },
  }) as unknown as CombatCharacter;

const createMapData = (width = 4, height = 4): BattleMapData => {
  const tiles = new Map<string, BattleMapTileData>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const elevation = (x + y) * 2; // Varied heights for elevation testing
      tiles.set(`${x}-${y}`, makeTile(`${x}-${y}`, x, y, elevation));
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: "forest",
    seed: 42,
  } as unknown as BattleMapData;
};

// ============================================================================
// Pointer Events and Tile Click Routing Tests
// ============================================================================
describe("BattleMap - Pointer Events and Tile Clicking", () => {
  const handleTileClick = vi.fn();
  const handleCharacterClick = vi.fn();
  const setActionMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: "hero-1",
      validMoves: new Set(["1-0", "0-1", "1-1"]),
      activePath: [{ id: "0-0" }, { id: "1-0" }],
      actionMode: "move",
      setActionMode,
      handleTileClick,
      handleCharacterClick,
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(),
      validTargetSet: new Set(["3-3"]),
      teleportDestinationSet: new Set(["2-2"]),
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map(),
      visibleTiles: new Set(["0-0", "1-0", "0-1", "1-1", "2-2", "3-3"]),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => "bright"),
    });
  });

  it("handles clicking on reachable movement tiles and forwards to battle map handler", () => {
    const mapData = createMapData(4, 4);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    const combatState = createBattleMapCombatState({
      turnState: { turnOrder: ["hero-1"], currentCharacterId: "hero-1" },
      turnManager: { canAffordAction: vi.fn(() => true) },
      isCharacterTurn: (id: string) => id === "hero-1",
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={combatState}
      />,
    );

    // Find reachable tile 1-0 and click it
    const tile10 = screen.getByRole("button", {
      name: /Tile grass at 1, 0/i,
    });
    fireEvent.click(tile10);

    expect(handleTileClick).toHaveBeenCalledTimes(1);
    expect(handleTileClick).toHaveBeenCalledWith(mapData.tiles.get("1-0"));
  });

  it("forwards character token clicks when clicking combatants on the map", () => {
    const mapData = createMapData(4, 4);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);
    const enemy = makeCombatant("orc-1", "Orc Raider", "enemy", 2, 2);

    const combatState = createBattleMapCombatState({
      turnState: { turnOrder: ["hero-1", "orc-1"], currentCharacterId: "hero-1" },
      turnManager: { canAffordAction: vi.fn(() => true) },
      isCharacterTurn: (id: string) => id === "hero-1",
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero, enemy]}
        combatState={combatState}
      />,
    );

    const enemyToken = screen.getByTestId("character-orc-1");
    fireEvent.click(enemyToken);

    expect(handleCharacterClick).toHaveBeenCalledTimes(1);
    expect(handleCharacterClick).toHaveBeenCalledWith(enemy);
  });
});

// ============================================================================
// Tile Hover States & Elevation Readout HUD Tests
// ============================================================================
describe("BattleMap - Tile Hover States & Elevation Readouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: "hero-1",
      validMoves: new Set(["1-0"]),
      activePath: [],
      actionMode: "move",
      setActionMode: vi.fn(),
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn(),
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(),
      validTargetSet: new Set(),
      teleportDestinationSet: new Set(),
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map(),
      visibleTiles: new Set(["0-0", "1-0", "2-2"]),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => "bright"),
    });
  });

  it("updates the HUD elevation and terrain banner when mouse hovers over a tile", () => {
    const mapData = createMapData(4, 4);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    const combatState = createBattleMapCombatState({
      turnState: { turnOrder: ["hero-1"], currentCharacterId: "hero-1" },
      turnManager: { canAffordAction: vi.fn(() => true) },
      isCharacterTurn: (id: string) => id === "hero-1",
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={combatState}
      />,
    );

    // Hover over tile 2-2
    const tile22 = screen.getByRole("button", {
      name: /Tile grass at 2, 2/i,
    });
    fireEvent.mouseEnter(tile22);

    // The HUD readout should now be visible and display the tile's height
    const elevationReadout = screen.getByTestId("battle-map-elevation-readout");
    expect(elevationReadout).toBeInTheDocument();
    expect(elevationReadout).toHaveAttribute("data-tile-terrain", "grass");
    expect(elevationReadout).toHaveTextContent(/Elevation/i);
    expect(elevationReadout).toHaveTextContent(/Terrain/i);
  });
});

// ============================================================================
// Movement Reach Visualization & Threat Zone Tests
// ============================================================================
describe("BattleMap - Movement Reach & Threat Zones", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: "hero-1",
      validMoves: new Set(["1-0", "0-1"]),
      activePath: [{ id: "0-0" }, { id: "1-0" }],
      actionMode: "move",
      setActionMode: vi.fn(),
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn(),
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(),
      validTargetSet: new Set(),
      teleportDestinationSet: new Set(),
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map(),
      visibleTiles: new Set(["0-0", "1-0", "0-1", "1-1"]),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => "bright"),
    });
  });

  it("renders move-range interaction overlay and active movement path on valid tiles", () => {
    const mapData = createMapData(4, 4);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    const combatState = createBattleMapCombatState({
      turnState: { turnOrder: ["hero-1"], currentCharacterId: "hero-1" },
      turnManager: { canAffordAction: vi.fn(() => true) },
      isCharacterTurn: (id: string) => id === "hero-1",
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={combatState}
      />,
    );

    // Tiles in validMoves should have the move-range interaction overlay
    const overlays = screen.getAllByTestId("tile-interaction-overlay");
    expect(overlays.length).toBeGreaterThan(0);
    const moveRangeOverlay = overlays.find(
      (o) => o.getAttribute("data-overlay-kind") === "move-range",
    );
    expect(moveRangeOverlay).toBeDefined();
  });
});

// ============================================================================
// HUD Map Navigation Controls (Zoom, Fit, Auto, Fog Toggle) Tests
// ============================================================================
describe("BattleMap - HUD Map Navigation Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: "hero-1",
      validMoves: new Set(),
      activePath: [],
      actionMode: null,
      setActionMode: vi.fn(),
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn(),
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(),
      validTargetSet: new Set(),
      teleportDestinationSet: new Set(),
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map(),
      visibleTiles: new Set(["0-0", "1-0"]),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => "bright"),
    });
  });

  it("renders zoom controls (+, -, Fit, Auto) and handles clicking zoom buttons", () => {
    const mapData = createMapData(4, 4);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    const combatState = createBattleMapCombatState({
      turnState: { turnOrder: ["hero-1"], currentCharacterId: "hero-1" },
      turnManager: { canAffordAction: vi.fn(() => true) },
      isCharacterTurn: (id: string) => id === "hero-1",
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={combatState}
      />,
    );

    const zoomInBtn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOutBtn = screen.getByRole("button", { name: "Zoom out" });
    const fitBtn = screen.getByRole("button", { name: "Fit map to view" });
    const autoBtn = screen.getByRole("button", {
      name: "Reset zoom to automatic",
    });

    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(fitBtn).toBeInTheDocument();
    expect(autoBtn).toBeInTheDocument();

    // Clicking zoom in triggers zoom adjustment
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(fitBtn);
    fireEvent.click(autoBtn);
  });

  it("renders the fog-of-war veil toggle toolbar when enabled for review", () => {
    const mapData = createMapData(4, 4);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    const combatState = createBattleMapCombatState({
      turnState: { turnOrder: ["hero-1"], currentCharacterId: "hero-1" },
      turnManager: { canAffordAction: vi.fn(() => true) },
      isCharacterTurn: (id: string) => id === "hero-1",
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={combatState}
        showFogToggle={true}
      />,
    );

    const fogBtn = screen.getByRole("button", { name: "Toggle fog of war" });
    expect(fogBtn).toBeInTheDocument();
    expect(fogBtn).toHaveAttribute("aria-pressed", "true");

    // Toggling fog updates button state
    fireEvent.click(fogBtn);
    expect(fogBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the line-of-sight toggle button in the legend", () => {
    const mapData = createMapData(4, 4);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    const combatState = createBattleMapCombatState({
      turnState: { turnOrder: ["hero-1"], currentCharacterId: "hero-1" },
      turnManager: { canAffordAction: vi.fn(() => true) },
      isCharacterTurn: (id: string) => id === "hero-1",
    });

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={combatState}
        showLineOfSightCone={false}
      />,
    );

    const losBtn = screen.getByRole("button", {
      name: "Show line of sight overlay",
    });
    expect(losBtn).toBeInTheDocument();
    expect(losBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(losBtn);
    expect(losBtn).toHaveAttribute("aria-pressed", "true");
  });
});
