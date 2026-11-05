/**
 * Standardized button styles for the application.
 * These constants ensure consistency in padding, rounding, shadow, and interaction states
 * across different components (ActionPane, Modals, CharacterCreator, etc.).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 05/11/2026, 11:29:02
 * Dependents: components/ActionPane/ActionButton.tsx, components/ActionPane/SystemMenu.tsx, components/ActionPane/index.tsx, components/Atlas/AtlasExplorer.tsx, components/BattleMap/AISpellInputModal.tsx, components/BattleMap/AbilityPalette.tsx, components/BattleMap/BattleMapDemo.tsx, components/BattleMap/BattleMapHUD.tsx, components/BattleMap/CombatCommandToolbar.tsx, components/BattleMap/CombatIntentPreview.tsx, components/BattleMap/CombatRailControls.tsx, components/BattleMap/CompactTurnStrip.tsx, components/BattleMap/PartyDisplay.tsx, components/CharacterCreator/BackgroundDetailPane.tsx, components/CharacterCreator/Class/ClassDetailPane.tsx, components/CharacterCreator/Class/ClericFeatureSelection.tsx, components/CharacterCreator/Class/DruidFeatureSelection.tsx, components/CharacterCreator/Class/FighterFeatureSelection.tsx, components/CharacterCreator/Class/SorcererFeatureSelection.tsx, components/CharacterCreator/Class/WarlockFeatureSelection.tsx, components/CharacterCreator/CreationSidebar.tsx, components/CharacterCreator/FeatSelection.tsx, components/CharacterCreator/FeatSpellPicker.tsx, components/CharacterCreator/Race/CentaurNaturalAffinitySkillSelection.tsx, components/CharacterCreator/Race/ChangelingInstinctsSelection.tsx, components/CharacterCreator/Race/DragonbornAncestrySelection.tsx, components/CharacterCreator/Race/ElvenLineageSelection.tsx, components/CharacterCreator/Race/GiantAncestrySelection.tsx, components/CharacterCreator/Race/GnomeSubraceSelection.tsx, components/CharacterCreator/Race/HumanSkillSelection.tsx, components/CharacterCreator/Race/RaceDetailModal.tsx, components/CharacterCreator/Race/RaceDetailPane.tsx, components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx, components/CharacterCreator/Race/TieflingLegacySelection.tsx, components/CharacterCreator/SkillSelection.tsx, components/CharacterCreator/SpellSourceSelector.tsx, components/CharacterCreator/WeaponMasterySelection.tsx, components/CharacterCreator/shared/CharacterCreatorTraitsTable.tsx, components/CharacterSheet/CharacterSheetModal.tsx, components/CharacterSheet/Crafting/CraftingTab.tsx, components/CharacterSheet/Journal/JournalSpread.tsx, components/CharacterSheet/Journal/QuestLogSidebar.tsx, components/CharacterSheet/LevelUpModal.tsx, components/CharacterSheet/Overview/CharacterOverview.tsx, components/CharacterSheet/Overview/InventoryList.tsx, components/CharacterSheet/Skills/SkillDetailDisplay.tsx, components/CharacterSheet/Spellbook/CastSpellControls.tsx, components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/CharacterSheet/Spellbook/SpellbookTab.tsx, components/Combat/CombatLog.tsx, components/Combat/CombatView.tsx, components/Combat/EncounterModal.tsx, components/Combat/InPlaceCombatScene.tsx, components/Combat/MonsterPicker.tsx, components/Combat/ReactionPrompt.tsx, components/Compendium/CombatActionsTable.tsx, components/Compendium/CompendiumRuleTables.tsx, components/Compendium/ConditionTable.tsx, components/Compendium/CoverObscurementTable.tsx, components/Compendium/WeaponMasteryTable.tsx, components/ConversationPanel/CompanionGoalDestinationChoices.tsx, components/ConversationPanel/CompanionGoalWorkChoices.tsx, components/ConversationPanel/CompanionPreparationChoices.tsx, components/ConversationPanel/CompanionRumorChoices.tsx, components/ConversationPanel/CompanionTravelChoices.tsx, components/Crafting/AlchemyBenchPanel.tsx, components/Crafting/CreatureHarvestPanel.tsx, components/Crafting/ExperimentPanel.tsx, components/Crafting/GatheringPanel.tsx, components/Crafting/IngredientGlossaryPanel.tsx, components/Crafting/RefiningEnchantingPanel.tsx, components/Crafting/SalvageModal.tsx, components/Crime/ThievesGuild/FenceInterface.tsx, components/Crime/ThievesGuild/HeistPlanningModal.tsx, components/Crime/ThievesGuild/ThievesGuildInterface.tsx, components/Crime/ThievesGuild/ThievesGuildSafehouse.tsx, components/DesignPreview/CreationComponents.tsx, components/Dialogue/DialogueConversationView.tsx, components/Economy/BankModal.tsx, components/Economy/CommerceDesk.tsx, components/Economy/CourierPouch.tsx, components/Economy/LedgerBook.tsx, components/Economy/RealEstateModal.tsx, components/Economy/ShopModal.tsx, components/Economy/TradeRouteModal.tsx, components/Glossary/Glossary.tsx, components/Glossary/GlossaryEntryTemplate.tsx, components/Glossary/GlossaryPill.tsx, components/Glossary/GlossarySidebar.tsx, components/Glossary/SingleGlossaryEntryModal.tsx, components/Glossary/SpellCardTemplate.tsx, components/Glossary/glossaryUIUtils.tsx, components/Logbook/DiscoveryLogPane.tsx, components/Logbook/DossierPane.tsx, components/Naval/ShipPane.tsx, components/Organization/OrganizationDashboard.tsx, components/Party/PartyEditorModal.tsx, components/Party/PartyOverlay.tsx, components/Party/PartyPane/PartyMemberCard.tsx, components/SaveLoad/SaveSlotSelector.tsx, components/Town/Intrigue/LeverageUI.tsx, components/Trade/MerchantModal.tsx, components/Trade/TradeRouteDashboard.tsx, components/World3D/HUDControlPanel.tsx, components/World3D/InWorldHUD.tsx, components/World3D/InteriorOccupants.tsx, components/World3D/ViewModeToggle.tsx, components/World3D/WebGPUProbe.tsx, components/World3D/World3DDemo.tsx, components/World3D/water/RiverCavityPreviewPanel.tsx, components/World3D/water/RiverDropMenu.tsx, components/World3D/water/RiverExperimentPanel.tsx, components/Worldforge/AgentSim3DPreview.tsx, components/Worldforge/AgentSimPreview.tsx, components/Worldforge/AtlasDemo.tsx, components/Worldforge/AtlasMapView.tsx, components/Worldforge/AtlasSvgView.tsx, components/Worldforge/CellInfoPanel.tsx, components/Worldforge/DrillLayerPanel.tsx, components/Worldforge/LocalMapView.tsx, components/Worldforge/MapSurfaceToggle.tsx, components/Worldforge/RegionMapView.tsx, components/Worldforge/StartPointSelection.tsx, components/Worldforge/VillagerRegistry.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx, components/debug/AgentSimDevOverlay.tsx, components/debug/DevMenu.tsx, components/debug/StateViewer.tsx, components/debug/UnifiedDebugLogViewer.tsx, components/dice/DiceRollerModal.tsx, components/dice/TrollScaleSlider.tsx, components/gameEntry/SkillClarificationPane.tsx, components/layout/GameLayout.tsx, components/ui/BanterAttentionBanner.tsx, components/ui/Button.tsx, components/ui/GameGuideModal.tsx, components/ui/ImageModal.tsx, components/ui/LongRestModal.tsx, components/ui/MissingChoiceModal.tsx, components/ui/ModalDialog.tsx, components/ui/NotificationSystem.tsx, components/ui/OllamaDependencyModal.tsx, components/ui/RestModal.tsx, components/ui/TimeWidget.tsx, components/ui/WizardStepper.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Base structural classes (no size or color)
export const BTN_BASE = "font-semibold rounded-lg shadow-md transition-all duration-150 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-opacity-75 disabled:opacity-40 disabled:saturate-50 disabled:shadow-none disabled:cursor-not-allowed";

// Sizes
export const BTN_SIZE_SM = "py-1 px-3 text-sm";
export const BTN_SIZE_MD = "py-2 px-4 text-base";
export const BTN_SIZE_LG = "py-3 px-6 text-lg";

// Color Variants
// Sky/Blue - Primary actions like "View Details", "Submit", "Next"
export const BTN_PRIMARY = "bg-sky-600 hover:bg-sky-500 text-white focus:ring-sky-400";

// Amber - "Do it" actions, often physical or affirmative
export const BTN_ACTION = "bg-amber-500 hover:bg-amber-400 text-gray-900 focus:ring-amber-300";

// Green - Positive/Safe actions
export const BTN_SUCCESS = "bg-green-600 hover:bg-green-500 text-white focus:ring-green-400";

// Red - Destructive actions
export const BTN_DANGER = "bg-red-600 hover:bg-red-500 text-white focus:ring-red-400";

// Gray - Secondary/Cancel/Back actions
export const BTN_SECONDARY = "bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600 focus:ring-gray-500";

// Ghost - Minimal
export const BTN_GHOST = "bg-transparent hover:bg-gray-700/50 text-gray-300 hover:text-white";

// Composed Helpers
export const BTN_CONFIRM = `${BTN_BASE} ${BTN_SIZE_MD} ${BTN_ACTION}`;
export const BTN_CANCEL = `${BTN_BASE} ${BTN_SIZE_MD} ${BTN_SECONDARY}`;
export const BTN_PRIMARY_MD = `${BTN_BASE} ${BTN_SIZE_MD} ${BTN_PRIMARY}`;
export const BTN_PRIMARY_SM = `${BTN_BASE} ${BTN_SIZE_SM} ${BTN_PRIMARY}`;

// ---------------------------------------------------------------------------
// Control roles (GG-378)
// ---------------------------------------------------------------------------
// Not every clickable element is an action button. Tabs, filter chips, clear
// marks, link chips and list rows keep their own compact look, so the
// <Button> component (shadow, large padding, solid color) is wrong for them.
// These role constants hold the structure that each role shares across
// screens. A screen adds only its position and its state colors on top
// (for example the active color of a tab). Each role carries the same
// keyboard focus ring, so keyboard users see focus on every control.

// Keyboard focus ring for compact controls. It shows for keyboard focus only.
export const BTN_FOCUS_VISIBLE = "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

// Tab in a tab bar. The screen adds the active colors, or BTN_TAB_IDLE.
export const BTN_TAB = `px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${BTN_FOCUS_VISIBLE}`;
export const BTN_TAB_IDLE = "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50";

// Tab in a top navigation bar that shows a bottom border line. The screen adds the border and text colors.
export const BTN_TAB_UNDERLINE = `px-6 py-3 text-sm font-medium transition-colors border-b-2 ${BTN_FOCUS_VISIBLE}`;

// Filter chip in a row of filters. The screen adds the active colors, or BTN_CHIP_IDLE.
export const BTN_CHIP = `px-2.5 py-1 text-xs rounded font-medium transition-colors ${BTN_FOCUS_VISIBLE}`;
export const BTN_CHIP_IDLE = "text-gray-400 hover:text-gray-200";

// Small mark inside a text field that clears it. The screen sets the position.
export const BTN_CLEAR_INPUT = `text-gray-400 hover:text-gray-200 text-xs rounded ${BTN_FOCUS_VISIBLE}`;

// Chip that opens a related glossary term.
export const BTN_TERM_LINK = `text-[10px] text-sky-400 hover:text-sky-200 bg-sky-900/40 hover:bg-sky-800/60 border border-sky-600/30 px-1.5 py-0.5 rounded transition-colors ${BTN_FOCUS_VISIBLE}`;

// Control that reads as a text link. The screen sets the color and size.
export const BTN_TEXT_LINK = `bg-transparent text-left rounded transition-colors ${BTN_FOCUS_VISIBLE}`;

// Icon-only control, for example a close mark or an expand arrow. The screen
// sets the size and colors and must give an aria-label.
export const BTN_ICON = `inline-flex items-center justify-center rounded-md transition-colors ${BTN_FOCUS_VISIBLE}`;

// Row in a list or tree that selects or expands its item. The screen sets the
// padding, indent and selected state.
export const BTN_ROW = `text-left transition-colors ${BTN_FOCUS_VISIBLE}`;

// Wrapper around an image or card that opens a larger view.
export const BTN_MEDIA = `relative block rounded ${BTN_FOCUS_VISIBLE}`;
