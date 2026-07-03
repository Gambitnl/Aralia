// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 22/06/2026, 23:37:56
 * Dependents: App.tsx, commands/base/SpellCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, components/ActionPane/ActionButton.tsx, components/ActionPane/SystemMenu.tsx, components/ActionPane/index.tsx, components/ActionPane/useActionGeneration.ts, components/BattleMap/BattleMapDemo.tsx, components/CharacterCreator/AbilityScoreAllocation.tsx, components/CharacterCreator/AgeSelection.tsx, components/CharacterCreator/BackgroundSelection.tsx, components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/Class/ArtificerFeatureSelection.tsx, components/CharacterCreator/Class/BardFeatureSelection.tsx, components/CharacterCreator/Class/ClassDetailPane.tsx, components/CharacterCreator/Class/ClassSelection.tsx, components/CharacterCreator/Class/ClericFeatureSelection.tsx, components/CharacterCreator/Class/DruidFeatureSelection.tsx, components/CharacterCreator/Class/FighterFeatureSelection.tsx, components/CharacterCreator/Class/PaladinFeatureSelection.tsx, components/CharacterCreator/Class/RangerFeatureSelection.tsx, components/CharacterCreator/Class/SorcererFeatureSelection.tsx, components/CharacterCreator/Class/SpellCard.tsx, components/CharacterCreator/Class/WarlockFeatureSelection.tsx, components/CharacterCreator/Class/WizardFeatureSelection.tsx, components/CharacterCreator/FeatSelection.tsx, components/CharacterCreator/FeatSpellPicker.tsx, components/CharacterCreator/NameAndReview.tsx, components/CharacterCreator/Race/CentaurNaturalAffinitySkillSelection.tsx, components/CharacterCreator/Race/ChangelingInstinctsSelection.tsx, components/CharacterCreator/Race/DragonbornAncestrySelection.tsx, components/CharacterCreator/Race/ElvenLineageSelection.tsx, components/CharacterCreator/Race/GiantAncestrySelection.tsx, components/CharacterCreator/Race/GnomeSubraceSelection.tsx, components/CharacterCreator/Race/HumanSkillSelection.tsx, components/CharacterCreator/Race/RaceSelection.tsx, components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx, components/CharacterCreator/Race/TieflingLegacySelection.tsx, components/CharacterCreator/SkillSelection.tsx, components/CharacterCreator/SpellSourceSelector.tsx, components/CharacterCreator/VisualsSelection.tsx, components/CharacterCreator/WeaponMasterySelection.tsx, components/CharacterCreator/hooks/useCharacterAssembly.ts, components/CharacterCreator/randomizeCreation.ts, components/CharacterCreator/state/characterCreatorState.ts, components/CharacterCreator/utils/skillSelectionUtils.ts, components/CharacterSheet/CharacterSheetModal.tsx, components/CharacterSheet/Details/CharacterDetailsTab.tsx, components/CharacterSheet/Family/FamilyTreeTab.tsx, components/CharacterSheet/Journal/JournalTab.tsx, components/CharacterSheet/Journal/QuestLogSidebar.tsx, components/CharacterSheet/LevelUpModal.tsx, components/CharacterSheet/Overview/CharacterOverview.tsx, components/CharacterSheet/Overview/DynamicMannequinSlotIcon.tsx, components/CharacterSheet/Overview/EquipmentMannequin.tsx, components/CharacterSheet/Overview/InventoryList.tsx, components/CharacterSheet/Skills/SkillDetailDisplay.tsx, components/CharacterSheet/Skills/SkillsTab.tsx, components/CharacterSheet/Spellbook/SpellDetailPane.tsx, components/CharacterSheet/Spellbook/SpellSlotDisplay.tsx, components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/CharacterSheet/Spellbook/SpellbookTab.tsx, components/Combat/CombatView.tsx, components/Combat/EncounterModal.tsx, components/CompassPane/index.tsx, components/ConversationPanel/ConversationPanel.tsx, components/Crafting/alchemyBenchSelectors.ts, components/Crafting/crafterAdapter.ts, components/DesignPreview/steps/PreviewSpellGlossary.tsx, components/Dialogue/DialogueInterface.tsx, components/EncounterGenerator/PartyManager.tsx, components/Glossary/FullEntryDisplay.tsx, components/Glossary/Glossary.tsx, components/Glossary/GlossaryContentRenderer.tsx, components/Glossary/GlossaryDisplay.tsx, components/Glossary/GlossaryEntryPanel.tsx, components/Glossary/GlossaryEntryTemplate.tsx, components/Glossary/GlossaryItemStatBlock.tsx, components/Glossary/GlossarySidebar.tsx, components/Glossary/GlossaryTooltip.tsx, components/Glossary/SingleGlossaryEntryModal.tsx, components/Glossary/glossaryRuleChapters.ts, components/Glossary/hooks/useGlossaryKeyboardNav.ts, components/Glossary/hooks/useGlossarySearch.ts, components/Glossary/spellGateChecker/SpellGateBucketSections.tsx, components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx, components/Logbook/DiscoveryLogPane.tsx, components/Logbook/DossierPane.tsx, components/MapPane.tsx, components/Minimap.tsx, components/Party/PartyEditorModal.tsx, components/Party/PartyOverlay.tsx, components/Party/PartyPane/PartyCharacterButton.tsx, components/Party/PartyPane/PartyMemberCard.tsx, components/Party/PartyPane/PartyPane.tsx, components/QuestLog/QuestCard.tsx, components/QuestLog/QuestHistoryRow.tsx, components/QuestLog/QuestLog.tsx, components/Religion/TempleModal.tsx, components/SaveLoad/LoadGameTransition.tsx, components/Submap/SubmapPane.tsx, components/Submap/SubmapTile.tsx, components/Submap/painters/SubmapFeaturePainter.ts, components/Submap/submapVisuals.ts, components/Submap/useQuickTravel.ts, components/Submap/useSubmapGlossaryItems.ts, components/Submap/useSubmapGrid.ts, components/Submap/useTileHintGenerator.ts, components/ThreeDModal/Scene3D.tsx, components/ThreeDModal/ThreeDModal.tsx, components/Town/Intrigue/LeverageUI.tsx, components/Town/Intrigue/RumorMill.tsx, components/Town/TownCanvas.tsx, components/Town/TownDevControls.tsx, components/Town/VillageScene.tsx, components/Trade/MerchantModal.tsx, components/World3D/AtlasPlayerMarker.tsx, components/World3D/InWorldHUD.tsx, components/World3D/World3DMinimap.tsx, components/World3D/World3DNameplates.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/WorldAtlasStrip.tsx, components/WorldPane.tsx, components/Worldforge/MapSurfaceToggle.tsx, components/debug/DevMenu.tsx, components/debug/GeminiLogViewer.tsx, components/debug/StateViewer.tsx, components/debug/UnifiedDebugLogViewer.tsx, components/gameEntry/OpeningSituationGate.tsx, components/layout/GameLayout.tsx, components/layout/GameModals.tsx, components/types/index.ts, components/ui/CompanionReaction.tsx, components/ui/GameGuideModal.tsx, components/ui/LongRestModal.tsx, components/ui/NotificationSystem.tsx, components/ui/RestModal.tsx, config/submapVisualsConfig.ts, context/GlossaryContext.tsx, context/SpellContext.tsx, data/biomes.ts, data/craftedItems.ts, data/deities/index.ts, data/dev/dummyCharacter.ts, data/dndData.ts, data/feats/featsData.ts, data/landmarks.ts, data/masteryData.ts, data/monsters.generated.ts, data/monsters.ts, data/planes.ts, data/quests/index.ts, data/races/aarakocra.ts, data/races/abyssal_tiefling.ts, data/races/air_genasi.ts, data/races/astral_elf.ts, data/races/autognome.ts, data/races/autumn_eladrin.ts, data/races/beastborn_human.ts, data/races/beasthide_shifter.ts, data/races/black_dragonborn.ts, data/races/blue_dragonborn.ts, data/races/brass_dragonborn.ts, data/races/bronze_dragonborn.ts, data/races/bugbear.ts, data/races/centaur.ts, data/races/changeling.ts, data/races/chthonic_tiefling.ts, data/races/cloud_giant_goliath.ts, data/races/copper_dragonborn.ts, data/races/deep_gnome.ts, data/races/draconblood_dragonborn.ts, data/races/drow.ts, data/races/duergar.ts, data/races/earth_genasi.ts, data/races/eladrin.ts, data/races/elf.ts, data/races/fairy.ts, data/races/fallen_aasimar.ts, data/races/firbolg.ts, data/races/fire_genasi.ts, data/races/fire_giant_goliath.ts, data/races/forest_gnome.ts, data/races/forgeborn_human.ts, data/races/frost_giant_goliath.ts, data/races/giff.ts, data/races/githyanki.ts, data/races/githzerai.ts, data/races/goblin.ts, data/races/gold_dragonborn.ts, data/races/green_dragonborn.ts, data/races/guardian_human.ts, data/races/hadozee.ts, data/races/half_elf.ts, data/races/half_elf_aquatic.ts, data/races/half_elf_drow.ts, data/races/half_elf_high.ts, data/races/half_elf_wood.ts, data/races/half_orc.ts, data/races/halfling.ts, data/races/harengon.ts, data/races/hearthkeeper_halfling.ts, data/races/high_elf.ts, data/races/hill_dwarf.ts, data/races/hill_giant_goliath.ts, data/races/hobgoblin.ts, data/races/human.ts, data/races/infernal_tiefling.ts, data/races/kalashtar.ts, data/races/kender.ts, data/races/kenku.ts, data/races/kobold.ts, data/races/leonin.ts, data/races/lightfoot_halfling.ts, data/races/lizardfolk.ts, data/races/longtooth_shifter.ts, data/races/lotusden_halfling.ts, data/races/loxodon.ts, data/races/mender_halfling.ts, data/races/minotaur.ts, data/races/mountain_dwarf.ts, data/races/orc.ts, data/races/pallid_elf.ts, data/races/pathfinder_half_orc.ts, data/races/plasmoid.ts, data/races/protector_aasimar.ts, data/races/racialTraits.ts, data/races/ravenite_dragonborn.ts, data/races/red_dragonborn.ts, data/races/rock_gnome.ts, data/races/runeward_dwarf.ts, data/races/satyr.ts, data/races/scourge_aasimar.ts, data/races/sea_elf.ts, data/races/seersight_half_elf.ts, data/races/shadar_kai.ts, data/races/shadowveil_elf.ts, data/races/silver_dragonborn.ts, data/races/simic_hybrid.ts, data/races/spring_eladrin.ts, data/races/stone_giant_goliath.ts, data/races/storm_giant_goliath.ts, data/races/stormborn_half_elf.ts, data/races/stout_halfling.ts, data/races/summer_eladrin.ts, data/races/swiftstride_shifter.ts, data/races/tabaxi.ts, data/races/thri_kreen.ts, data/races/tortle.ts, data/races/triton.ts, data/races/vedalken.ts, data/races/verdan.ts, data/races/warforged.ts, data/races/water_genasi.ts, data/races/wayfarer_human.ts, data/races/white_dragonborn.ts, data/races/wildhunt_shifter.ts, data/races/winter_eladrin.ts, data/races/wood_elf.ts, data/races/wordweaver_gnome.ts, data/races/yuan_ti.ts, data/settings/ttsOptions.ts, data/skills/index.ts, data/temples/index.ts, data/villagePersonalityProfiles.ts, data/world/locations.ts, data/world/npcs.ts, data/world/pois.ts, hooks/actionUtils.ts, hooks/actions/actionHandlerTypes.ts, hooks/actions/actionHandlers.ts, hooks/actions/handleEncounter.ts, hooks/actions/handleGeminiCustom.ts, hooks/actions/handleItemInteraction.ts, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleMovement.ts, hooks/actions/handleNpcInteraction.ts, hooks/actions/handleObservation.ts, hooks/actions/handleOracle.ts, hooks/actions/handleResourceActions.ts, hooks/actions/handleSystemAndUi.ts, hooks/actions/handleWorldEvents.ts, hooks/combat/useCombatOutcome.ts, hooks/useAbilitySystem.ts, hooks/useAudio.ts, hooks/useAutoSave.ts, hooks/useCharacterProficiencies.ts, hooks/useCompanionBanter.ts, hooks/useCompanionCommentary.ts, hooks/useConversation.ts, hooks/useDialogueSystem.ts, hooks/useGameActions.ts, hooks/useGameInitialization.ts, hooks/useHistorySync.ts, hooks/useMissingChoice.ts, hooks/useOpeningSituation.ts, hooks/useSubmapProceduralData.ts, hooks/useUnderdarkLighting.ts, hooks/useWorldViewMode.ts, services/CompanionGenerator.ts, services/EntityResolverService.ts, services/LoreService.ts, services/SpellService.ts, services/azgaarDerivedMapService.ts, services/characterGenerator.ts, services/dialogueService.ts, services/gemini/encounters.ts, services/gemini/items.ts, services/gemini/types.ts, services/geminiService.ts, services/geminiServiceFallback.ts, services/lootService.ts, services/mapService.ts, services/premadeCharacterService.ts, services/saveLoadService.ts, services/underdarkService.ts, services/villageGenerator.ts, services/worldSim/climateFromBiomes.ts, services/worldSim/heightFromBiomes.ts, state/GameContext.tsx, state/appState.ts, state/initialState.ts, state/reducers/characterReducer.ts, state/reducers/companionReducer.ts, state/reducers/conversationReducer.ts, state/reducers/crimeReducer.ts, state/reducers/dialogueReducer.ts, state/reducers/economyReducer.ts, state/reducers/encounterReducer.ts, state/reducers/gameEntryReducer.ts, state/reducers/identityReducer.ts, state/reducers/journalReducer.ts, state/reducers/legacyReducer.ts, state/reducers/logReducer.ts, state/reducers/navalReducer.ts, state/reducers/npcReducer.ts, state/reducers/questReducer.ts, state/reducers/religionReducer.ts, state/reducers/ritualReducer.ts, state/reducers/townReducer.ts, state/reducers/uiReducer.ts, state/reducers/worldReducer.ts, systems/companions/BanterManager.ts, systems/companions/RelationshipManager.ts, systems/crafting/batchCrafting.ts, systems/crafting/craftingEngine.ts, systems/crime/BountyHunterSystem.ts, systems/crime/CrimeSystem.ts, systems/crime/HeistManager.ts, systems/crime/ThievesGuildSystem.ts, systems/crime/fencing/FenceSystem.ts, systems/economy/TradeRouteManager.ts, systems/economy/TradeRouteSystem.ts, systems/history/HistoryService.ts, systems/intrigue/TavernGossipSystem.ts, systems/memory/MemorySystem.ts, systems/planar/AbyssalMechanics.ts, systems/planar/AstralMechanics.ts, systems/planar/FeywildMechanics.ts, systems/planar/InfernalMechanics.ts, systems/planar/PlanarHazardSystem.ts, systems/planar/PlanarService.ts, systems/planar/PortalSystem.ts, systems/planar/ShadowfellMechanics.ts, systems/planar/rest.ts, systems/puzzles/skillChallengeSystem.ts, systems/quests/QuestManager.ts, systems/quests/questJournal.ts, systems/religion/TempleSystem.ts, systems/spells/ai/AISpellArbitrator.ts, systems/spells/ai/MaterialTagService.ts, systems/spells/mechanics/SavingThrowResolver.ts, systems/spells/targeting/AoECalculator.ts, systems/spells/targeting/TargetResolver.ts, systems/spells/targeting/gridAlgorithms/cone.ts, systems/spells/targeting/gridAlgorithms/cube.ts, systems/spells/targeting/gridAlgorithms/cylinder.ts, systems/spells/targeting/gridAlgorithms/line.ts, systems/spells/targeting/gridAlgorithms/sphere.ts, systems/underdark/UnderdarkMechanics.ts, systems/world/FactionManager.ts, systems/world/NobleIntrigueManager.ts, systems/world/WorldEventManager.ts, utils/character/characterUtils.ts, utils/character/characterValidation.ts, utils/character/getMaxPreparedSpells.ts, utils/character/spellAbilityFactory.ts, utils/character/spellFilterUtils.ts, utils/character/spellUtils.ts, utils/character/weaponUtils.ts, utils/combat/actionEconomyUtils.ts, utils/combat/actionUtils.ts, utils/combat/combatUtils.ts, utils/combat/createEnemyFromMonster.ts, utils/combat/resistanceUtils.ts, utils/context/contextUtils.ts, utils/context/entityIntegrationUtils.ts, utils/core/factories.ts, utils/core/timekeeperUtils.ts, utils/createOllamaLogEntry.ts, utils/economy/economyUtils.ts, utils/planar/planarUtils.ts, utils/sandbox/quickCharacterGenerator.ts, utils/spatial/locationUtils.ts, utils/spatial/submapActionContracts.ts, utils/spatial/submapPathContinuity.ts, utils/spatial/submapUtils.ts, utils/validation/raceSyncAuditor.ts, utils/visuals/glossaryUtils.ts, utils/visuals/visualUtils.ts, utils/world/bestiaryEncounterGenerator.ts, utils/world/encounterUtils.ts, utils/world/factionUtils.ts, utils/world/settlementGeneration.ts, utils/world/socialUtils.ts, utils/world/templeUtils.ts
 * Imports: 40 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Consolidated type exports for Aralia RPG.
 * Core primitives live in ./core, item definitions in ./items, and character-focused
 * types in ./character. Domain-specific modules (combat, spells, deity, factions, etc.)
 * remain in sibling files and are re-exported here for convenience.
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added '@ts-ignore' to relative 
 * imports to suppress script-specific resolution warnings while 
 * maintaining main application health.
  */
 // @ts-ignore
 import type { CombatCharacter, CharacterStats, Position, CombatState } from './combat';
 
 // @ts-ignore
 export * from './world';
 // @ts-ignore
 export * from './actions';
 // @ts-ignore
 export * from './state';
 // @ts-ignore
 export * from './ui';
 // @ts-ignore
 export * from './core';
 // @ts-ignore
 export * from './items';
 // @ts-ignore
 export * from './character';
 // @ts-ignore
 export * from './spells';
 // @ts-ignore
 export * from './conditions';
 // @ts-ignore
 export * from './creatures';
 // @ts-ignore
 export * from './religion';
 // @ts-ignore
 export * from './factions';
 // @ts-ignore
 export * from './companions';
 // @ts-ignore
 export * from './memory';
 // @ts-ignore
 export * from './planes';
 // @ts-ignore
 export * from './crime';
 // @ts-ignore
 export * from './dialogue';
 // @ts-ignore
 export * from './underdark';
 // @ts-ignore
 export * from './history';
 // @ts-ignore
 export * from './economy'; // Export new economy types
 // @ts-ignore
 export * from './languages'; // New taxonomy export
 // @ts-ignore
 export * from './effects'; // Export universal effect types
 // @ts-ignore
 export * from './rituals';
 // @ts-ignore
 export * from './village';
 // @ts-ignore
 export * from './elemental';
 // @ts-ignore
 export * from './stronghold';
 // @ts-ignore
 export * from './loot'; // Export LootTable types
 // @ts-ignore
 export * from './identity'; // Export Identity/Secret types
 // @ts-ignore
 export * from './quests'; // Export new robust Quest types
 // @ts-ignore
 export * from './prophecy'; // Export Prophecy types
 // @ts-ignore
 export * from './naval'; // Export Naval types
 // @ts-ignore
 export * from './navalCombat'; // Export Naval Combat types
 // @ts-ignore
 export * from './crafting'; // Export Crafting system types
 // @ts-ignore
 export * from './conversation'; // Export Interactive Conversation types
 // @ts-ignore
 export * from './environment'; // Export WeatherState and related environment types
 // @ts-ignore
 export * from './dungeon';
// @ts-ignore
 export * from './journal'; // Export Journal system types
 
 export type { CombatCharacter, CharacterStats, Position, CombatState };
 // @ts-ignore
 export type { AppAction } from '../state/actionTypes';
 
export * from './materials';

export type { WorldData, River, Road, Site, BiomeZone, Polygon, Vec2 } from '../services/worldSim/types';
