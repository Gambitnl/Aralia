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
import { describe, expect, it } from "vitest";
import { getDummyParty } from "../../data/dev/dummyCharacter";
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
