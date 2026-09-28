/**
 * agora-db71.3: BattleMapOverlays declared `aoePreview` and
 * `teleportDestinationPreview` as `Position[] | null`, while its own child
 * BattleMapOverlay reads `.affectedTiles`, `.ability`, and `.targetId` off an
 * OBJECT — the object BattleMap has always passed straight from the ability
 * system. The runtime was correct and the intermediate declaration was the
 * defect, which is why layers/BattleMapMarkerLayer had to cast at the seam.
 *
 * These specs pin the corrected contract from both sides. The props are passed
 * as typed objects with NO cast, so the file stops compiling if the declaration
 * regresses to an array; and the rendered output is asserted, so the fix cannot
 * be "typed right, drawn wrong".
 *
 * Called by: Vitest test runner (BattleMap suite)
 * Depends on: BattleMapOverlays.tsx, BattleMapOverlay.tsx
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BattleMapOverlays, {
  type BattleMapOverlaysProps,
} from "../BattleMapOverlays";
import type {
  Ability,
  BattleMapData,
  CombatCharacter,
} from "../../../types/combat";

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
  } as unknown as BattleMapData;
};

const makeCombatant = (
  id: string,
  name: string,
  x: number,
  y: number,
): CombatCharacter =>
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
    actionEconomy: { action: {}, bonusAction: {}, reaction: {}, movement: {} },
  }) as unknown as CombatCharacter;

/* Tailwind's slash-bearing class names need escaping in a CSS selector, which
 * jsdom's selector engine handles poorly; match on the class attribute instead. */
const AOE_OUTLINE_SELECTOR =
  'div[class*="border-red-300"][class*="bg-red-400"]';

const fireball = { id: "fireball", name: "Fireball" } as unknown as Ability;
const mistyStep = { id: "misty-step", name: "Misty Step" } as unknown as Ability;

/**
 * Declared against the prop types themselves. If either prop reverts to
 * `Position[] | null` these two constants stop type-checking, which is the
 * half of this regression a render assertion cannot catch.
 */
const aoePreview: BattleMapOverlaysProps["aoePreview"] = {
  center: { x: 2, y: 2 },
  affectedTiles: [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 2, y: 3 },
  ],
  ability: fireball,
};

const teleportDestinationPreview: BattleMapOverlaysProps["teleportDestinationPreview"] =
  {
    targetId: "wiz-1",
    affectedTiles: [
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ],
    ability: mistyStep,
  };

const renderOverlays = (
  extra: Partial<BattleMapOverlaysProps>,
  characters: CombatCharacter[],
) =>
  render(
    <BattleMapOverlays
      mapData={createMapData()}
      characters={characters}
      boardScale={1}
      worldOccupantGroups={[]}
      openingTrackMarks={[]}
      encounterMarker={null}
      encounterDirection={null}
      {...extra}
    />,
  );

describe("BattleMapOverlays preview prop contract", () => {
  it("forwards the AoE preview object and outlines every affected tile", () => {
    const wizard = makeCombatant("wiz-1", "Wizard", 0, 0);
    const { container } = renderOverlays({ aoePreview }, [wizard]);

    const outlines = container.querySelectorAll(AOE_OUTLINE_SELECTOR);
    expect(outlines).toHaveLength(aoePreview!.affectedTiles.length);
  });

  it("forwards the teleport preview object and labels the creature it belongs to", () => {
    const wizard = makeCombatant("wiz-1", "Wizard", 1, 1);
    renderOverlays({ teleportDestinationPreview }, [wizard]);

    // The label is driven by .targetId resolving against the character list and
    // by .ability.name in its tooltip — both fields the old array type erased.
    const label = screen.getByText("DEST: Wizard");
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute(
      "title",
      "Misty Step needs a destination for Wizard",
    );
  });

  it("draws neither preview when both are absent", () => {
    const wizard = makeCombatant("wiz-1", "Wizard", 0, 0);
    const { container } = renderOverlays({}, [wizard]);

    expect(
      container.querySelectorAll(AOE_OUTLINE_SELECTOR),
    ).toHaveLength(0);
    expect(screen.queryByText("DEST: Wizard")).not.toBeInTheDocument();
  });
});
