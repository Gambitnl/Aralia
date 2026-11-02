/**
 * This file protects the World Battle Lab's starting-party equipment contract.
 *
 * It proves that the lab adapter leaves the shared dummy fixture untouched while
 * producing class-appropriate armor and a real main-hand attack for every party
 * member. That final combat conversion is the behavior the player actually sees
 * in the ability palette, so the test checks it rather than stopping at item data.
 *
 * Exercises: worldBattleLabParty.ts and the production player-to-combat adapter
 */
import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDummyParty } from "../../data/dev/dummyCharacter";
import { useAbilitySystem } from "../../hooks/useAbilitySystem";
import type { BattleMapData } from "../../types/combat";
import type { Spell } from "../../types/spells";
import { canAffordActionCost } from "../../utils/combat/actionEconomyUtils";
import { createPlayerCombatCharacter } from "../../utils/combat/combatUtils";
import { buildWorldBattleLabParty } from "../worldBattleLabParty";

// ============================================================================
// Starting Equipment Contract
// ============================================================================
// The named assertions make accidental changes to authored class packages
// visible, while the per-character combat assertion prevents any future party
// member from silently falling back to Unarmed Strike.
// ============================================================================

describe("buildWorldBattleLabParty", () => {
  it("equips the named lab party from canonical class packages", () => {
    const party = buildWorldBattleLabParty();
    const equipmentByCharacter = Object.fromEntries(
      party.map((character) => [
        character.id,
        {
          mainHand: character.equippedItems.MainHand?.id,
          torso: character.equippedItems.Torso?.id,
          offHand: character.equippedItems.OffHand?.id,
        },
      ]),
    );

    expect(equipmentByCharacter.player).toEqual({
      mainHand: "greatsword",
      torso: "chain_mail",
      offHand: undefined,
    });
    expect(equipmentByCharacter.kaelen_thorne).toEqual({
      mainHand: "shortsword",
      torso: "leather_armor",
      offHand: undefined,
    });
    expect(equipmentByCharacter.elara_vance).toEqual({
      mainHand: "mace",
      torso: "chain_shirt",
      offHand: "shield_std",
    });
    expect(equipmentByCharacter.maelis_quill).toEqual({
      mainHand: "quarterstaff",
      torso: undefined,
      offHand: undefined,
    });
  });

  it("creates a visible weapon attack for every lab party member", () => {
    const party = buildWorldBattleLabParty();

    for (const character of party) {
      // This is the same adapter BattleMapDemo calls. Verifying the resulting
      // ability catches equipment that exists in data but never reaches combat.
      const combatant = createPlayerCombatCharacter({
        ...character,
        // Spell hydration belongs to SpellContext and is unrelated to this
        // equipment contract. Omitting the spellbook keeps this unit test
        // focused and avoids warnings from deliberately absent spell fixtures.
        spellbook: undefined,
      });
      const mainHandAttack = combatant.abilities.find(
        (ability) => ability.id === "attack_main",
      );

      expect(
        mainHandAttack?.name,
        `${character.name} should enter the lab with a weapon attack`,
      ).toBe(character.equippedItems.MainHand?.name);
      expect(combatant.abilities.some((ability) => ability.id === "unarmed_strike"))
        .toBe(false);
      expect(character.armorClass).toBeGreaterThan(10);
    }
  });

  it("hydrates Misty Step on the level-3 Wizard and builds a teleport destination preview when targeting (GG-131)", () => {
    // Load the real Misty Step spell asset from the spell corpus so the test
    // exercises production spell-to-ability translation and targeting.
    const mistyStepSpell = JSON.parse(
      readFileSync("public/data/spells/level-2/misty-step.json", "utf8"),
    ) as Spell;
    const allSpells: Record<string, Spell> = {
      [mistyStepSpell.id]: mistyStepSpell,
    };

    const party = buildWorldBattleLabParty();
    const maelis = party.find((member) => member.id === "maelis_quill");
    expect(maelis).toBeDefined();
    expect(maelis?.level).toBe(3);

    const combatant = {
      ...createPlayerCombatCharacter(maelis!, allSpells),
      position: { x: 2, y: 2 },
    };
    const mistyStepAbility = combatant.abilities.find(
      (ability) => ability.id === "misty-step",
    );

    expect(mistyStepAbility).toBeDefined();
    expect(mistyStepAbility?.name).toBe("Misty Step");
    expect(mistyStepAbility?.targeting).toBe("self");
    expect(canAffordActionCost(combatant, mistyStepAbility!.cost)).toBe(true);

    // Build a 10x10 open battle map and drive the real useAbilitySystem +
    // useTargeting hooks to verify that starting targeting with Misty Step
    // populates teleportDestinationPreview instead of auto-casting on self.
    const mapData: BattleMapData = {
      dimensions: { width: 10, height: 10 },
      theme: "forest",
      seed: 1,
      tiles: new Map(
        Array.from({ length: 100 }, (_, index) => {
          const x = index % 10;
          const y = Math.floor(index / 10);
          const id = `${x}-${y}`;
          return [
            id,
            {
              id,
              coordinates: { x, y },
              terrain: "grass",
              elevation: 0,
              movementCost: 5,
              blocksMovement: false,
              blocksLoS: false,
              decoration: null,
              effects: [],
            },
          ];
        }),
      ),
    };

    const { result } = renderHook(() =>
      useAbilitySystem({
        characters: [combatant],
        mapData,
        onExecuteAction: vi.fn(),
        onCharacterUpdate: vi.fn(),
        onLogEntry: vi.fn(),
      }),
    );

    act(() => {
      result.current.startTargeting(mistyStepAbility!, combatant);
    });

    expect(result.current.targetingMode).toBe(true);
    expect(result.current.selectedAbility?.id).toBe("misty-step");
    expect(result.current.teleportDestinationPreview).not.toBeNull();
    expect(result.current.teleportDestinationPreview?.targetId).toBe(
      combatant.id,
    );
    expect(
      result.current.teleportDestinationPreview?.affectedTiles.length,
    ).toBeGreaterThan(0);
    expect(result.current.teleportDestinationPreview?.affectedTiles).toContainEqual({
      x: 3,
      y: 2,
    });
  });

  it("does not mutate the shared dummy party", () => {
    const sharedParty = getDummyParty();
    const equipmentBeforeBuild = sharedParty.map((character) => ({
      ...character.equippedItems,
    }));

    buildWorldBattleLabParty(sharedParty);

    // The scoped adapter must not change other developer tools that deliberately
    // use the generic dummy fixture with their own equipment expectations.
    expect(sharedParty.map((character) => character.equippedItems)).toEqual(
      equipmentBeforeBuild,
    );
  });
});
