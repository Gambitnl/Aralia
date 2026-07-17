import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BattleMap from "../BattleMap";
import type {
  BattleMapData,
  CombatCharacter,
  LightSource,
} from "../../../types/combat";

/**
 * This test is the 2D side of the battle-map parity proof.
 *
 * It does not try to retest combat rules. It proves that the 2D renderer still
 * receives the shared hook outputs that drive movement highlights, target
 * highlighting, AoE / teleport overlays, and the CombatView-owned map-update
 * surface.
 */

const mockUseBattleMap = vi.fn();
const mockUseTargetSelection = vi.fn();
const mockUseVisibility = vi.fn();
const mockBattleMapOverlay = vi.fn((_props: unknown) => (
  <div data-testid="battle-map-overlay" />
));

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
  default: ({ character }: { character: CombatCharacter }) => (
    <div data-testid={`character-${character.id}`} />
  ),
  OpeningThreatWorldBody: ({ source }: { source: { entityId: string } }) => (
    <div
      data-testid="opening-aftermath-body-fact"
      data-source-entity-id={source.entityId}
    />
  ),
}));

vi.mock("../BattleMapOverlay", () => ({
  default: (props: unknown) => mockBattleMapOverlay(props),
}));

const makeTile = (id: string, x: number, y: number) => ({
  id,
  coordinates: { x, y },
  terrain: "floor",
  elevation: 0,
  movementCost: 1,
  blocksMovement: false,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: [],
});

describe("BattleMap parity proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBattleMap.mockReturnValue({
      selectedCharacterId: "hero",
      validMoves: new Set(["1-0"]),
      activePath: [{ id: "0-0" }],
      actionMode: "move",
      setActionMode: vi.fn(),
      handleTileClick: vi.fn(),
      handleCharacterClick: vi.fn(),
    });

    mockUseTargetSelection.mockReturnValue({
      aoeSet: new Set(["0-1"]),
      validTargetSet: new Set(["2-0"]),
      teleportDestinationSet: new Set(["1-1"]),
    });

    mockUseVisibility.mockReturnValue({
      lightLevels: new Map([
        ["0-0", "bright"],
        ["1-0", "bright"],
        ["2-0", "bright"],
        ["0-1", "bright"],
        ["1-1", "bright"],
        ["2-1", "bright"],
      ]),
      visibleTiles: new Set(["0-0", "1-0", "2-0", "0-1", "1-1", "2-1"]),
      canSeeTile: vi.fn(() => true),
      getLightLevel: vi.fn(() => "bright"),
    });
  });

  it("keeps the same shared state visible as tile movement, target, AoE, and teleport highlights", () => {
    const hero: CombatCharacter = {
      id: "hero",
      name: "Hero",
      team: "player",
      position: { x: 0, y: 0 },
      currentHP: 10,
      maxHP: 10,
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
    } as unknown as CombatCharacter;
    const enemy: CombatCharacter = {
      ...hero,
      id: "enemy",
      name: "Enemy",
      team: "enemy",
      position: { x: 2, y: 0 },
    };
    const lightSource: LightSource = {
      id: "light-1",
      sourceSpellId: "light",
      casterId: hero.id,
      brightRadius: 20,
      dimRadius: 20,
      attachedTo: "caster",
      attachedToCharacterId: hero.id,
      createdTurn: 0,
    };

    render(
      <BattleMap
        mapData={
          {
            dimensions: { width: 3, height: 2 },
            tiles: new Map([
              ["0-0", makeTile("0-0", 0, 0)],
              ["1-0", makeTile("1-0", 1, 0)],
              ["2-0", makeTile("2-0", 2, 0)],
              ["0-1", makeTile("0-1", 0, 1)],
              ["1-1", makeTile("1-1", 1, 1)],
              ["2-1", makeTile("2-1", 2, 1)],
            ]),
            theme: "forest",
            seed: 1,
          } as unknown as BattleMapData
        }
        characters={[hero, enemy]}
        combatState={{
          turnManager: {
            turnState: {
              currentTurn: 0,
              turnOrder: [hero.id, enemy.id],
              currentCharacterId: hero.id,
              phase: "action",
              actionsThisTurn: [],
            },
            activeLightSources: [lightSource],
            reactiveTriggers: [],
            damageNumbers: [],
            animations: [],
            spellZones: [
              {
                id: "zone-1",
                spellId: "web",
                casterId: hero.id,
                position: { x: 0, y: 1 },
                areaOfEffect: { type: "circle", radius: 1 },
                direction: "north",
                effects: [],
              },
            ],
            scheduledSpellEffects: [],
            movementDebuffs: [],
            spellMovementVisuals: [],
            spellDeliveryVisuals: [],
            canAffordAction: vi.fn(() => true),
          } as unknown as React.ComponentProps<
            typeof BattleMap
          >["combatState"]["turnManager"],
          turnState: {
            currentTurn: 0,
            turnOrder: [hero.id, enemy.id],
            currentCharacterId: hero.id,
            phase: "action",
            actionsThisTurn: [],
          } as unknown as React.ComponentProps<
            typeof BattleMap
          >["combatState"]["turnState"],
          abilitySystem: {
            targetingMode: true,
            selectedAbility: {
              id: "fireball",
              name: "Fireball",
              range: 6,
            } as any,
            aoePreview: {
              center: { x: 0, y: 1 },
              affectedTiles: [{ x: 0, y: 1 }],
              ability: { id: "fireball", name: "Fireball", range: 6 } as any,
            },
            teleportDestinationPreview: {
              targetId: enemy.id,
              affectedTiles: [{ x: 1, y: 1 }],
              ability: {
                id: "misty-step",
                name: "Misty Step",
                range: 30,
              } as any,
            },
            targetValidationReason: "This spell can only target enemies.",
            pendingTeleportAssignment: {
              ability: { name: "Misty Step" },
              destinationsByTargetId: {
                [enemy.id]: { x: 1, y: 1 },
              },
            },
            previewAoE: vi.fn(),
            isValidTarget: vi.fn(),
            cancelTargeting: vi.fn(),
            startTargeting: vi.fn(),
          } as unknown as React.ComponentProps<
            typeof BattleMap
          >["combatState"]["abilitySystem"],
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn(),
        }}
      />,
    );

    const moveTile = screen.getByRole("button", { name: "Tile floor at 1, 0" });
    const pathTile = screen.getByRole("button", { name: "Tile floor at 0, 0" });
    const targetTile = screen.getByRole("button", {
      name: "Tile floor at 2, 0",
    });
    const aoeTile = screen.getByRole("button", { name: "Tile floor at 0, 1" });
    const teleportTile = screen.getByRole("button", {
      name: "Tile floor at 1, 1",
    });

    // Reachability remains a real per-cell state, but the visual hierarchy now
    // uses a quiet interior plus perimeter instead of a dominant green wash.
    const moveOverlay = moveTile.querySelector(
      '[data-overlay-kind="move-range"]',
    );
    expect(moveOverlay).toBeInTheDocument();
    expect(moveOverlay).toHaveClass("bg-emerald-400/[0.07]");
    expect(pathTile.querySelector(".bg-emerald-300\\/60")).toBeInTheDocument();
    expect(targetTile.querySelector(".bg-rose-500\\/40")).toBeInTheDocument();
    expect(aoeTile.querySelector(".bg-orange-500\\/55")).toBeInTheDocument();
    expect(teleportTile.querySelector(".bg-sky-400\\/55")).toBeInTheDocument();
    expect(
      screen.getByText("This spell can only target enemies."),
    ).toBeInTheDocument();

    expect(mockBattleMapOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        mapData: expect.any(Object),
        characters: expect.arrayContaining([
          expect.objectContaining({ id: hero.id }),
          expect.objectContaining({ id: enemy.id }),
        ]),
        activeLightSources: [lightSource],
        spellZones: expect.arrayContaining([
          expect.objectContaining({ id: "zone-1" }),
        ]),
        aoePreview: expect.objectContaining({
          center: { x: 0, y: 1 },
          affectedTiles: [{ x: 0, y: 1 }],
        }),
        teleportDestinationPreview: expect.objectContaining({
          targetId: enemy.id,
          affectedTiles: [{ x: 1, y: 1 }],
        }),
        assignedTeleportDestinations: [
          expect.objectContaining({
            targetId: enemy.id,
            targetName: "Enemy",
            destination: { x: 1, y: 1 },
            abilityName: "Misty Step",
          }),
        ],
      }),
    );
  });

  it("renders source-authored opening ecology and physical combat aftermath", () => {
    const hero = {
      id: "opening-hero",
      name: "Opening Hero",
      team: "player",
      position: { x: 1, y: 1 },
      currentHP: 10,
      maxHP: 10,
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
    } as unknown as CombatCharacter;
    const mapData = {
      dimensions: { width: 3, height: 3 },
      tiles: new Map(
        Array.from({ length: 9 }, (_, index) => {
          const x = index % 3;
          const y = Math.floor(index / 3);
          return [`${x}-${y}`, makeTile(`${x}-${y}`, x, y)];
        }),
      ),
      theme: "forest",
      seed: 42,
      encounterContext: {
        kind: "opening-standoff",
        source: "worldforge-opening",
        sourceReceiptId: "opening:42:cell:476",
        sourceSceneReceiptId: "worldforge-opening-scene:test",
        sceneContinuity: "resolved-return",
        sourceWorldCellId: 476,
        anchorTile: { x: 1, y: 1 },
        approachDirection: { x: -0.8, y: 0.6 },
        sourceEntities: [
          {
            kind: "worldforge-opening-threat",
            sceneReceiptId: "worldforge-opening-scene:test",
            sourceOpeningReceiptId: "opening:42:cell:476",
            entityId: "opening:goblin:1",
            monsterName: "Goblin",
            monsterOrdinal: 1,
            socialRole: "contact-lead",
            worldGroundMeters: { x: 103, z: 202 },
            position: { x: 2, y: 2 },
          },
        ],
        ecologicalTraces: [
          {
            id: "opening-tracks",
            kind: "tracks",
            ageBand: "weathered",
            label: "Churned tracks from the north-east",
            position: { x: 2, y: 0 },
            worldGroundMeters: { x: 102, z: 198 },
            sourceEntityIds: ["opening:goblin:1"],
          },
          {
            id: "opening-disturbed-growth",
            kind: "disturbed-vegetation",
            ageBand: "recent",
            label: "Crushed fern screen",
            position: { x: 2, y: 1 },
            worldGroundMeters: { x: 103, z: 200 },
            sourceEntityIds: ["opening:goblin:2"],
          },
          {
            id: "opening-scent-mark",
            kind: "territorial-scrape",
            ageBand: "fresh",
            label: "Wolf territorial scrape",
            position: { x: 2, y: 2 },
            worldGroundMeters: { x: 104, z: 202 },
            sourceEntityIds: ["opening:wolf:1"],
          },
        ],
        terrainImprints: [
          {
            id: "opening-flattened-ground",
            kind: "flattened-ground",
            label: "Flattened sorting hollow",
            position: { x: 0, y: 2 },
            endPosition: { x: 0, y: 2 },
            worldGroundMeters: { x: 99, z: 202 },
            endWorldGroundMeters: { x: 99, z: 202 },
            direction: { x: 1, y: 0 },
            extentCells: { length: 3, width: 2 },
            ageBand: "recent",
            sourceEntityIds: ["opening:goblin:1"],
            activitySiteId: "worldforge-opening-scene:test:activity-site:1",
          },
          {
            id: "opening-trampled-run",
            kind: "trampled-run",
            label: "Trampled lane to the contact line",
            position: { x: 0, y: 2 },
            endPosition: { x: 2, y: 2 },
            worldGroundMeters: { x: 99, z: 202 },
            endWorldGroundMeters: { x: 103, z: 202 },
            direction: { x: 1, y: 0 },
            extentCells: { length: 2, width: 1 },
            ageBand: "fresh",
            sourceEntityIds: ["opening:goblin:1"],
            activitySiteId: "worldforge-opening-scene:test:activity-site:1",
          },
          {
            id: "opening-drag-furrow",
            kind: "drag-furrow",
            label: "Dragged salvage furrow",
            position: { x: 2, y: 0 },
            endPosition: { x: 0, y: 2 },
            worldGroundMeters: { x: 102, z: 198 },
            endWorldGroundMeters: { x: 99, z: 202 },
            direction: { x: -0.707106, y: 0.707106 },
            extentCells: { length: 2.8, width: 0.5 },
            ageBand: "recent",
            sourceEntityIds: ["opening:goblin:1"],
            activitySiteId: "worldforge-opening-scene:test:activity-site:1",
          },
          {
            id: "opening-refuse-scatter",
            kind: "refuse-scatter",
            label: "Sorted refuse beside the cache",
            position: { x: 1, y: 2 },
            endPosition: { x: 1, y: 2 },
            worldGroundMeters: { x: 101, z: 202 },
            endWorldGroundMeters: { x: 101, z: 202 },
            direction: { x: 0, y: 1 },
            extentCells: { length: 1.5, width: 1 },
            ageBand: "fresh",
            sourceEntityIds: ["opening:goblin:1"],
            activitySiteId: "worldforge-opening-scene:test:activity-site:1",
          },
        ],
        activitySite: {
          id: "worldforge-opening-scene:test:activity-site:1",
          kind: "claimed-cache",
          label: "Abandoned claimed scavenger cache",
          position: { x: 0, y: 2 },
          worldGroundMeters: { x: 99, z: 202 },
          ageBand: "fresh",
          claimedByEntityIds: [],
          contents: ["salvaged-container", "torn-bedding", "gnawed-remains"],
        },
        sceneResolution: {
          outcome: "party-victory",
          resolvedAtGameTimeMs: 123456,
          entityOutcomes: [
            {
              sourceEntityId: "opening:goblin:1",
              combatantId: "combat-goblin-1",
              status: "downed",
              finalHitPoints: 0,
              finalTacticalPosition: { x: 2, y: 2 },
              lastSeenWorldGroundMeters: { x: 103, z: 202 },
            },
          ],
          activitySiteCondition: "abandoned-disturbed",
          combatDisturbance: {
            kind: "combat-churn",
            position: { x: 2, y: 2 },
            worldGroundMeters: { x: 103, z: 202 },
            direction: { x: 1, y: 0 },
            extentCells: { length: 3, width: 2.4 },
            severity: "heavy",
            sourceEntityIds: ["opening:goblin:1"],
          },
        },
        deployment: {
          player: "current-position",
          enemy: "resolved-source-bodies",
        },
        omittedFacts: {
          preContactHistory: "not-authored",
        },
      },
    } as BattleMapData;

    render(
      <BattleMap
        mapData={mapData}
        characters={[hero]}
        combatState={{
          turnManager: {
            turnState: {
              currentTurn: 0,
              turnOrder: [hero.id],
              currentCharacterId: hero.id,
              phase: "action",
              actionsThisTurn: [],
            },
            activeLightSources: [],
            reactiveTriggers: [],
            damageNumbers: [],
            animations: [],
            spellZones: [],
            scheduledSpellEffects: [],
            movementDebuffs: [],
            spellMovementVisuals: [],
            spellDeliveryVisuals: [],
            canAffordAction: vi.fn(() => true),
          } as unknown as React.ComponentProps<
            typeof BattleMap
          >["combatState"]["turnManager"],
          turnState: {
            currentTurn: 0,
            turnOrder: [hero.id],
            currentCharacterId: hero.id,
            phase: "action",
            actionsThisTurn: [],
          } as unknown as React.ComponentProps<
            typeof BattleMap
          >["combatState"]["turnState"],
          abilitySystem: {
            targetingMode: false,
            cancelTargeting: vi.fn(),
            startTargeting: vi.fn(),
            isValidTarget: vi.fn(),
          } as unknown as React.ComponentProps<
            typeof BattleMap
          >["combatState"]["abilitySystem"],
          isCharacterTurn: vi.fn(() => false),
          onCharacterUpdate: vi.fn(),
        }}
      />,
    );

    expect(
      screen.queryByLabelText(/marks the party's exact source-world position/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Churned tracks from the north-east"),
    ).toHaveAttribute("data-trace-kind", "tracks");
    expect(
      screen.getByLabelText("Churned tracks from the north-east"),
    ).toHaveAttribute("data-trace-age", "weathered");
    expect(screen.getByLabelText("Crushed fern screen")).toHaveAttribute(
      "data-trace-kind",
      "disturbed-vegetation",
    );
    expect(screen.getByLabelText("Wolf territorial scrape")).toHaveAttribute(
      "data-trace-kind",
      "territorial-scrape",
    );
    expect(screen.getByTestId("opening-track-trail")).toBeInTheDocument();
    expect(screen.getByTestId("opening-terrain-imprints")).toBeInTheDocument();
    expect(screen.getAllByTestId("opening-terrain-imprint")).toHaveLength(4);
    expect(screen.getByLabelText("Flattened sorting hollow")).toHaveAttribute(
      "data-imprint-kind",
      "flattened-ground",
    );
    expect(screen.getByLabelText("Dragged salvage furrow")).toHaveAttribute(
      "data-imprint-kind",
      "drag-furrow",
    );
    expect(
      screen.getByLabelText(
        "Abandoned claimed scavenger cache; abandoned-disturbed WorldForge activity site",
      ),
    ).toHaveAttribute("data-site-condition", "abandoned-disturbed");
    expect(screen.getByTestId("opening-combat-disturbance")).toHaveAttribute(
      "data-disturbance-severity",
      "heavy",
    );
    expect(screen.getByTestId("opening-aftermath-body-fact")).toHaveAttribute(
      "data-source-entity-id",
      "opening:goblin:1",
    );
  });
});
