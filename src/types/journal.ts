/**
 * @file src/types/journal.ts
 * Type definitions for the Journal system including journal entries,
 * session recaps, and auto-logging events.
 */

/**
 * Categories of events that can be auto-logged to the journal.
 */
export type JournalEventType =
    | 'combat_victory'      // Defeated enemies in combat
    | 'quest_accepted'      // New quest started
    | 'quest_completed'     // Quest finished successfully
    | 'quest_failed'        // Quest failed or abandoned
    | 'item_acquired'       // Magical/significant item obtained
    | 'location_discovered' // New location found
    | 'npc_met'             // First meeting with important NPC
    | 'npc_conversation'    // Significant dialogue
    | 'level_up'            // Character gained a level
    | 'party_change'        // Member joined/left party
    | 'rest'                // Long or short rest
    | 'death'               // Character died
    | 'resurrection'        // Character brought back
    | 'merchant_trade'      // Significant purchase/sale
    | 'skill_check'         // Notable skill check outcome
    | 'custom';             // Manual player entry

/**
 * An automatically logged game event.
 */
export interface JournalEvent {
    id: string;
    type: JournalEventType;
    timestamp: number;          // Real-world timestamp
    gameTime: string;           // In-game date/time formatted
    title: string;              // Short summary
    description: string;        // Detailed description
    questId?: string;           // Related quest if applicable
    locationId?: string;        // Where it happened
    npcId?: string;             // Related NPC if applicable
    itemIds?: string[];         // Related items
    xpGained?: number;          // XP if relevant
    goldChange?: number;        // Gold gained/lost
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
    isCompleted: boolean;       // Check mark vs question mark
    isQuestion?: boolean;       // Unresolved mystery
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
    gameDate: string;           // In-game date formatted (e.g., "The 14th of Kythorn")
    gameYear: string;           // In-game year (e.g., "Year 1492 DR")
    pageNumber: number;
    narrativeText: string;      // The prose/diary entry
    sketchNotes?: string;       // Player notes section
    recap: SessionRecap;
    autoLoggedEvents: JournalEvent[];
    createdAt: number;          // Real-world timestamp
    updatedAt: number;
}

/**
 * Overall journal state stored in GameState.
 */
export interface JournalState {
    entries: JournalEntry[];
    currentSessionNumber: number;
    currentPageNumber: number;
    pendingEvents: JournalEvent[];  // Events not yet assigned to an entry
}

/**
 * Creates the default initial journal state.
 */
export function createInitialJournalState(): JournalState {
    return {
        entries: [],
        currentSessionNumber: 1,
        currentPageNumber: 1,
        pendingEvents: [],
    };
}
