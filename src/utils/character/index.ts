// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 26/08/2026, 13:55:09
 * Dependents: commands/effects/AttackRollModifierCommand.ts, commands/effects/DamageCommand.ts, commands/effects/DefensiveCommand.ts, commands/effects/ElementalBaneCommand.ts, commands/effects/GraspingVineCommand.ts, commands/effects/StatusConditionCommand.ts, components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/Class/ArtificerFeatureSelection.tsx, components/CharacterCreator/FeatSelection.tsx, components/CharacterCreator/FeatSpellPicker.tsx, components/CharacterCreator/NameAndReview.tsx, components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx, components/CharacterCreator/hooks/useCharacterAssembly.ts, components/CharacterCreator/randomizeCreation.ts, components/CharacterCreator/state/characterCreatorState.ts, components/CharacterSheet/CharacterSheetModal.tsx, components/CharacterSheet/LevelUpModal.tsx, components/CharacterSheet/Overview/CharacterOverview.tsx, components/CharacterSheet/Overview/EquipmentMannequin.tsx, components/CharacterSheet/Overview/InventoryList.tsx, components/CharacterSheet/Skills/SkillDetailDisplay.tsx, components/CharacterSheet/Skills/SkillsTab.tsx, components/DesignPreview/steps/classes/subclasses/artificer/AlchemistDemo.tsx, components/DesignPreview/steps/classes/subclasses/artificer/ArmorerDemo.tsx, components/DesignPreview/steps/classes/subclasses/barbarian/BerserkerDemo.tsx, components/DesignPreview/steps/classes/subclasses/bard/CollegeOfLoreDemo.tsx, components/DesignPreview/steps/classes/subclasses/bard/CollegeOfValorDemo.tsx, components/DesignPreview/steps/classes/subclasses/cleric/LifeDomainDemo.tsx, components/DesignPreview/steps/classes/subclasses/cleric/LightDomainDemo.tsx, components/DesignPreview/steps/classes/subclasses/druid/CircleOfTheLandDemo.tsx, components/DesignPreview/steps/classes/subclasses/druid/CircleOfTheMoonDemo.tsx, components/DesignPreview/steps/classes/subclasses/fighter/BattleMasterDemo.tsx, components/DesignPreview/steps/classes/subclasses/monk/WarriorOfShadowDemo.tsx, components/DesignPreview/steps/classes/subclasses/monk/WarriorOfTheOpenHandDemo.tsx, components/DesignPreview/steps/classes/subclasses/paladin/OathOfDevotionDemo.tsx, components/DesignPreview/steps/classes/subclasses/paladin/OathOfVengeanceDemo.tsx, components/DesignPreview/steps/classes/subclasses/ranger/BeastMasterDemo.tsx, components/DesignPreview/steps/classes/subclasses/ranger/HunterDemo.tsx, components/DesignPreview/steps/classes/subclasses/rogue/AssassinDemo.tsx, components/DesignPreview/steps/classes/subclasses/rogue/ThiefDemo.tsx, components/DesignPreview/steps/classes/subclasses/sorcerer/DraconicSorceryDemo.tsx, components/DesignPreview/steps/classes/subclasses/sorcerer/WildMagicSorceryDemo.tsx, components/DesignPreview/steps/classes/subclasses/warlock/ArchfeyPatronDemo.tsx, components/DesignPreview/steps/classes/subclasses/warlock/FiendPatronDemo.tsx, components/DesignPreview/steps/classes/subclasses/wizard/AbjurerDemo.tsx, components/DesignPreview/steps/classes/subclasses/wizard/EvokerDemo.tsx, components/Economy/CommerceDesk.tsx, components/Economy/InvestmentBoard.tsx, components/Economy/LedgerBook.tsx, components/Party/PartyPane/PartyCharacterButton.tsx, components/Party/PartyPane/PartyMemberCard.tsx, components/Religion/TempleModal.tsx, components/Town/Intrigue/RumorMill.tsx, components/Trade/MerchantModal.tsx, components/ui/CoinPurseDisplay.tsx, components/ui/RestModal.tsx, data/dev/dummyCharacter.ts, hooks/ability/useAbilityExecution.ts, hooks/actions/handleGeminiCustom.ts, hooks/actions/handleItemInteraction.ts, hooks/actions/handleResourceActions.ts, hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useTurnManager.ts, hooks/movementUtils.ts, services/characterGenerator.ts, services/saveLoadService.ts, state/appState.ts, state/reducers/characterReducer.ts, systems/combat/SavePenaltySystem.ts, systems/crafting/craftingService.ts, systems/planar/AbyssalMechanics.ts, systems/planar/FeywildMechanics.ts, systems/planar/PlanarHazardSystem.ts, systems/planar/ShadowfellMechanics.ts, systems/planar/rest.ts, systems/puzzles/arcaneGlyphSystem.ts, systems/puzzles/lockSystem.ts, systems/puzzles/pressurePlateSystem.ts, systems/puzzles/puzzleSystem.ts, systems/puzzles/secretDoorSystem.ts, systems/puzzles/skillChallengeSystem.ts, systems/spells/mechanics/ConcentrationTracker.ts, utils/core/factories.ts, utils/index.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Character Utilities Module Index.
 *
 * Provides a single entry point for character creation, stat derivation, leveling,
 * armor and defense calculation, carrying capacity, saving throws, and spell progression.
 *
 * Called by: App components, character sheets, combat engine, game reducers, and inventory.
 * Depends on: Pure domain modules in src/utils/character/.
 *
 * @file src/utils/character/index.ts
 */

// ============================================================================
// Core Character Mechanics & Domain Submodules
// ============================================================================

export * from './characterUtils';
export * from './stats';
export * from './defense';
export * from './progression';
export * from './encumbrance';
export * from './statUtils';
export * from './savingThrowUtils';
export * from './spellUtils';
export * from './spellAbilityFactory';
export * from './spellFilterUtils';
export * from './weaponUtils';
export * from './coinPurseUtils';
export * from './companionFactories';
export * from './characterValidation';
export * from './concentrationUtils';
export * from './identityUtils';
export * from './checkUtils';
export * from './getMaxPreparedSpells';
