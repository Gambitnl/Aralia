
/**
 * @file src/state/actionTypes.ts
 * Defines the main AppAction type for the application's state management.
 */
import { GameState, GamePhase, GameMessage, PlayerCharacter, Item, MapData, TempPartyMember, StartGameSuccessPayload, Action, SuspicionLevel, GeminiLogEntry, GoalStatus, KnownFact, GossipUpdatePayload, AddLocationResiduePayload, RemoveLocationResiduePayload, EconomyState, Quest, DiscoveryEntry, CrimeType } from '../types';

export type AppAction =
  | { type: 'SET_GAME_PHASE'; payload: GamePhase }
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
  | { type: 'TOGGLE_SUBMAP_VISIBILITY' }
  | { type: 'SET_MAP_DATA'; payload: MapData }
  | { type: 'INITIALIZE_DUMMY_PLAYER_STATE'; payload: { mapData: MapData; dynamicLocationItemIds: Record<string, string[]>; initialLocationDescription: string; initialSubMapCoordinates: { x: number; y: number }, initialActiveDynamicNpcIds: string[] | null } }
  | { type: 'SET_GEMINI_ACTIONS'; payload: Action[] | null }
  | { type: 'OPEN_CHARACTER_SHEET'; payload: PlayerCharacter }
  | { type: 'CLOSE_CHARACTER_SHEET' }
  | { type: 'SET_LAST_NPC_INTERACTION'; payload: { npcId: string | null; response: string | null } }
  | { type: 'RESET_NPC_INTERACTION_CONTEXT' }
  | { type: 'ADVANCE_TIME'; payload: { seconds: number } }
  | { type: 'INSPECT_SUBMAP_TILE'; payload: any }
  | { type: 'TOGGLE_DEV_MENU' }
  | { type: 'TOGGLE_PARTY_EDITOR_MODAL' }
  | { type: 'TOGGLE_PARTY_OVERLAY' }
  | { type: 'TOGGLE_GEMINI_LOG_VIEWER' }
  | { type: 'TOGGLE_NPC_TEST_MODAL' }
  | { type: 'UPDATE_INSPECTED_TILE_DESCRIPTION'; payload: any }
  // Discovery Journal Actions
  | { type: 'ADD_DISCOVERY_ENTRY'; payload: any }
  | { type: 'MARK_DISCOVERY_READ'; payload: { entryId: string } }
  | { type: 'MARK_ALL_DISCOVERIES_READ' }
  | { type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' }
  | { type: 'TOGGLE_GLOSSARY_VISIBILITY'; payload?: { initialTermId?: string } }
  | { type: 'SET_GLOSSARY_TERM_FOR_MODAL'; payload: string }
  | { type: 'CLEAR_GLOSSARY_TERM_FOR_MODAL' }
  | { type: 'UPDATE_QUEST_IN_DISCOVERY_LOG'; payload: { questId: string; newStatus: string; newContent?: string } }
  | { type: 'CLEAR_DISCOVERY_LOG' }
  // Item Interaction Actions
  | { type: 'EQUIP_ITEM'; payload: any }
  | { type: 'UNEQUIP_ITEM'; payload: any }
  | { type: 'USE_ITEM'; payload: any }
  | { type: 'DROP_ITEM'; payload: any }
  // Merchant Actions
  | { type: 'OPEN_MERCHANT'; payload: { merchantName: string; inventory: Item[]; economy?: EconomyState } }
  | { type: 'CLOSE_MERCHANT' }
  | { type: 'BUY_ITEM'; payload: { item: Item; cost: number } }
  | { type: 'SELL_ITEM'; payload: { itemId: string; value: number } }
  // Encounter Actions
  | { type: 'GENERATE_ENCOUNTER'; }
  | { type: 'SHOW_ENCOUNTER_MODAL'; payload: { encounterData: any } }
  | { type: 'HIDE_ENCOUNTER_MODAL'; }
  // Battle Map Actions
  | { type: 'SETUP_BATTLE_MAP_DEMO' }
  | { type: 'START_BATTLE_MAP_ENCOUNTER'; payload: any }
  | { type: 'END_BATTLE'; payload?: { rewards?: { gold: number; items: Item[]; xp: number } } }
  // Party Editor
  | { type: 'TOGGLE_PARTY_EDITOR_MODAL' }
  | { type: 'SET_PARTY_COMPOSITION'; payload: TempPartyMember[] }
  | { type: 'ADD_GENERATED_CHARACTER'; payload: PlayerCharacter }
  // Resource Management Actions
  | { type: 'CAST_SPELL'; payload: { characterId: string; spellLevel: number } }
  | { type: 'USE_LIMITED_ABILITY'; payload: { characterId: string; abilityId: string } }
  | { type: 'TOGGLE_PREPARED_SPELL'; payload: { characterId: string; spellId: string } }
  | { type: 'LONG_REST'; payload?: { deniedCharacterIds?: string[] } }
  | { type: 'SHORT_REST' }
  // NPC Memory Actions
  | { type: 'UPDATE_NPC_DISPOSITION'; payload: { npcId: string; amount: number } }
  | { type: 'ADD_NPC_KNOWN_FACT'; payload: { npcId: string; fact: KnownFact } }
  | { type: 'UPDATE_NPC_SUSPICION'; payload: { npcId: string; newLevel: SuspicionLevel } }
  | { type: 'UPDATE_NPC_GOAL_STATUS'; payload: { npcId: string; goalId: string; newStatus: GoalStatus } }
  | { type: 'PROCESS_Gossip_UPDATES'; payload: GossipUpdatePayload }
  | { type: 'UPDATE_NPC_INTERACTION_TIMESTAMP'; payload: { npcId: string; timestamp: number } }
  | { type: 'BATCH_UPDATE_NPC_MEMORY'; payload: GameState['npcMemory'] }
  // Character Logbook Actions
  | { type: 'TOGGLE_LOGBOOK' }
  | { type: 'ADD_MET_NPC'; payload: { npcId: string } }
  // Gemini Log
  | { type: 'ADD_GEMINI_LOG_ENTRY'; payload: GeminiLogEntry }
  | { type: 'SET_RATE_LIMIT_ERROR_FLAG' }
  | { type: 'SET_DEV_MODEL_OVERRIDE'; payload: string | null }
  // World State Actions
  | { type: 'ADD_LOCATION_RESIDUE'; payload: AddLocationResiduePayload }
  | { type: 'REMOVE_LOCATION_RESIDUE'; payload: RemoveLocationResiduePayload }
  // Gemini Intelligence Action
  | { type: 'ANALYZE_SITUATION' }
  // Dynamic Actions
  | { type: 'OPEN_DYNAMIC_MERCHANT' }
  | { type: 'HARVEST_RESOURCE' }
  // Game Guide
  | { type: 'TOGGLE_GAME_GUIDE' }
  // Character Update Actions
  | { type: 'UPDATE_CHARACTER_CHOICE'; payload: { characterId: string; choiceType: string; choiceId: string; secondaryValue?: any } }
  // Quest Actions
  | { type: 'ACCEPT_QUEST'; payload: Quest }
  | { type: 'UPDATE_QUEST_OBJECTIVE'; payload: { questId: string; objectiveId: string; isCompleted: boolean } }
  | { type: 'COMPLETE_QUEST'; payload: { questId: string } }
  // Companion Actions
  | { type: 'UPDATE_COMPANION_APPROVAL'; payload: { companionId: string; change: number; reason: string; source?: string } }
  | { type: 'ADD_COMPANION_REACTION'; payload: { companionId: string; reaction: string } }
  // Notification Actions
  | { type: 'ADD_NOTIFICATION'; payload: { type: 'success' | 'error' | 'info' | 'warning'; message: string; duration?: number } }
  | { type: 'REMOVE_NOTIFICATION'; payload: { id: string } }
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
  | { type: 'LOWER_HEAT'; payload: { amount: number; locationId?: string } };
