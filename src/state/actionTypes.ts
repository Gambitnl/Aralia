// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 * 
 * Last Sync: 12/02/2026, 22:27:44
 * Dependents: CharacterCreator.tsx, CombatReligionAdapter.ts, ConversationPanel.tsx, FeatSelection.tsx, GameContext.tsx, GameGuideModal.tsx, GameModals.tsx, NotificationSystem.tsx, TempleSystem.ts, actionHandlers.ts, appState.ts, characterReducer.ts, companionReducer.ts, conversationReducer.ts, craftingReducer.ts, crimeActions.ts, crimeReducer.ts, dialogueReducer.ts, economyReducer.ts, encounterReducer.ts, entityIntegrationUtils.ts, handleEncounter.ts, handleGeminiCustom.ts, handleItemInteraction.ts, handleMerchantInteraction.ts, handleMovement.ts, handleNpcInteraction.ts, handleObservation.ts, handleOracle.ts, handleResourceActions.ts, handleSystemAndUi.ts, handleWorldEvents.ts, identityReducer.ts, journalReducer.ts, legacyReducer.ts, logReducer.ts, navalReducer.ts, npcReducer.ts, questReducer.ts, religionReducer.ts, ritualReducer.ts, townReducer.ts, types/index.ts, uiReducer.ts, useCompanionBanter.ts, useConversation.ts, useDialogueSystem.ts, useGameActions.ts, useGameInitialization.ts, useHistorySync.ts, useOllamaCheck.ts, worldReducer.ts
 * Imports: 7 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/actionTypes.ts
 * Defines the main AppAction type for the application's state management.
 */
import { GameState, GamePhase, GameMessage, PlayerCharacter, Item, MapData, TempPartyMember, StartGameSuccessPayload, Action, SuspicionLevel, GeminiLogEntry, GoalStatus, KnownFact, GossipUpdatePayload, AddLocationResiduePayload, RemoveLocationResiduePayload, EconomyState, Quest, DiscoveryEntry, CrimeType, StrongholdType, StaffRole, MissionType, GuildJob, HeistIntel, NPC, Faction, Location, VillageActionContext, VillagePersonality, RichNPC, HitPointDicePool, LevelUpChoices } from '../types';
import { RitualState } from '../types/rituals';
// TODO(2026-01-03 pass 3 Codex-CLI): RitualEvent type not exported; using unknown stub until rituals schema is surfaced.
type RitualEvent = unknown;
import { CreateAliasPayload, EquipDisguisePayload, LearnSecretPayload } from './payloads/identityPayloads';
import { DialogueSession } from '../types/dialogue';
import { WorldHistoryEvent } from '../types/history';
import { CrewRole } from '../types/naval';
import { InspectSubmapTilePayload, UpdateInspectedTileDescriptionPayload, EquipItemPayload, UnequipItemPayload, UseItemPayload, DropItemPayload, ShowEncounterModalPayload, StartBattleMapEncounterPayload } from '../types/actions';

export type AppAction =
  | { type: 'SET_GAME_PHASE'; payload: GamePhase }
  | { type: 'SET_AUTO_SAVE_ENABLED'; payload: boolean }
  | { type: 'ABANDON_RUN' }
  | { type: 'START_NEW_GAME_SETUP'; payload: { mapData: MapData; dynamicLocationItemIds: Record<string, string[]>; worldSeed: number; } }
  | { type: 'START_GAME_FOR_DUMMY'; payload: { mapData: MapData; dynamicLocationItemIds: Record<string, string[]>; generatedParty: PlayerCharacter[]; worldSeed: number; } }
  | { type: 'START_GAME_SUCCESS'; payload: StartGameSuccessPayload }
  | { type: 'LOAD_GAME_SUCCESS'; payload: GameState }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean; message?: string | null } }
  | { type: 'SET_IMAGE_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_MESSAGE'; payload: GameMessage }
  | { type: 'MOVE_PLAYER'; payload: { newLocationId: string; newSubMapCoordinates: { x: number; y: number }; mapData?: MapData; activeDynamicNpcIds: string[] | null } }
  | { type: 'APPLY_TAKE_ITEM_UPDATE'; payload: { item: Item; locationId: string; discoveryEntry: DiscoveryEntry } }
  | { type: 'TOGGLE_MAP_VISIBILITY' }
  | { type: 'TOGGLE_MINIMAP_VISIBILITY' }
  | { type: 'TOGGLE_SUBMAP_VISIBILITY' }
  | { type: 'TOGGLE_THREE_D_VISIBILITY' }
  | { type: 'SET_WORLD_SEED'; payload: number }
  | { type: 'SET_MAP_DATA'; payload: MapData }
  | { type: 'INITIALIZE_DUMMY_PLAYER_STATE'; payload: { worldSeed: number; mapData: MapData; dynamicLocationItemIds: Record<string, string[]>; initialLocationDescription: string; initialSubMapCoordinates: { x: number; y: number }, initialActiveDynamicNpcIds: string[] | null } }
  | { type: 'SET_GEMINI_ACTIONS'; payload: Action[] | null }
  | { type: 'OPEN_CHARACTER_SHEET'; payload: PlayerCharacter }
  | { type: 'CLOSE_CHARACTER_SHEET' }
  | { type: 'SET_LAST_NPC_INTERACTION'; payload: { npcId: string | null; response: string | null } }
  | { type: 'RESET_NPC_INTERACTION_CONTEXT' }
  | { type: 'ADVANCE_TIME'; payload: { seconds: number } }
  | { type: 'INSPECT_SUBMAP_TILE'; payload: { inspectTileDetails: InspectSubmapTilePayload } }
  | { type: 'SET_DEV_MODE_ENABLED'; payload: boolean }
  | { type: 'TOGGLE_DEV_MENU' }
  | { type: 'TOGGLE_PARTY_EDITOR_MODAL' }
  | { type: 'TOGGLE_PARTY_OVERLAY' }
  | { type: 'TOGGLE_GEMINI_LOG_VIEWER' }
  | { type: 'TOGGLE_NPC_TEST_MODAL' }
  | { type: 'TOGGLE_NOBLE_HOUSE_LIST' }
  | { type: 'UPDATE_INSPECTED_TILE_DESCRIPTION'; payload: UpdateInspectedTileDescriptionPayload }
  // Discovery Journal Actions
  | { type: 'ADD_DISCOVERY_ENTRY'; payload: Partial<DiscoveryEntry> }
  | { type: 'MARK_DISCOVERY_READ'; payload: { entryId: string } }
  | { type: 'MARK_ALL_DISCOVERIES_READ' }
  | { type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' }
  | { type: 'TOGGLE_GLOSSARY_VISIBILITY'; payload?: { initialTermId?: string } }
  | { type: 'SET_GLOSSARY_TERM_FOR_MODAL'; payload: string }
  | { type: 'CLEAR_GLOSSARY_TERM_FOR_MODAL' }
  | { type: 'UPDATE_QUEST_IN_DISCOVERY_LOG'; payload: { questId: string; newStatus: string; newContent?: string } }
  | { type: 'CLEAR_DISCOVERY_LOG' }
  // Item Interaction Actions
  | { type: 'EQUIP_ITEM'; payload: EquipItemPayload }
  | { type: 'UNEQUIP_ITEM'; payload: UnequipItemPayload }
  | { type: 'USE_ITEM'; payload: UseItemPayload }
  | { type: 'DROP_ITEM'; payload: DropItemPayload }
  | { type: 'AUTO_EQUIP'; payload: { characterId: string } }
  // Merchant Actions
  | { type: 'OPEN_MERCHANT'; payload: { merchantName: string; inventory: Item[]; economy?: EconomyState } }
  | { type: 'CLOSE_MERCHANT' }
  | { type: 'BUY_ITEM'; payload: { item: Item; cost: number } }
  | { type: 'SELL_ITEM'; payload: { itemId: string; value: number } }
  | { type: 'OPEN_TEMPLE'; payload: { villageContext: VillageActionContext & { personality?: VillagePersonality } } }
  | { type: 'CLOSE_TEMPLE' }
  // Encounter Actions
  | { type: 'GENERATE_ENCOUNTER'; }
  | { type: 'SHOW_ENCOUNTER_MODAL'; payload: { encounterData: ShowEncounterModalPayload } }
  | { type: 'HIDE_ENCOUNTER_MODAL'; }
  // Battle Map Actions
  | { type: 'SETUP_BATTLE_MAP_DEMO' }
  | { type: 'START_BATTLE_MAP_ENCOUNTER'; payload: { startBattleMapEncounterData: StartBattleMapEncounterPayload } }
  | { type: 'END_BATTLE'; payload?: { rewards?: { gold: number; items: Item[]; xp: number } } }
  // Party Editor
  | { type: 'TOGGLE_PARTY_EDITOR_MODAL' }
  | { type: 'SET_PARTY_COMPOSITION'; payload: TempPartyMember[] }
  | { type: 'ADD_GENERATED_CHARACTER'; payload: PlayerCharacter }
  // Resource Management Actions
  | { type: 'ADD_ITEM'; payload: { itemId: string; count?: number } }
  | { type: 'REMOVE_ITEM'; payload: { itemId: string; count?: number } }
  | { type: 'MODIFY_GOLD'; payload: { amount: number } }
  | { type: 'GRANT_EXPERIENCE'; payload: { amount: number } }
  | { type: 'MODIFY_PARTY_HEALTH'; payload: { amount: number; characterIds?: string[] } }
  | { type: 'CAST_SPELL'; payload: { characterId: string; spellLevel: number } }
  | { type: 'USE_LIMITED_ABILITY'; payload: { characterId: string; abilityId: string } }
  | { type: 'TOGGLE_PREPARED_SPELL'; payload: { characterId: string; spellId: string } }
  | { type: 'LONG_REST'; payload?: { deniedCharacterIds?: string[] } }
  // Short rest updates can include healing, Hit Dice pool adjustments, and party-level rest tracking.
  | { type: 'SHORT_REST'; payload?: { healingByCharacterId?: Record<string, number>; hitPointDiceUpdates?: Record<string, HitPointDicePool[]>; shortRestTracker?: GameState['shortRestTracker'] } }
  // Religion Actions
  | { type: 'PRAY'; payload: { deityId: string; offering?: number } }
  | { type: 'TRIGGER_DEITY_ACTION'; payload: { trigger: string } }
  // NPC Memory Actions
  | { type: 'UPDATE_NPC_DISPOSITION'; payload: { npcId: string; amount: number } }
  | { type: 'ADD_NPC_KNOWN_FACT'; payload: { npcId: string; fact: KnownFact } }
  | { type: 'UPDATE_NPC_SUSPICION'; payload: { npcId: string; newLevel: SuspicionLevel } }
  | { type: 'UPDATE_NPC_GOAL_STATUS'; payload: { npcId: string; goalId: string; newStatus: GoalStatus } }
  | { type: 'REGISTER_GENERATED_NPC'; payload: { npc: RichNPC } }
  | { type: 'PROCESS_GOSSIP_UPDATES'; payload: GossipUpdatePayload }
  | { type: 'UPDATE_NPC_INTERACTION_TIMESTAMP'; payload: { npcId: string; timestamp: number } }
  | { type: 'BATCH_UPDATE_NPC_MEMORY'; payload: GameState['npcMemory'] }
  // Character Logbook Actions
  | { type: 'TOGGLE_LOGBOOK' }
  | { type: 'ADD_MET_NPC'; payload: { npcId: string } }
  // Gemini Log
  | { type: 'ADD_GEMINI_LOG_ENTRY'; payload: GeminiLogEntry }
  | { type: 'ADD_OLLAMA_LOG_ENTRY'; payload: import('../types').OllamaLogEntry }
  | { type: 'UPDATE_OLLAMA_LOG_ENTRY'; payload: { id: string; response: string; model?: string } }
  | { type: 'TOGGLE_OLLAMA_LOG_VIEWER' } | { type: 'TOGGLE_UNIFIED_LOG_VIEWER' }
  | { type: 'ADD_BANTER_DEBUG_LOG'; payload: { timestamp: Date; check: string; result: boolean | string; details?: string } }
  | { type: 'CLEAR_BANTER_DEBUG_LOG' }
  | { type: 'SET_RATE_LIMIT_ERROR_FLAG' }
  | { type: 'SET_DEV_MODEL_OVERRIDE'; payload: string | null }
  // World State Actions
  | { type: 'ADD_LOCATION_RESIDUE'; payload: AddLocationResiduePayload }
  | { type: 'REMOVE_LOCATION_RESIDUE'; payload: RemoveLocationResiduePayload }
  | { type: 'REGISTER_DYNAMIC_ENTITY'; payload: { entityType: 'location', entity: Location } | { entityType: 'faction', entity: Faction } | { entityType: 'npc', entity: NPC } }
  | { type: 'ADD_WORLD_HISTORY_EVENT'; payload: { event: WorldHistoryEvent } }
  // Gemini Intelligence Action
  | { type: 'ANALYZE_SITUATION' }
  // Dynamic Actions
  | { type: 'OPEN_DYNAMIC_MERCHANT' }
  | { type: 'HARVEST_RESOURCE' }
  // Game Guide
  | { type: 'TOGGLE_GAME_GUIDE' }
  // Ollama Dependency Modal
  | { type: 'SHOW_OLLAMA_DEPENDENCY_MODAL' }
  | { type: 'HIDE_OLLAMA_DEPENDENCY_MODAL' }
  // Character Update Actions
  | { type: 'UPDATE_CHARACTER_CHOICE'; payload: { characterId: string; choiceType: string; choiceId: string; secondaryValue?: { choices?: LevelUpChoices; xpGained?: number; isCantrip?: boolean } } }
  // Quest Actions
  | { type: 'ACCEPT_QUEST'; payload: Quest }
  | { type: 'UPDATE_QUEST_OBJECTIVE'; payload: { questId: string; objectiveId: string; isCompleted: boolean } }
  | { type: 'COMPLETE_QUEST'; payload: { questId: string } }
  // Companion Actions
  | { type: 'UPDATE_COMPANION_APPROVAL'; payload: { companionId: string; change: number; reason: string; source?: string } }
  | { type: 'ADD_COMPANION_REACTION'; payload: { companionId: string; reaction: string } }
  | { type: 'ADD_COMPANION_MEMORY'; payload: { companionId: string; memory: import('../types/companions').CompanionMemory } }
  | { type: 'ADD_DISCOVERED_FACT'; payload: { companionId: string; fact: import('../types/companions').DiscoveredFact } }
  | { type: 'ARCHIVE_BANTER'; payload: import('../types/companions').BanterMoment }
  | { type: 'UPDATE_BANTER_COOLDOWN'; payload: { banterId: string; timestamp: number } }
  // Notification Actions
  | { type: 'ADD_NOTIFICATION'; payload: { id?: string; type: 'success' | 'error' | 'info' | 'warning'; message: string; duration?: number } }
  | { type: 'REMOVE_NOTIFICATION'; payload: { id: string } }
  // Temple/Religion Actions (legacy scaffolding until temple flow is fully typed)
  | { type: 'USE_TEMPLE_SERVICE'; payload: { templeId: string; deityId: string; cost: number; effect: unknown } }
  | { type: 'REMOVE_GOLD'; payload: number }
  | { type: 'HEAL_CHARACTER'; payload: { characterId?: string; amount: number } }
  // Quest UI Actions
  | { type: 'TOGGLE_QUEST_LOG' }
  // Town Navigation Actions
  | { type: 'ENTER_TOWN'; payload: { townMap: import('../types/town').TownState['townMap']; entryPoint: import('../types/town').TownState['entryPoint']; spawnPosition: import('../types/town').TownPosition } }
  | { type: 'SET_TOWN_ENTRY_DIRECTION'; payload: { direction: 'north' | 'east' | 'south' | 'west' | null } }
  | { type: 'MOVE_IN_TOWN'; payload: { direction: import('../types/town').TownDirection } }
  | { type: 'STOP_MOVING_IN_TOWN' }
  | { type: 'SET_TOWN_VIEWPORT'; payload: { center?: import('../types/town').TownPosition; zoom?: number } }
  | { type: 'EXIT_TOWN' }
  // Notoriety Actions
  | { type: 'COMMIT_CRIME'; payload: { type: CrimeType; locationId: string; severity: number; witnessed: boolean } }
  | { type: 'LOWER_HEAT'; payload: { amount: number; locationId?: string } }
  | { type: 'INCREMENT_LOCAL_HEAT'; payload: { locationId: string; amount: number } }
  // Thieves Guild Actions
  | { type: 'TOGGLE_THIEVES_GUILD' }
  | { type: 'TOGGLE_THIEVES_GUILD_SAFEHOUSE' }
  | { type: 'JOIN_GUILD'; payload: { guildId: string } }
  | { type: 'ACCEPT_GUILD_JOB'; payload: { job: GuildJob } }
  | { type: 'COMPLETE_GUILD_JOB'; payload: { jobId: string; success: boolean; rewardGold: number; rewardRep: number } }
  | { type: 'ABANDON_GUILD_JOB'; payload: { jobId: string } }
  | { type: 'USE_GUILD_SERVICE'; payload: { serviceId: string; cost: number; description: string } }
  | { type: 'SET_AVAILABLE_GUILD_JOBS'; payload: { jobs: GuildJob[] } }
  // Heist Actions
  | { type: 'START_HEIST_PLANNING'; payload: { targetLocationId: string; leaderId: string; guildJobId?: string } }
  | { type: 'ADD_HEIST_INTEL'; payload: { intel: HeistIntel } }
  | { type: 'SELECT_HEIST_APPROACH'; payload: { approachType: string } }
  | { type: 'ADVANCE_HEIST_PHASE' }
  | { type: 'PERFORM_HEIST_ACTION'; payload: { actionDifficulty: number; description: string; success: boolean; alertChange: number; skillCheckResult?: string } }
  | { type: 'ABORT_HEIST' }
  // Identity & Intrigue Actions
  | { type: 'CREATE_ALIAS'; payload: CreateAliasPayload }
  | { type: 'EQUIP_DISGUISE'; payload: EquipDisguisePayload }
  | { type: 'REMOVE_DISGUISE' }
  | { type: 'LEARN_SECRET'; payload: LearnSecretPayload }
  // Castellan: Legacy & Stronghold Actions
  | { type: 'INIT_LEGACY'; payload: { familyName?: string } }
  | { type: 'ADD_LEGACY_TITLE'; payload: { title: string; description: string; grantedBy?: string } }
  | { type: 'ADD_LEGACY_MONUMENT'; payload: { name: string; description: string; locationId: string; cost: number } }
  | { type: 'REGISTER_HEIR'; payload: { name: string; relation: string; age: number; heirClass?: string } }
  | { type: 'FOUND_STRONGHOLD'; payload: { name: string; type: StrongholdType; locationId: string } }
  | { type: 'RECRUIT_STAFF'; payload: { strongholdId: string; name: string; role: StaffRole } }
  | { type: 'FIRE_STAFF'; payload: { strongholdId: string; staffId: string } }
  | { type: 'PURCHASE_UPGRADE'; payload: { strongholdId: string; upgradeId: string } }
  | { type: 'START_STRONGHOLD_MISSION'; payload: { strongholdId: string; staffId: string; type: MissionType; difficulty: number; description: string } }
  // Dialogue Actions
  | { type: 'START_DIALOGUE_SESSION'; payload: { npcId: string } }
  | { type: 'UPDATE_DIALOGUE_SESSION'; payload: { session: DialogueSession } }
  | { type: 'DISCUSS_TOPIC'; payload: { topicId: string; npcId: string; date: number } }
  | { type: 'END_DIALOGUE_SESSION' }
  // Ritual Actions
  | { type: 'START_RITUAL'; payload: RitualState }
  | { type: 'ADVANCE_RITUAL'; payload: { minutes: number } }
  | { type: 'INTERRUPT_RITUAL'; payload: { event: RitualEvent } }
  // TODO(lint-intent): The any on this value hides the intended shape of this data.
  // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
  // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
  | { type: 'COMPLETE_RITUAL'; payload: { result?: unknown } }
  // Naval Actions
  | { type: 'NAVAL_INITIALIZE_FLEET' }
  | { type: 'NAVAL_START_VOYAGE'; payload: { destinationId: string; distance: number } }
  | { type: 'NAVAL_ADVANCE_VOYAGE' }
  | { type: 'NAVAL_RECRUIT_CREW'; payload: { role: CrewRole } }
  | { type: 'NAVAL_REPAIR_SHIP'; payload: { amount: number; cost: number } }
  | { type: 'NAVAL_SET_ACTIVE_SHIP'; payload: { shipId: string } }
  | { type: 'TOGGLE_NAVAL_DASHBOARD' }
  | { type: 'TOGGLE_TRADE_ROUTE_DASHBOARD' }
  // Economy & Investment Actions
  | { type: 'INVEST_IN_CARAVAN'; payload: { tradeRouteId: string; goldAmount: number } }
  | { type: 'COLLECT_INVESTMENT'; payload: { investmentId: string } }
  | { type: 'TAKE_LOAN'; payload: { lenderId: string; factionId?: string; amount: number; interestRate: number; durationDays: number } }
  | { type: 'REPAY_LOAN'; payload: { investmentId: string; amount: number } }
  | { type: 'SPECULATE_ON_GOODS'; payload: { goodCategory: string; quantity: number; regionId: string; buyPrice: number } }
  | { type: 'SELL_SPECULATION'; payload: { investmentId: string; regionId: string } }
  | { type: 'TOGGLE_ECONOMY_LEDGER' }
  | { type: 'TOGGLE_COURIER_POUCH' }
  // Business Actions
  | { type: 'FOUND_BUSINESS'; payload: { strongholdId: string; businessType: import('../types/business').BusinessType } }
  | { type: 'SET_BUSINESS_PRICES'; payload: { businessId: string; priceMultiplier: number } }
  | { type: 'SIGN_SUPPLY_CONTRACT'; payload: { businessId: string; contract: import('../types/business').SupplyContract } }
  | { type: 'CANCEL_SUPPLY_CONTRACT'; payload: { businessId: string; contractId: string } }
  // World Business Actions (NPC-owned & acquisition)
  | { type: 'REGISTER_WORLD_BUSINESS'; payload: { business: import('../types/business').WorldBusiness } }
  | { type: 'PURCHASE_BUSINESS'; payload: { businessId: string; negotiatedPrice: number } }
  | { type: 'COERCE_BUSINESS_SALE'; payload: { businessId: string; discountPercent: number } }
  | { type: 'CREATE_PARTNERSHIP'; payload: { businessId: string; investmentAmount: number; playerSharePercent: number } }
  | { type: 'BUYOUT_PARTNER'; payload: { businessId: string; buyoutPrice: number } }
  | { type: 'ACCEPT_FACTION_GRANT'; payload: { factionId: string; locationId: string; businessType: import('../types/business').BusinessType } }
  | { type: 'FOUND_STANDALONE_BUSINESS'; payload: { locationId: string; businessType: import('../types/business').BusinessType } }
  | { type: 'ASSIGN_MANAGER'; payload: { businessId: string; npcId: string } }
  | { type: 'REMOVE_MANAGER'; payload: { businessId: string } }
  | { type: 'MANAGE_BUSINESS'; payload: { businessId: string } }
  | { type: 'DISSOLVE_PARTNERSHIP'; payload: { businessId: string } }
  // Crafting Actions
  | { type: 'INIT_CRAFTING_STATE'; payload: { toolProficiencies: string[] } }
  | { type: 'LEARN_RECIPE'; payload: { recipeId: string } }
  | { type: 'ADD_CRAFTING_XP'; payload: { amount: number } }
  | { type: 'UPDATE_CRAFTING_STATS'; payload: { quality: string; category: string; isNat20: boolean } }
  | { type: 'UNLOCK_ACHIEVEMENT'; payload: { achievementId: string } }
  | { type: 'SET_CRAFTING_LOCATION'; payload: { locationId: string } }
  // Interactive Conversation Actions
  | { type: 'START_CONVERSATION'; payload: { companionIds: string[]; initialMessage: import('../types/conversation').ConversationMessage } }
  | { type: 'ADD_CONVERSATION_MESSAGE'; payload: import('../types/conversation').ConversationMessage }
  | { type: 'SET_CONVERSATION_PENDING'; payload: boolean }
  | { type: 'END_CONVERSATION' }
  // Lockpicking Modal Actions
  | { type: 'TOGGLE_LOCKPICKING_MODAL' }
  | { type: 'OPEN_LOCKPICKING_MODAL'; payload: import('../systems/puzzles/types').Lock }
  | { type: 'CLOSE_LOCKPICKING_MODAL' }
  // Dice Roller Actions
  | { type: 'TOGGLE_DICE_ROLLER' }
  | { type: 'SET_VISUAL_DICE_ENABLED'; payload: boolean }
  | { type: 'RESTART_WITH_PROCEDURAL_PARTY'; payload: PlayerCharacter[] }
  // Journal Actions
  | { type: 'INIT_JOURNAL_STATE' }
  | { type: 'ADD_JOURNAL_ENTRY'; payload: import('../types/journal').JournalEntry }
  | { type: 'UPDATE_JOURNAL_ENTRY'; payload: { entryId: string; updates: Partial<import('../types/journal').JournalEntry> } }
  | { type: 'LOG_JOURNAL_EVENT'; payload: import('../types/journal').JournalEvent }
  | { type: 'CLEAR_PENDING_EVENTS' }
  | { type: 'INCREMENT_SESSION' };
