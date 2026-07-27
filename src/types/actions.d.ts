/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 13:27:17
 * Dependents: components/Combat/BattlefieldSourceGap.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleNpcInteraction.ts, hooks/actions/handleResourceActions.ts, systems/combat/fightInPlace/activeGroundCombatSession.ts, systems/combat/fightInPlace/authoredTownWatchSourceGap.ts, types/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { EquipmentSlotType, Item } from './items.js';
import { Monster, Location, VillageActionContext, DiscoveryResidue, GoalStatus, GossipUpdatePayload } from './world.js';
import { Quest } from './quests.js';
import { TempPartyMember, PlayerCharacter, HitPointDiceSpendMap } from './character.js';
import { Faction } from './factions.js';
import { DialogueSession } from './dialogue.js';
import type { Lock, Puzzle } from '../systems/puzzles/types.js';
import type { BattleMapData, CombatCharacter, WorldforgeCombatantSource } from './combat.js';
export interface CastSpellSource {
    type: 'racial';
    /**
     * If true, and no racial resource is available, allow falling back to spell slots.
     * Useful for traits that can alternatively be cast with class spell slots.
     */
    allowSlotFallback?: boolean;
}
export interface CastSpellPayload {
    characterId: string;
    spellLevel: number;
    spellId?: string;
    castSource?: CastSpellSource;
    materialComponentItemIdToConsume?: string;
    /**
     * Present when the cast comes from the spellbook OUTSIDE combat.
     * The CAST_SPELL handler then applies the spell's out-of-combat effects
     * (healing, buffs) to the named party member after deducting the slot.
     */
    outOfCombat?: {
        targetCharacterId: string;
    };
}
export type ActionType = 'move' | 'look_around' | 'talk' | 'take_item' | 'USE_ITEM' | 'custom' | 'ask_oracle' | 'toggle_map' | 'toggle_three_d' | 'toggle_auto_save' | 'gemini_custom_action' | 'save_game' | 'go_to_main_menu' | 'toggle_dev_menu' | 'toggle_party_editor' | 'toggle_party_overlay' | 'toggle_gemini_log_viewer' | 'TOGGLE_NPC_TEST_MODAL' | 'TOGGLE_DISCOVERY_LOG' | 'TOGGLE_GLOSSARY_VISIBILITY' | 'TOGGLE_LOGBOOK' | 'TOGGLE_COMMERCE_DESK' | 'ADD_MET_NPC' | 'EQUIP_ITEM' | 'UNEQUIP_ITEM' | 'DROP_ITEM' | 'SET_LOADING' | 'GENERATE_ENCOUNTER' | 'TRIGGER_AI_ENCOUNTER' | 'SHOW_ENCOUNTER_MODAL' | 'HIDE_ENCOUNTER_MODAL' | 'START_BATTLE_MAP_ENCOUNTER' | 'END_BATTLE' | 'CAST_SPELL' | 'USE_LIMITED_ABILITY' | 'LONG_REST' | 'TOGGLE_LONG_REST_MODAL' | 'SHORT_REST' | 'TOGGLE_PREPARED_SPELL' | 'UPDATE_NPC_GOAL_STATUS' | 'PROCESS_GOSSIP_UPDATES' | 'ADD_LOCATION_RESIDUE' | 'REMOVE_LOCATION_RESIDUE' | 'QUICK_TRAVEL' | 'OPEN_MERCHANT' | 'CLOSE_MERCHANT' | 'BUY_ITEM' | 'SELL_ITEM' | 'OPEN_DYNAMIC_MERCHANT' | 'OPEN_TEMPLE' | 'CLOSE_TEMPLE' | 'USE_TEMPLE_SERVICE' | 'OPEN_LOCKPICKING_MODAL' | 'OPEN_PUZZLE_RUNTIME' | 'HARVEST_RESOURCE' | 'SEARCH_AREA' | 'BARTER_ITEMS' | 'HAGGLE_ITEM' | 'ANALYZE_SITUATION' | 'wait' | 'TOGGLE_GAME_GUIDE' | 'UPDATE_CHARACTER_CHOICE' | 'ACCEPT_QUEST' | 'UPDATE_QUEST_OBJECTIVE' | 'COMPLETE_QUEST' | 'TOGGLE_QUEST_LOG' | 'PRAY' | 'AUTO_EQUIP' | 'TOGGLE_THIEVES_GUILD' | 'REGISTER_DYNAMIC_ENTITY' | 'ATTUNE_ITEM' | 'UNATTUNE_ITEM' | 'TOGGLE_ITEM_JUNK' | 'SELL_ALL_JUNK' | 'START_DIALOGUE_SESSION' | 'UPDATE_DIALOGUE_SESSION' | 'END_DIALOGUE_SESSION' | 'SET_DEV_MODE_ENABLED' | 'OPEN_NOTICE_BOARD' | 'OPEN_BROADSHEET' | 'TAKE_BROADSHEET' | 'READ_ITEM';
/**
 * Metadata for actions to control UI behavior like loading spinners.
 */
export interface ActionMetadata {
    /** If true, this action is a UI toggle and should NOT trigger the global loading spinner. */
    isUiToggle?: boolean;
    /** If true, the handler for this action manages its own loading state. */
    managesLoading?: boolean;
}
/**
 * Registry of action behavior metadata.
 */
export declare const ACTION_METADATA: Partial<Record<ActionType, ActionMetadata>>;
export interface MerchantActionPayload {
    merchantId?: string;
    interactorId?: string;
    strategy?: 'persuade' | 'intimidate' | 'insight' | 'appraise' | 'barter' | 'deceive' | 'lore_check';
    priceMultiplier?: number;
    transaction?: {
        buy?: {
            item: Item;
            cost: number;
            quantity?: number;
        };
        sell?: {
            itemId: string;
            value: number;
            quantity?: number;
        };
        barter?: {
            offeredItemIds: string[];
            requestedItemIds: string[];
            goldOffset: number;
        };
    };
}
export interface EquipItemPayload {
    itemId: string;
    characterId: string;
}
export interface UnequipItemPayload {
    slot: EquipmentSlotType;
    characterId: string;
}
export interface UseItemPayload {
    itemId: string;
    characterId: string;
}
export interface DropItemPayload {
    itemId: string;
    characterId: string;
}
export interface AddLocationResiduePayload {
    locationId: string;
    residue: DiscoveryResidue;
}
export interface RemoveLocationResiduePayload {
    locationId: string;
}
export interface SetLoadingPayload {
    isLoading: boolean;
    message?: string | null;
}
export interface QuestOffer {
    /**
     * Minimal dialogue-to-quest handoff payload.
     *
     * Dialogue outcomes only name the quest they are offering; action handlers
     * resolve that id through the existing quest registry so NPC dialogue does
     * not have to duplicate full quest objects or invent a second quest shape.
     */
    questId: string;
}
export interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    };
}
export interface ShowEncounterModalPayload {
    encounter?: Monster[];
    sources?: GroundingChunk[];
    error?: string;
    partyUsed?: TempPartyMember[];
}
/**
 * Structured explanation for a production encounter that cannot supply its
 * real WorldForge battlefield. The action boundary carries this record into
 * CombatView so the fail-closed screen can name the exact encounter and source
 * facts that are missing instead of showing a generic placeless-combat error.
 */
export interface BattlefieldSourceGapReason {
    /** Stable diagnostic code for inventory, tests, and deterministic fixtures. */
    code: string;
    /** Player-readable encounter class, such as a wanted watch confrontation. */
    encounterLabel: string;
    /** The authored location that needs a canonical WorldForge mapping. */
    locationLabel: string;
    /** Source facts required before tactical play can start honestly. */
    missingSourceFacts: string[];
    /** Complete human-readable reason; must never suggest substitute terrain. */
    detail: string;
}
export interface StartBattleMapEncounterPayload {
    monsters: Monster[];
    /**
     * Declares that production combat is intentionally withheld. A source-gap
     * payload is mutually exclusive with monsters, prepared combatants, source
     * identities, and extracted terrain; the encounter launcher enforces that
     * invariant before dispatch.
     */
    sourceGap?: BattlefieldSourceGapReason;
    /**
     * Combat-ready enemy instances can be prepared by the action layer so the
     * root reducer does not need to import the full combat utility stack during
     * the main-menu startup path.
     */
    combatants?: CombatCharacter[];
    /**
     * Optional source identities in the same flattened order as the encounter
     * roster. The encounter bridge attaches them after bestiary construction so
     * generated-world roles and positions survive into combat diagnostics.
     */
    combatantWorldSources?: WorldforgeCombatantSource[];
    /**
     * Tactical projection of the encounter's real WorldForge location. The field
     * remains optional at the action boundary so incomplete encounter classes can
     * reach the visible source-gap state, but production CombatView never replaces
     * an omission with procedural terrain.
     */
    extractedBattleMap?: BattleMapData;
}
export interface QuickTravelPayload {
    destination: {
        x: number;
        y: number;
    };
    durationSeconds: number;
    orderedPath?: Array<{
        x: number;
        y: number;
    }>;
    stepDurationsSeconds?: number[];
    encounterChancePerStep?: number;
    stepDelayMs?: number;
}
export interface StartGameSuccessPayload {
    character: PlayerCharacter;
    dynamicLocationItemIds: Record<string, string[]>;
    initialLocationDescription: string;
    initialLocationId?: string;
    initialActiveDynamicNpcIds: string[] | null;
    startingInventory: Item[];
    worldHistory?: import('./history.js').WorldHistory;
    worldSeed?: number;
    startTownName?: string;
    startTownRegion?: string;
    entry3DAnchor?: import('./state.js').Entry3DAnchor | null;
    playerCell?: import('./state.js').PlayerCell | null;
}
export type Action = {
    type: 'move';
    payload: {
        query?: string;
        geminiPrompt?: string;
    };
    label?: string;
    targetId?: string;
} | {
    type: 'look_around';
    payload?: {
        query?: string;
    };
    label?: string;
} | {
    type: 'talk';
    payload: {
        targetNpcId?: string;
        query?: string;
        isEgregious?: boolean;
        questOffer?: QuestOffer;
        recruitOffer?: {
            targetNpcId: string;
            autoAccept?: boolean;
        };
    };
    label?: string;
    targetId?: string;
} | {
    type: 'take_item';
    payload: {
        itemId: string;
    };
    label?: string;
    targetId?: string;
} | {
    type: 'USE_ITEM';
    payload: UseItemPayload;
    label?: string;
} | {
    type: 'custom';
    payload?: {
        villageContext?: VillageActionContext;
    };
    label?: string;
} | {
    type: 'ask_oracle';
    payload: {
        query: string;
    };
    label?: string;
} | {
    type: 'toggle_map';
    payload?: never;
    label?: string;
} | {
    type: 'toggle_three_d';
    payload?: never;
    label?: string;
} | {
    type: 'toggle_auto_save';
    payload?: never;
    label?: string;
} | {
    type: 'gemini_custom_action';
    payload: {
        query?: string;
        geminiPrompt?: string;
        check?: string;
        targetNpcId?: string;
        eventResidue?: unknown;
        isEgregious?: boolean;
    };
    label?: string;
} | {
    type: 'save_game';
    payload?: never;
    label?: string;
} | {
    type: 'go_to_main_menu';
    payload?: never;
    label?: string;
} | {
    type: 'toggle_dev_menu';
    payload?: never;
    label?: string;
} | {
    type: 'toggle_party_editor';
    payload?: never;
    label?: string;
} | {
    type: 'toggle_party_overlay';
    payload?: never;
    label?: string;
} | {
    type: 'toggle_gemini_log_viewer';
    payload?: never;
    label?: string;
} | {
    type: 'TOGGLE_NPC_TEST_MODAL';
    payload?: never;
    label?: string;
} | {
    type: 'TOGGLE_DISCOVERY_LOG';
    payload?: never;
    label?: string;
} | {
    type: 'TOGGLE_GLOSSARY_VISIBILITY';
    payload?: {
        initialTermId?: string;
    };
    label?: string;
} | {
    type: 'TOGGLE_LOGBOOK';
    payload?: never;
    label?: string;
} | {
    type: 'TOGGLE_COMMERCE_DESK';
    payload?: never;
    label?: string;
} | {
    type: 'ADD_MET_NPC';
    payload: {
        npcId: string;
    };
    label?: string;
} | {
    type: 'EQUIP_ITEM';
    payload: EquipItemPayload;
    label?: string;
} | {
    type: 'UNEQUIP_ITEM';
    payload: UnequipItemPayload;
    label?: string;
} | {
    type: 'DROP_ITEM';
    payload: DropItemPayload;
    label?: string;
} | {
    type: 'SET_LOADING';
    payload: SetLoadingPayload;
    label?: string;
} | {
    type: 'GENERATE_ENCOUNTER';
    payload?: never;
    label?: string;
} | {
    type: 'SHOW_ENCOUNTER_MODAL';
    payload?: {
        encounterData: ShowEncounterModalPayload;
    };
    label?: string;
} | {
    type: 'HIDE_ENCOUNTER_MODAL';
    payload?: never;
    label?: string;
} | {
    type: 'START_BATTLE_MAP_ENCOUNTER';
    payload?: {
        startBattleMapEncounterData: StartBattleMapEncounterPayload;
    };
    label?: string;
} | {
    type: 'END_BATTLE';
    payload?: never;
    label?: string;
} | {
    type: 'CAST_SPELL';
    payload: CastSpellPayload;
    label?: string;
} | {
    type: 'USE_LIMITED_ABILITY';
    payload: {
        characterId: string;
        abilityId: string;
    };
    label?: string;
} | {
    type: 'LONG_REST';
    payload?: never;
    label?: string;
} | {
    type: 'TOGGLE_LONG_REST_MODAL';
    payload?: never;
    label?: string;
} | {
    type: 'SHORT_REST';
    payload?: {
        hitPointDiceSpend?: HitPointDiceSpendMap;
    };
    label?: string;
} | {
    type: 'TOGGLE_PREPARED_SPELL';
    payload: {
        characterId: string;
        spellId: string;
    };
    label?: string;
} | {
    type: 'UPDATE_NPC_GOAL_STATUS';
    payload: {
        npcId: string;
        goalId: string;
        status: GoalStatus;
    };
    label?: string;
} | {
    type: 'PROCESS_GOSSIP_UPDATES';
    payload: GossipUpdatePayload;
    label?: string;
} | {
    type: 'ADD_LOCATION_RESIDUE';
    payload: AddLocationResiduePayload;
    label?: string;
} | {
    type: 'REMOVE_LOCATION_RESIDUE';
    payload: RemoveLocationResiduePayload;
    label?: string;
} | {
    type: 'QUICK_TRAVEL';
    payload: {
        quickTravel: QuickTravelPayload;
    };
    label?: string;
} | {
    type: 'OPEN_MERCHANT';
    payload: {
        merchantName: string;
        inventory: Item[];
        economy?: import('./economy.js').EconomyState;
    };
    label?: string;
} | {
    type: 'CLOSE_MERCHANT';
    payload?: unknown;
    label?: string;
} | {
    type: 'BUY_ITEM';
    payload: MerchantActionPayload;
    label?: string;
} | {
    type: 'SELL_ITEM';
    payload: MerchantActionPayload;
    label?: string;
} | {
    type: 'BARTER_ITEMS';
    payload: MerchantActionPayload;
    label?: string;
} | {
    type: 'HAGGLE_ITEM';
    payload: MerchantActionPayload;
    label?: string;
} | {
    type: 'OPEN_DYNAMIC_MERCHANT';
    payload: {
        merchantType: string;
        villageContext?: VillageActionContext;
        buildingId?: string;
        seedKey?: string;
        hire?: boolean;
    };
    label?: string;
} | {
    type: 'OPEN_TEMPLE';
    payload: {
        villageContext: VillageActionContext;
    };
    label?: string;
} | {
    type: 'CLOSE_TEMPLE';
    payload?: never;
    label?: string;
} | {
    type: 'USE_TEMPLE_SERVICE';
    payload: {
        templeId: string;
        deityId: string;
        cost: number;
        effect: unknown;
    };
    label?: string;
} | {
    type: 'OPEN_LOCKPICKING_MODAL';
    payload: Lock;
    label?: string;
} | {
    type: 'OPEN_PUZZLE_RUNTIME';
    payload: Puzzle;
    label?: string;
} | {
    type: 'HARVEST_RESOURCE';
    payload: {
        harvestContext?: string;
        skillCheck?: {
            skill: string;
            dc: number;
        };
    };
    label?: string;
} | {
    type: 'SEARCH_AREA';
    payload?: never;
    label?: string;
} | {
    type: 'ANALYZE_SITUATION';
    payload?: never;
    label?: string;
} | {
    type: 'wait';
    payload?: {
        seconds?: number;
    };
    label?: string;
} | {
    type: 'TOGGLE_GAME_GUIDE';
    payload?: never;
    label?: string;
} | {
    type: 'UPDATE_CHARACTER_CHOICE';
    payload: {
        characterId: string;
        choiceType: string;
        choiceId: string;
        secondaryValue?: unknown;
    };
    label?: string;
} | {
    type: 'ACCEPT_QUEST';
    payload: Quest;
    label?: string;
} | {
    type: 'UPDATE_QUEST_OBJECTIVE';
    payload: {
        questId: string;
        objectiveId: string;
        isCompleted: boolean;
    };
    label?: string;
} | {
    type: 'COMPLETE_QUEST';
    payload: {
        questId: string;
    };
    label?: string;
} | {
    type: 'TOGGLE_QUEST_LOG';
    payload?: never;
    label?: string;
} | {
    type: 'PRAY';
    payload: {
        deityId: string;
        offering?: number;
    };
    label?: string;
} | {
    type: 'AUTO_EQUIP';
    payload: {
        characterId: string;
    };
    label?: string;
} | {
    type: 'ATTUNE_ITEM';
    payload: {
        characterId: string;
        itemId: string;
    };
    label?: string;
} | {
    type: 'UNATTUNE_ITEM';
    payload: {
        characterId: string;
        itemId: string;
    };
    label?: string;
} | {
    type: 'TOGGLE_ITEM_JUNK';
    payload: {
        itemId: string;
    };
    label?: string;
} | {
    type: 'SELL_ALL_JUNK';
    payload: {
        items: {
            itemId: string;
            value: number;
        }[];
    };
    label?: string;
} | {
    type: 'TOGGLE_THIEVES_GUILD';
    payload?: never;
    label?: string;
} | {
    type: 'REGISTER_DYNAMIC_ENTITY';
    payload: {
        entityType: 'location' | 'faction';
        entity: Location | Faction;
    };
    label?: string;
} | {
    type: 'START_DIALOGUE_SESSION';
    payload: {
        npcId: string;
    };
    label?: string;
} | {
    type: 'UPDATE_DIALOGUE_SESSION';
    payload: {
        session: DialogueSession;
    };
    label?: string;
} | {
    type: 'END_DIALOGUE_SESSION';
    payload?: never;
    label?: string;
} | {
    type: 'SET_DEV_MODE_ENABLED';
    payload: {
        enabled: boolean;
    };
    label?: string;
} | {
    type: 'OPEN_NOTICE_BOARD';
    payload?: never;
    label?: string;
} | {
    type: 'OPEN_BROADSHEET';
    payload?: never;
    label?: string;
} | {
    type: 'TAKE_BROADSHEET';
    payload?: never;
    label?: string;
} | {
    type: 'READ_ITEM';
    payload: {
        itemId: string;
    };
    label?: string;
};
