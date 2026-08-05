// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 04/08/2026, 21:53:16
 * Dependents: App.tsx, commands/base/BaseEffectCommand.ts, commands/base/CommandExecutor.ts, commands/effects/AttackRollModifierCommand.ts, commands/effects/EnhanceAbilityCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/NarrativeCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/effects/TerrainCommand.ts, commands/effects/commandAreaMovementEffects.ts, commands/effects/utility/combatSupport.ts, commands/effects/utility/controlledEntities.ts, commands/effects/utility/core.ts, commands/effects/utility/minorUtility.ts, commands/effects/utility/moduleFunctions.ts, commands/effects/utility/objects.ts, commands/effects/utility/senses.ts, commands/effects/utility/summons.ts, commands/effects/utility/transformation.ts, commands/effects/utility/undead.ts, components/ActionPane/SystemMenu.tsx, components/BattleMap/AISpellInputModal.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/NameAndReview.tsx, components/Combat/CombatView.tsx, components/Combat/EncounterModal.tsx, components/DesignPreview/livePreviewData.ts, components/DesignPreview/steps/PreviewEconCraft.tsx, components/Economy/CommerceDesk.tsx, components/Glossary/hooks/useGlossaryModal.ts, components/Glossary/spellGateChecker/useSpellGateChecks.ts, components/Logbook/DiscoveryLogPane.tsx, components/QuestLog/questUtils.ts, components/Town/Broadsheet.tsx, components/Town/NoticeBoard.tsx, components/World3D/World3DWrapper.tsx, components/WorldPane.tsx, components/debug/TownHistoryDevOverlay.tsx, components/layout/GameModals.tsx, components/layout/MainMenu.tsx, components/ui/GameGuideModal.tsx, components/ui/LoadingSpinner.tsx, components/ui/TimeWidget.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleResourceActions.ts, hooks/actions/handleSystemAndUi.ts, hooks/actions/handleWorldEvents.ts, hooks/useChronicleRumorsSync.ts, hooks/useDungeonRumorsSync.ts, hooks/useLocalStorage.ts, hooks/useOverheardGossip.ts, hooks/useResizableWindow.ts, hooks/useTownCrierAnnouncements.ts, hooks/useTownMerchantRegistration.ts, services/SpellService.ts, services/dialogueService.ts, services/gemini/core.ts, services/gemini/encounters.ts, services/gemini/items.ts, services/geminiServiceFallback.ts, services/indexedDBStorageService.ts, services/lootService.ts, services/saveLoadService.ts, services/travelService.ts, state/appState.ts, state/initialState.ts, state/migrations/playerCellMigration.ts, state/reducers/economyReducer.ts, state/reducers/journalReducer.ts, state/reducers/worldReducer.ts, systems/economy/TradeRouteSystem.ts, systems/environment/WeatherSystem.ts, systems/history/HistoryService.ts, systems/intrigue/TavernGossipSystem.ts, systems/planar/AbyssalMechanics.ts, systems/planar/AstralMechanics.ts, systems/planar/FeywildMechanics.ts, systems/planar/InfernalMechanics.ts, systems/planar/PortalSystem.ts, systems/planar/ShadowfellMechanics.ts, systems/quests/QuestManager.ts, systems/religion/TempleSystem.ts, systems/rituals/RitualManager.ts, systems/spells/ai/AISpellArbitrator.ts, systems/time/CalendarSystem.ts, systems/time/SeasonalSystem.ts, systems/world/FactionManager.ts, systems/world/NobleIntrigueManager.ts, systems/world/WorldEventManager.ts, systems/worldforge/townsim/chronicleForLocation.ts, utils/index.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/core/index.ts
 * Core utilities - foundational functions used across the codebase.
 */

export * from './factories';
export * from './idGenerator';
export * from './spellTimeUtils';
export * from './timeUtils';
export * from './logger';
export * from './storageUtils';
export * from './securityUtils';
export * from './permissions';
export * from './hashUtils';
export * from './i18n';
