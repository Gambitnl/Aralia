import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BattleMapOverlays from "../BattleMapOverlays";
import type {
  BattleMapData,
  CombatCharacter,
  LightSource,
  Ability,
  SpellMovementVisual,
} from "../../../types/combat";
import type { ActiveSpellZone } from "../../../systems/spells/effects/triggerHandler";

/**
 * This test suite validates tactical overlays: active spell zones, teleport destinations,
 * forced movement / blink lines, light source radius rings, and line-of-sight cones.
 *
 * When an active Web or Bonfire stays on the ground, when a misty step or dimension door is targeted,
 * or when a light spell is cast, this overlay layer is responsible for rendering the spell templates,
 * warning indicators, and lighting boundaries accurately on the grid.
 *
 * Called by: Vitest test runner (BattleMap test suite)
 * Depends on: BattleMapOverlays.tsx, BattleMapOverlay.tsx, triggerHandler.ts
 */

// ============================================================================
// Fixtures and Setup
// ============================================================================
const makeTile = (x: number, y: number) => ({
  id: `${x}-${y}`,
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

const createMapData = (width = 6, height = 6): BattleMapData => {
  const tiles = new Map();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.set(`${x}-${y}`, makeTile(x, y));
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: "dungeon",
    seed: 123,
    targetableObjects: [
      {
        id: "prop-brazier",
        name: "Bronze Brazier",
        position: { x: 1, y: 1 },
        isFixedToSurface: true,
        source: { kind: "worldforge-prop" } as any,
      },
    ],
  } as unknown as BattleMapData;
};

// ============================================================================
// Persistent Active Spell Zones & Visual Families
// ============================================================================
describe("BattleMapOverlays - Persistent Spell Zones", () => {
  it("renders persistent active spell zones across multiple visual families (fire, ice, web, difficult terrain)", () => {
    const mapData = createMapData(6, 6);
    const wizard = makeCombatant("wiz-1", "Wizard", "player", 0, 0);

    const activeZones: ActiveSpellZone[] = [
      {
        id: "zone-bonfire",
        spellId: "create-bonfire",
        casterId: "wiz-1",
        position: { x: 3, y: 3 },
        areaOfEffect: { shape: "Square", size: 5 }, direction: { x: 1, y: 0 },
        effects: [
          {
            type: "DAMAGE",
            damage: { dice: "1d8", type: "fire" },
          } as any,
        ],
        triggeredThisTurn: new Set(),
        triggeredEver: new Set(),
      },
      {
        id: "zone-web",
        spellId: "web",
        casterId: "wiz-1",
        position: { x: 1, y: 1 },
        areaOfEffect: { shape: "Square", size: 10 }, direction: { x: 1, y: 0 },
        effects: [
          {
            type: "TERRAIN",
            terrainType: "difficult",
          } as any,
        ],
        triggeredThisTurn: new Set(),
        triggeredEver: new Set(),
      },
    ];

    render(
      <BattleMapOverlays
        mapData={mapData}
        characters={[wizard]}
        boardScale={1}
        worldOccupantGroups={[]}
        openingTrackMarks={[]}
        encounterMarker={null}
        encounterDirection={null}
        spellZones={activeZones}
      />,
    );

    // Active zones render ground tiles matching their visual styles
    const bonfireTile = screen.getByTitle(/create-bonfire fire zone/i);
    expect(bonfireTile).toBeInTheDocument();

    const webTiles = screen.getAllByTitle(/web difficult terrain zone/i);
    expect(webTiles).toHaveLength(4);
  });
});

// ============================================================================
// Teleport Destination Previews and Assigned Destinations
// ============================================================================
describe("BattleMapOverlays - Teleport Destinations", () => {
  it("renders teleport destination preview tiles and assigned multi-target destinations", () => {
    const mapData = createMapData(6, 6);
    const wizard = makeCombatant("wiz-1", "Wizard", "player", 0, 0);
    const rogue = makeCombatant("rogue-1", "Rogue", "player", 1, 0);

    const teleportPreview = {
      targetId: "wiz-1",
      affectedTiles: [
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ],
      ability: {
        id: "misty-step",
        name: "Misty Step",
      } as unknown as Ability,
    };

    const assignedDestinations = [
      {
        targetId: "rogue-1",
        targetName: "Rogue",
        destination: { x: 4, y: 4 },
        abilityName: "Dimension Door",
      },
    ];

    render(
      <BattleMapOverlays
        mapData={mapData}
        characters={[wizard, rogue]}
        boardScale={1}
        worldOccupantGroups={[]}
        openingTrackMarks={[]}
        encounterMarker={null}
        encounterDirection={null}
        teleportDestinationPreview={teleportPreview as any}
        assignedTeleportDestinations={assignedDestinations}
      />,
    );

    // Teleport preview displays destination indicator for Wizard
    expect(
      screen.getByText("DEST: Wizard"),
    ).toBeInTheDocument();

    // Assigned destination displays badge for Rogue
    expect(
      screen.getByText("SET: Rogue"),
    ).toBeInTheDocument();
  });
});

// ============================================================================
// Light Source Markers & Line-of-Sight Cones
// ============================================================================
describe("BattleMapOverlays - Light Sources & Line-of-Sight", () => {
  it("renders bright and dim light source radius markers", () => {
    const mapData = createMapData(6, 6);
    const hero = makeCombatant("hero-1", "Hero", "player", 2, 2);

    const lightSources: LightSource[] = [
      {
        id: "light-torch",
        sourceSpellId: "torch",
        casterId: "hero-1",
        brightRadius: 20, // 4 tiles
        dimRadius: 20, // 4 tiles
        attachedTo: "caster",
        attachedToCharacterId: "hero-1",
        createdTurn: 0,
      },
    ];

    render(
      <BattleMapOverlays
        mapData={mapData}
        characters={[hero]}
        boardScale={1}
        worldOccupantGroups={[]}
        openingTrackMarks={[]}
        encounterMarker={null}
        encounterDirection={null}
        activeLightSources={lightSources}
        showLightSourceMarkers={true}
      />,
    );

    // Light source rings should render with title detailing the radii
    const brightLight = screen.getByTitle("torch bright light (20 ft)");
    const dimLight = screen.getByTitle("torch dim light (20 ft)");
    const lightCenter = screen.getByTitle("torch light source");

    expect(brightLight).toBeInTheDocument();
    expect(dimLight).toBeInTheDocument();
    expect(lightCenter).toBeInTheDocument();
  });

  it("renders the line-of-sight cone when enabled for the active combatant", () => {
    const mapData = createMapData(6, 6);
    const hero = makeCombatant("hero-1", "Hero", "player", 2, 2);

    render(
      <BattleMapOverlays
        mapData={mapData}
        characters={[hero]}
        boardScale={1}
        worldOccupantGroups={[]}
        openingTrackMarks={[]}
        encounterMarker={null}
        encounterDirection={null}
        lineOfSightOverlayVisible={true}
        currentCharacterId="hero-1"
      />,
    );

    // The line of sight cone tiles should be in the document
    const losConeTiles = screen.getAllByTitle("line-of-sight cone");
    expect(losConeTiles.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Target-Bound Effects, Delayed Punishments, and Prop Harness Markers
// ============================================================================
describe("BattleMapOverlays - Target-Bound Effects & Object Facts", () => {
  it("renders scheduled delay and movement trigger debuff badges on target tiles", () => {
    const mapData = createMapData(6, 6);
    const enemy = makeCombatant("goblin-1", "Goblin", "enemy", 3, 3);

    const scheduledEffects = [
      {
        id: "sched-1",
        spellId: "delayed-blast",
        casterId: "wiz-1",
        targetId: "goblin-1",
        timing: "turn_start" as const,
        effects: [],
        createdAtRound: 1,
      },
    ];

    const movementDebuffs = [
      {
        id: "boom-1",
        spellId: "booming-blade",
        casterId: "wiz-1",
        targetId: "goblin-1",
      },
    ];

    render(
      <BattleMapOverlays
        mapData={mapData}
        characters={[enemy]}
        boardScale={1}
        worldOccupantGroups={[]}
        openingTrackMarks={[]}
        encounterMarker={null}
        encounterDirection={null}
        scheduledSpellEffects={scheduledEffects as any}
        movementDebuffs={movementDebuffs as any}
      />,
    );

    // Badges DELAY and MOVE should render
    expect(screen.getByText("DELAY")).toBeInTheDocument();
    expect(screen.getByText("MOVE")).toBeInTheDocument();
  });

  it("renders targetable object fact review indicators when enabled", () => {
    const mapData = createMapData(6, 6);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    render(
      <BattleMapOverlays
        mapData={mapData}
        characters={[hero]}
        boardScale={1}
        worldOccupantGroups={[]}
        openingTrackMarks={[]}
        encounterMarker={null}
        encounterDirection={null}
        showTargetableObjectFacts={true}
      />,
    );

    const factMarker = screen.getByTestId("targetable-object-fact-marker");
    expect(factMarker).toBeInTheDocument();
    expect(factMarker).toHaveAttribute("data-source-kind", "worldforge-prop");
  });

  it("renders forced movement and teleport visual paths with BLINK and PUSH badges", () => {
    const mapData = createMapData(6, 6);
    const hero = makeCombatant("hero-1", "Hero", "player", 0, 0);

    const spellMovementVisuals: SpellMovementVisual[] = [
      {
        id: "move-teleport-1",
        spellId: "misty-step",
        type: "teleport",
        targetId: 'actor', createdAt: 0,
        from: { x: 0, y: 0 },
        to: { x: 3, y: 3 },
      },
      {
        id: "move-push-1",
        spellId: "thunderwave",
        type: "forced_movement",
        targetId: 'actor', createdAt: 0,
        from: { x: 1, y: 1 },
        to: { x: 1, y: 4 },
      },
    ];

    render(
      <BattleMapOverlays
        mapData={mapData}
        characters={[hero]}
        boardScale={1}
        worldOccupantGroups={[]}
        openingTrackMarks={[]}
        encounterMarker={null}
        encounterDirection={null}
        spellMovementVisuals={spellMovementVisuals}
      />,
    );

    expect(screen.getByText("BLINK")).toBeInTheDocument();
    expect(screen.getByText("PUSH")).toBeInTheDocument();
  });
});
