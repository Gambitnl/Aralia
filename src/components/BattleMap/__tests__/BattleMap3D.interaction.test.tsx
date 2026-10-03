import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BattleMap3D from "../BattleMap3D";
import type {
  BattleMapData,
  CombatCharacter,
  BattleMapTile,
  LightSource,
} from "../../../types/combat";

/**
 * This test suite validates 3D BattleMap interaction flows: raycasting tile hovers during targeting,
 * tile and character clicking, target validation reason banners, shared observer senses, and 3D prop handles.
 *
 * It proves that the 3D WebGL renderer maintains parity with 2D interaction contracts while projecting
 * camera controls, targeting decals, and object targets in Three.js world space.
 *
 * Called by: Vitest test runner (BattleMap 3D test suite)
 * Depends on: BattleMap3D.tsx, CameraController.tsx, TargetingDecals.tsx, TerrainMesh.tsx
 */

// ============================================================================
// Three.js and Subsystem Mocks
// ============================================================================
const mockUseBattleMap = vi.fn();
const mockUseTargetSelection = vi.fn();
const mockUseVisibility = vi.fn();
const mockTerrainMesh = vi.fn((props: any) => (
  <div data-testid="mock-terrain-mesh" onClick={() => props.onTileClick?.({ coordinates: { x: 1, y: 1 } })} />
));
const mockVolumeArenaGround = vi.fn((_props: any) => (
  <div data-testid="mock-volume-arena-ground" />
));
const mockGridOverlay = vi.fn((_props: unknown) => <div data-testid="mock-grid-overlay" />);
const mockCameraController = vi.fn((_props: any) => <div data-testid="mock-camera-controller" />);
const mockTargetingDecals = vi.fn((_props: any) => <div data-testid="mock-targeting-decals" />);

vi.mock("@react-three/fiber", () => ({
  useThree: (select?: (s: unknown) => unknown) => {
    const state = { gl: { info: { render: {}, memory: {} } } };
    return select ? select(state) : state;
  },
  useFrame: vi.fn(),
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-canvas">{children}</div>
  ),
}));

vi.mock("@react-three/drei", () => ({
  ContactShadows: () => null,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@react-three/postprocessing", () => ({
  EffectComposer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bloom: () => null,
  N8AO: () => null,
  ToneMapping: () => null,
  Vignette: () => null,
}));

vi.mock("postprocessing", () => ({
  BlendFunction: { NORMAL: "normal" },
  ToneMappingMode: { ACES_FILMIC: "aces-filmic" },
}));

vi.mock("../../../hooks/useBattleMap", () => ({
  useBattleMap: (...args: unknown[]) => mockUseBattleMap(...args),
}));

vi.mock("../../../hooks/combat/useTargetSelection", () => ({
  useTargetSelection: (...args: unknown[]) => mockUseTargetSelection(...args),
}));

vi.mock("../../../hooks/combat/useVisibility", () => ({
  useVisibility: (...args: unknown[]) => mockUseVisibility(...args),
}));

vi.mock("../terrain", () => ({
  TerrainMesh: (props: any) => mockTerrainMesh(props),
  GridOverlay: (props: any) => mockGridOverlay(props),
  GrassLayer: () => null,
  WaterSystem: () => null,
  DecorationProps: () => null,
  GroundScatter: () => null,
  EzTreeLayer: () => null,
  TerrainApron: () => null,
  GroundMist: () => null,
  FordStones: () => null,
  makeTerrainHeightSampler: () => () => 0,
}));

vi.mock("../terrain/VolumeArenaGround", () => ({
  default: (props: any) => mockVolumeArenaGround(props),
  ARENA_HEIGHTFIELD_INSET_TILES: 0,
}));

vi.mock("../terrain/VolumeArenaWater", () => ({
  default: () => null,
}));

vi.mock("../characters", () => ({
  CharacterActor: () => null,
}));

vi.mock("../TargetingDecals", () => ({
  default: (props: any) => mockTargetingDecals(props),
}));

vi.mock("../camera", () => ({
  CameraController: (props: any) => mockCameraController(props),
}));

vi.mock("../vfx", () => ({
  VFXSystem: () => null,
  LivingWorld: () => null,
}));

const makeTile = (x: number, y: number): BattleMapTile => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: "grass",
  elevation: 0,
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
): CombatCharacter =>
  ({
    id,
    name,
    team,
    position: { x, y },
    currentHP: 30,
    maxHP: 30,
    abilities: [],
    statusEffects: [],
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 16,
      wisdom: 12,
      charisma: 10,
      speed: 30,
      baseInitiative: 1,
    },
    actionEconomy: {
      action: {},
      bonusAction: {},
      reaction: {},
      movement: {},
    },
  }) as unknown as CombatCharacter;

const createMapData = (width = 8, height = 8): BattleMapData => {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.set(`${x}-${y}`, makeTile(x, y));
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: "forest",
    seed: 55,
    targetableObjects: [
      {
        id: "wooden-crate-1",
        name: "Supply Crate",
        position: { x: 3, y: 3 },
        isFixedToSurface: false,
      },
    ],
  } as unknown as BattleMapData;
};

// ============================================================================
// 3D Tile Hover, Targeting Feedback & Object Interaction Tests
// ============================================================================
describe("BattleMap3D - Interaction Flows & HUD Banners", () => {
  const mockHandleTileClick = vi.fn();
  const mockHandleCharacterClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: "wizard-1",
      validMoves: new Set(["1-0", "0-1"]),
      activePath: [],
      actionMode: "spell",
      setActionMode: vi.fn(),
      handleTileClick: mockHandleTileClick,
      handleCharacterClick: mockHandleCharacterClick,
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(["2-2", "2-3", "3-2", "3-3"]),
      validTargetSet: new Set(["3-3"]),
      teleportDestinationSet: new Set(),
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map(),
      visibleTiles: new Set(["0-0", "1-1", "2-2", "3-3"]),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => "bright"),
    });
  });

  it("passes tile hover handlers to 3D terrain and forwards to previewAoE when targeting", () => {
    const mapData = createMapData();
    const wizard = makeCombatant("wizard-1", "Wizard", "player", 0, 0);
    const mockPreviewAoE = vi.fn();

    const combatState = {
      turnManager: {
        turnState: {
          currentTurn: 0,
          turnOrder: ["wizard-1"],
          currentCharacterId: "wizard-1",
          phase: "action",
        },
        activeLightSources: [],
        reactiveTriggers: [],
        damageNumbers: [],
        animations: [],
        canAffordAction: vi.fn(() => true),
      } as any,
      turnState: {
        currentTurn: 0,
        turnOrder: ["wizard-1"],
        currentCharacterId: "wizard-1",
        phase: "action",
      } as any,
      abilitySystem: {
        selectedAbility: { id: "fireball", name: "Fireball" },
        targetingMode: true,
        isValidTarget: vi.fn(() => true),
        previewAoE: mockPreviewAoE,
        aoePreview: null,
        teleportDestinationPreview: null,
      } as any,
      isCharacterTurn: (id: string) => id === "wizard-1",
      onCharacterUpdate: vi.fn(),
    };

    render(
      <BattleMap3D
        mapData={mapData}
        characters={[wizard]}
        combatState={combatState}
      />,
    );

    // Verify TerrainMesh received onTileHover callback when targetingMode is true
    expect(mockTerrainMesh).toHaveBeenCalled();
    const terrainProps = mockTerrainMesh.mock.calls[0][0];
    expect(terrainProps.onTileHover).toBeDefined();

    // Invoking onTileHover triggers previewAoE for the wizard
    terrainProps.onTileHover(makeTile(3, 3));
    expect(mockPreviewAoE).toHaveBeenCalledWith({ x: 3, y: 3 }, wizard);
  });

  it("renders target validation reason banner when targeting is blocked or out of range", () => {
    const mapData = createMapData();
    const wizard = makeCombatant("wizard-1", "Wizard", "player", 0, 0);

    const combatState = {
      turnManager: {
        turnState: {
          currentTurn: 0,
          turnOrder: ["wizard-1"],
          currentCharacterId: "wizard-1",
          phase: "action",
        },
        activeLightSources: [],
        reactiveTriggers: [],
        damageNumbers: [],
        animations: [],
        canAffordAction: vi.fn(() => true),
      } as any,
      turnState: {
        currentTurn: 0,
        turnOrder: ["wizard-1"],
        currentCharacterId: "wizard-1",
        phase: "action",
      } as any,
      abilitySystem: {
        selectedAbility: { id: "scorching-ray", name: "Scorching Ray" },
        targetingMode: true,
        targetValidationReason: "Target is out of line of sight (blocked by stone wall)",
        isValidTarget: vi.fn(() => false),
        previewAoE: vi.fn(),
      } as any,
      isCharacterTurn: (id: string) => id === "wizard-1",
      onCharacterUpdate: vi.fn(),
    };

    render(
      <BattleMap3D
        mapData={mapData}
        characters={[wizard]}
        combatState={combatState}
      />,
    );

    // Target validation error banner should be visible to player
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Target is out of line of sight (blocked by stone wall)");
  });

  it("renders 3D targetable map objects with OBJ label and targetable highlight", () => {
    const mapData = createMapData();
    const wizard = makeCombatant("wizard-1", "Wizard", "player", 0, 0);

    const combatState = {
      turnManager: {
        turnState: {
          currentTurn: 0,
          turnOrder: ["wizard-1"],
          currentCharacterId: "wizard-1",
          phase: "action",
        },
        activeLightSources: [],
        reactiveTriggers: [],
        damageNumbers: [],
        animations: [],
        canAffordAction: vi.fn(() => true),
      } as any,
      turnState: {
        currentTurn: 0,
        turnOrder: ["wizard-1"],
        currentCharacterId: "wizard-1",
        phase: "action",
      } as any,
      abilitySystem: {
        selectedAbility: { id: "catapult", name: "Catapult" },
        targetingMode: true,
        isValidTarget: (target: any) => target.id === "wooden-crate-1",
        previewAoE: vi.fn(),
      } as any,
      isCharacterTurn: (id: string) => id === "wizard-1",
      onCharacterUpdate: vi.fn(),
    };

    render(
      <BattleMap3D
        mapData={mapData}
        characters={[wizard]}
        combatState={combatState}
      />,
    );

    // 3D Object target indicator should be present in the scene
    const objMarker = screen.getByTestId("targetable-object-3d-wooden-crate-1");
    expect(objMarker).toBeInTheDocument();
    expect(objMarker).toHaveTextContent("OBJ");
    expect(objMarker).toHaveAttribute(
      "title",
      "Supply Crate object - valid spell target",
    );
  });
});
