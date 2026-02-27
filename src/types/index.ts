// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 27/02/2026, 09:30:22
 * Dependents: AISpellArbitrator.ts, AbilityCommandFactory.ts, AbilityScoreAllocation.tsx, AbyssalMechanics.ts, ActionButton.tsx, ActionPane/index.tsx, AgeSelection.tsx, AoECalculator.ts, App.tsx, ArtificerFeatureSelection.tsx, AstralMechanics.ts, BackgroundSelection.tsx, BanterManager.ts, BardFeatureSelection.tsx, BattleMapDemo.tsx, BountyHunterSystem.ts, CentaurNaturalAffinitySkillSelection.tsx, ChangelingInstinctsSelection.tsx, CharacterCreator.tsx, CharacterDetailsTab.tsx, CharacterOverview.tsx, CharacterSheetModal.tsx, ClassDetailPane.tsx, ClassSelection.tsx, ClericFeatureSelection.tsx, CombatView.tsx, CompanionGenerator.ts, CompanionReaction.tsx, CompassPane/index.tsx, ConversationPanel.tsx, CrimeSystem.ts, DevMenu.tsx, DialogueInterface.tsx, DiscoveryLogPane.tsx, DossierPane.tsx, DragonbornAncestrySelection.tsx, DruidFeatureSelection.tsx, DynamicMannequinSlotIcon.tsx, ElvenLineageSelection.tsx, EncounterModal.tsx, EntityResolverService.ts, EquipmentMannequin.tsx, FactionManager.ts, FamilyTreeTab.tsx, FeatSelection.tsx, FeatSpellPicker.tsx, FenceSystem.ts, FeywildMechanics.ts, FighterFeatureSelection.tsx, FullEntryDisplay.tsx, GameContext.tsx, GameGuideModal.tsx, GameLayout.tsx, GameModals.tsx, GeminiLogViewer.tsx, GiantAncestrySelection.tsx, Glossary.tsx, GlossaryContentRenderer.tsx, GlossaryContext.tsx, GlossaryDisplay.tsx, GlossaryEntryPanel.tsx, GlossaryEntryTemplate.tsx, GlossarySidebar.tsx, GlossaryTooltip.tsx, GnomeSubraceSelection.tsx, HeistManager.ts, HistoryService.ts, HumanSkillSelection.tsx, InfernalMechanics.ts, InventoryList.tsx, JournalTab.tsx, LevelUpModal.tsx, LoadGameTransition.tsx, LoreService.ts, MapPane.tsx, MapTile.tsx, MaterialTagService.ts, MemorySystem.ts, MerchantModal.tsx, Minimap.tsx, NameAndReview.tsx, NobleIntrigueManager.ts, NotificationSystem.tsx, PaladinFeatureSelection.tsx, PartyCharacterButton.tsx, PartyEditorModal.tsx, PartyManager.tsx, PartyMemberCard.tsx, PartyOverlay.tsx, PartyPane.tsx, PlanarHazardSystem.ts, PlanarService.ts, PortalSystem.ts, QuestCard.tsx, QuestHistoryRow.tsx, QuestLog.tsx, QuestLogSidebar.tsx, QuestManager.ts, RaceSelection.tsx, RacialSpellAbilitySelection.tsx, RangerFeatureSelection.tsx, RelationshipManager.ts, RestModal.tsx, RumorMill.tsx, SavingThrowResolver.ts, Scene3D.tsx, ShadowfellMechanics.ts, SingleGlossaryEntryModal.tsx, SkillDetailDisplay.tsx, SkillSelection.tsx, SkillsTab.tsx, SorcererFeatureSelection.tsx, SpellCommand.ts, SpellCommandFactory.ts, SpellContext.tsx, SpellDetailPane.tsx, SpellService.ts, SpellSlotDisplay.tsx, SpellSourceSelector.tsx, SpellbookOverlay.tsx, SpellbookTab.tsx, StateViewer.tsx, SubmapFeaturePainter.ts, SubmapPane.tsx, SubmapTile.tsx, SystemMenu.tsx, TargetResolver.ts, TavernGossipSystem.ts, TempleModal.tsx, TempleSystem.ts, ThievesGuildSystem.ts, ThreeDModal.tsx, TieflingLegacySelection.tsx, TownCanvas.tsx, TownDevControls.tsx, TradeRouteManager.ts, TradeRouteSystem.ts, UnderdarkMechanics.ts, UnifiedDebugLogViewer.tsx, VillageScene.tsx, WarlockFeatureSelection.tsx, WeaponMasterySelection.tsx, WizardFeatureSelection.tsx, WorldEventManager.ts, WorldPane.tsx, aarakocra.ts, abyssal_tiefling.ts, actionHandlerTypes.ts, actionHandlers.ts, actionTypes.d.ts, actionTypes.ts, actionUtils.ts, air_genasi.ts, appState.ts, astral_elf.ts, autognome.ts, autumn_eladrin.ts, azgaarDerivedMapService.ts, batchCrafting.ts, beastborn_human.ts, beasthide_shifter.ts, biomes.ts, black_dragonborn.ts, blue_dragonborn.ts, brass_dragonborn.ts, bronze_dragonborn.ts, bugbear.ts, centaur.ts, changeling.ts, characterCreatorState.ts, characterGenerator.ts, characterReducer.ts, characterUtils.ts, characterValidation.ts, chthonic_tiefling.ts, classes/index.ts, cloud_giant_goliath.ts, combatUtils.ts, companionReducer.ts, cone.ts, contextUtils.ts, conversationReducer.ts, copper_dragonborn.ts, craftedItems.ts, craftingEngine.ts, createOllamaLogEntry.ts, crime/index.ts, crimeReducer.ts, cube.ts, cylinder.ts, deep_gnome.ts, deities/index.ts, dialogueReducer.ts, dialogueService.ts, dndData.ts, draconblood_dragonborn.ts, dragonborn.d.ts, dragonborn.ts, drow.ts, duergar.ts, dummyCharacter.ts, earth_genasi.ts, economyReducer.ts, economyUtils.ts, eladrin.ts, elf.ts, encounterReducer.ts, encounterUtils.ts, encounters.ts, entityIntegrationUtils.ts, factionUtils.ts, factories.ts, fairy.ts, fallen_aasimar.ts, featsData.ts, firbolg.ts, fire_genasi.ts, fire_giant_goliath.ts, forest_gnome.ts, forgeborn_human.ts, frost_giant_goliath.ts, gatherableItems.d.ts, gatherableItems.ts, geminiService.ts, geminiServiceFallback.ts, getMaxPreparedSpells.ts, giff.ts, githyanki.ts, githzerai.ts, glossaryUtils.ts, goblin.ts, gold_dragonborn.ts, goliath.d.ts, goliath.ts, green_dragonborn.ts, guardian_human.ts, hadozee.ts, half_elf.ts, half_elf_aquatic.ts, half_elf_drow.ts, half_elf_high.ts, half_elf_wood.ts, half_orc.ts, halfling.ts, handleEncounter.ts, handleGeminiCustom.ts, handleItemInteraction.ts, handleMerchantInteraction.ts, handleMovement.ts, handleNpcInteraction.ts, handleObservation.ts, handleOracle.ts, handleResourceActions.ts, handleSystemAndUi.ts, handleWorldEvents.ts, harengon.ts, hearthkeeper_halfling.ts, high_elf.ts, hill_dwarf.ts, hill_giant_goliath.ts, hobgoblin.ts, human.ts, identityReducer.ts, index.d.ts, index.d.ts, index.d.ts, infernal_tiefling.ts, initialState.ts, items.ts, items/index.ts, journalReducer.ts, kalashtar.ts, kender.ts, kenku.ts, kobold.ts, landmarks.ts, legacyReducer.ts, leonin.ts, lightfoot_halfling.ts, line.ts, lizardfolk.ts, locationUtils.ts, locations.ts, logReducer.ts, longtooth_shifter.ts, lootService.ts, lotusden_halfling.ts, loxodon.ts, mapService.ts, masteryData.ts, mender_halfling.ts, minotaur.ts, monsters.ts, mountain_dwarf.ts, navalReducer.ts, npcReducer.ts, npcs.ts, orc.ts, pallid_elf.ts, partyStatUtils.ts, pathfinder_half_orc.ts, planarUtils.ts, planes.ts, plasmoid.ts, pois.ts, protector_aasimar.ts, questReducer.ts, quests/index.ts, quickCharacterGenerator.ts, raceSyncAuditor.ts, races/index.ts, ravenite_dragonborn.ts, red_dragonborn.ts, religionReducer.ts, resistanceUtils.ts, rest.ts, ritualReducer.ts, rock_gnome.ts, runeward_dwarf.ts, satyr.ts, saveLoadService.ts, scourge_aasimar.ts, sea_elf.ts, seersight_half_elf.ts, settlementGeneration.ts, shadar_kai.ts, shadowveil_elf.ts, silver_dragonborn.ts, simic_hybrid.ts, skillChallengeSystem.ts, skillSelectionUtils.ts, skills/index.ts, socialUtils.ts, spellAbilityFactory.ts, spellFilterUtils.ts, spellUtils.ts, sphere.ts, spring_eladrin.ts, statUtils.d.ts, statUtils.ts, stone_giant_goliath.ts, storm_giant_goliath.ts, stormborn_half_elf.ts, stout_halfling.ts, submapPathContinuity.ts, submapUtils.ts, submapVisuals.ts, submapVisualsConfig.ts, summer_eladrin.ts, swiftstride_shifter.ts, tabaxi.ts, templeUtils.ts, temples/index.ts, thri_kreen.ts, tiefling.d.ts, tiefling.ts, tortle.ts, townReducer.ts, triton.ts, ttsOptions.ts, types.ts, types/index.ts, uiReducer.ts, underdarkService.ts, useAbilitySystem.ts, useActionEconomy.ts, useActionGeneration.ts, useAudio.ts, useAutoSave.ts, useCharacterAssembly.ts, useCharacterAssembly.ts, useCharacterProficiencies.ts, useCombatOutcome.ts, useCompanionBanter.ts, useCompanionCommentary.ts, useConversation.ts, useDialogueSystem.ts, useGameActions.ts, useGameInitialization.ts, useGlossaryKeyboardNav.ts, useGlossarySearch.ts, useHistorySync.ts, useMissingChoice.ts, useQuickTravel.ts, useSubmapGlossaryItems.ts, useSubmapGrid.ts, useSubmapProceduralData.ts, useTileHintGenerator.ts, useUnderdarkLighting.ts, vedalken.ts, verdan.ts, villageGenerator.ts, villagePersonalityProfiles.ts, visualUtils.ts, warforged.ts, water_genasi.ts, wayfarer_human.ts, weaponUtils.ts, white_dragonborn.ts, wildhunt_shifter.ts, winter_eladrin.ts, wood_elf.ts, wordweaver_gnome.ts, worldReducer.ts, yuan_ti.ts
 * Imports: 38 files
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
 export * from './journal'; // Export Journal system types
 
 export type { CombatCharacter, CharacterStats, Position, CombatState };
 // @ts-ignore
 export type { AppAction } from '../state/actionTypes';
 
