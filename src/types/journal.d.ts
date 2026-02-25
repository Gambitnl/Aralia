/**
 * @file src/types/journal.ts
 * Type definitions for the Journal system including journal entries,
 * session recaps, and auto-logging events.
 */
/**
 * Categories of events that can be auto-logged to the journal.
 */
export type JournalEventType = 'combat_victory' | 'quest_accepted' | 'quest_completed' | 'quest_failed' | 'item_acquired' | 'location_discovered' | 'npc_met' | 'npc_conversation' | 'level_up' | 'party_change' | 'rest' | 'death' | 'resurrection' | 'merchant_trade' | 'skill_check' | 'custom';
/**
 * An automatically logged game event.
 */
export interface JournalEvent {
    id: string;
    type: JournalEventType;
    timestamp: number;
    gameTime: string;
    title: string;
    description: string;
    questId?: string;
    locationId?: string;
    npcId?: string;
    itemIds?: string[];
    xpGained?: number;
    goldChange?: number;
}
/**
 * Loot entry for session recaps.
 */
export interface JournalLootEntry {
    id: string;
    name: string;
    quantity: number;
    type: 'gold' | 'item' | 'magical_item';
    isIdentified: boolean;
}
/**
 * A key event in a session recap.
 */
export interface SessionKeyEvent {
    id: string;
    description: string;
    isCompleted: boolean;
    isQuestion?: boolean;
}
/**
 * Current objectives tracked in the session.
 */
export interface SessionObjective {
    id: string;
    description: string;
    priority: 'primary' | 'secondary';
    questId?: string;
}
/**
 * Structured session recap (right page of journal).
 */
export interface SessionRecap {
    sessionNumber: number;
    keyEvents: SessionKeyEvent[];
    loot: JournalLootEntry[];
    currentObjectives: SessionObjective[];
    notes?: string;
}
/**
 * A narrative journal entry (left page of journal).
 */
export interface JournalEntry {
    id: string;
    sessionNumber: number;
    gameDate: string;
    gameYear: string;
    pageNumber: number;
    narrativeText: string;
    sketchNotes?: string;
    recap: SessionRecap;
    autoLoggedEvents: JournalEvent[];
    createdAt: number;
    updatedAt: number;
}
/**
 * Overall journal state stored in GameState.
 */
export interface JournalState {
    entries: JournalEntry[];
    currentSessionNumber: number;
    currentPageNumber: number;
    pendingEvents: JournalEvent[];
}
/**
 * Creates the default initial journal state.
 */
export declare function createInitialJournalState(): JournalState;
