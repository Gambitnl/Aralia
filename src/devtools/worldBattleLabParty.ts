// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 17:40:13
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file equips the World Battle Lab's development party with the same
 * level-one class packages used by character creation.
 *
 * The shared dummy characters intentionally serve several developer surfaces,
 * some of which need to inspect empty equipment states. The Battle Lab instead
 * needs combat-ready actors, so this adapter clones those characters, applies
 * canonical starting gear, and recalculates their armor class without mutating
 * the shared fixture.
 *
 * Called by: PreviewBattleMapScenarioLab.tsx before mounting BattleMapDemo
 * Depends on: getDummyParty, buildStartingLoadout, and calculateArmorClass
 */
import { getDummyParty } from "../data/dev/dummyCharacter";
import { buildStartingLoadout } from "../systems/character/buildStartingLoadout";
import type { PlayerCharacter } from "../types";
import { calculateArmorClass } from "../utils/character/statUtils";

// ============================================================================
// Battle Lab Party Assembly
// ============================================================================
// Every lab actor receives their class's real level-one package. The package is
// used as a complete set rather than merged with generic fixture equipment, so a
// two-handed starting weapon cannot accidentally retain an incompatible shield.
// ============================================================================

export function buildWorldBattleLabParty(
  sourceParty: readonly PlayerCharacter[] = getDummyParty(),
): PlayerCharacter[] {
  return sourceParty.map((character) => {
    // Use the same authored class package as the character creator so this
    // harness exercises real weapon, armor, shield, and proficiency data.
    const startingLoadout = buildStartingLoadout({
      classId: character.class.id,
      background: character.background,
      weaponMasteryIds: character.selectedWeaponMasteries,
    });
    const equippedCharacter: PlayerCharacter = {
      ...character,
      equippedItems: startingLoadout.equippedItems,
    };

    // Armor class is derived from the newly equipped armor rather than copied
    // from the unequipped dummy fixture, keeping the party rail and hit logic in
    // agreement with the equipment shown by combat.
    return {
      ...equippedCharacter,
      armorClass: calculateArmorClass(
        equippedCharacter,
        equippedCharacter.activeEffects,
      ),
    };
  });
}
