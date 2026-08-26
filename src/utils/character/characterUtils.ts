// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 26/08/2026, 13:52:48
 * Dependents: components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/CharacterSheet/Spellbook/SpellbookTab.tsx, components/DesignPreview/steps/raceDomain/leaves/astralElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/autognomeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/autumnEladrinRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/beastbornHumanRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/beasthideShifterRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blackDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/blueDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/brassDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/bronzeDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/chthonicTieflingRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/cloudGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/copperDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/deepGnomeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/draconbloodDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/drowHalfElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/drowRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fallenAasimarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/firbolgRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/fireGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/forestGnomeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/forgebornHumanRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/frostGiantGoliathRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/giffRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/githyankiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/githzeraiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/goblinRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/goldDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/grayDwarfDuergarRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/greenDragonbornRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/guardianHumanRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/hadozeeRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halfElfRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halfOrcRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/halflingRaceLeaf.tsx, components/Party/PartyPane/PartyMemberCard.tsx, services/premadeCharacterService.ts, systems/party/npcToPartyMember.ts, utils/character/characterValidation.ts, utils/character/index.ts, utils/character/spellAbilityFactory.ts, utils/character/spellUtils.ts, utils/combat/actionEconomyUtils.ts, utils/combat/combatUtils.ts, utils/sandbox/quickCharacterGenerator.ts, utils/spells/outOfCombatCasting.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL CONTEXT:
 * This file serves as the unified character lifecycle utility facade.
 *
 * To support clean modular architecture without breaking existing dependents,
 * it re-exports all character mechanics from dedicated domain submodules:
 * 1. `stats.ts`: Ability scores, modifiers, racial traits/spells, speed, darkvision, and derived stats.
 * 2. `defense.ts`: Armor Class calculation, armor/shield proficiencies, item equipping, and AC diffing.
 * 3. `progression.ts`: Leveling up, XP thresholds, ASIs, feats, Hit Dice, and spell capacity.
 * 4. `encumbrance.ts`: Carrying capacity, lift/push limits, and 5e variant encumbrance.
 *
 * Called by: CharacterSheet, PartyPane, CharacterCreator, combat engine, sandbox, and migration services.
 * Depends on: Pure domain submodules in src/utils/character/.
 * 
 * @file src/utils/character/characterUtils.ts
 */

// ============================================================================
// Domain Submodule Re-exports
// ============================================================================
// All functions, types, and constants are re-exported to maintain 100%
// backwards compatibility with existing import paths across the codebase.
// ============================================================================

export * from './stats';
export * from './defense';
export * from './progression';
export * from './encumbrance';

// Re-export explicit utilities from statUtils and getMaxPreparedSpells
export {
  getAbilityModifierValue,
  getAbilityModifierString,
  calculateFixedRacialBonuses,
  calculateFinalAbilityScores,
  calculatePassiveScore,
  calculateArmorClass,
  calculateFinalAC,
} from './statUtils';
export type {
  ACComponents,
  ACRelevantActiveEffect,
} from './statUtils';
export { getMaxPreparedSpells } from './getMaxPreparedSpells';
