/**
 * Copyright (c) 2025 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/prophecy.ts
 * Defines types for the Prophecy and Fate system.
 * Used by "Knowledge & Secrets" and "Emergent Narrative" pillars.
 */
import { GameDate } from './memory';
/**
 * A cryptic prediction about the future.
 * Prophecies can be self-fulfilling, misinterpreted, or actively subverted.
 * They serve as long-term quest arcs or world state drivers.
 */
export interface Prophecy {
    id: string;
    /**
     * The actual prophetic text, usually written in verse or cryptic language.
     * e.g. "When the silver hand touches the iron crown, the wolf shall howl no more."
     */
    text: string;
    /**
     * The origin of the prophecy.
     * Could be an NPC ("The Oracle of Ash"), a deity, an item ("The Black Scroll"), or a dream.
     */
    source: string;
    /**
     * When this prophecy was first revealed or recorded.
     */
    dateRevealed: GameDate;
    /**
     * The entities or concepts this prophecy is believed to be about.
     * A prophecy might be about "The King" generally, or a specific NPC ID.
     */
    subjects: ProphecySubject[];
    /**
     * The current state of the prophecy.
     */
    status: ProphecyStatus;
    /**
     * The conditions tracked by the system to determine if the prophecy advances.
     * These are hidden mechanical triggers behind the cryptic text.
     */
    triggers: ProphecyTrigger[];
    /**
     * The possible outcomes when the prophecy is resolved.
     * A prophecy might have a "Literal" outcome and a "Twisted" outcome.
     */
    outcomes: ProphecyOutcome[];
    /**
     * Known interpretations of the text by in-game scholars or the player.
     * Different factions may interpret the same prophecy differently.
     */
    interpretations: ProphecyInterpretation[];
}
/**
 * The status of a prophecy's lifecycle.
 */
export type ProphecyStatus = 'dormant' | 'active' | 'fulfilled' | 'averted' | 'invalidated' | 'misinterpreted';
/**
 * An entity that is the subject of a prophecy.
 */
export interface ProphecySubject {
    /**
     * The type of subject.
     */
    type: 'player' | 'npc' | 'faction' | 'location' | 'item' | 'concept';
    /**
     * The specific ID, if known.
     * If null, the subject is not yet identified (e.g. "A hero yet unknown").
     */
    id: string | null;
    /**
     * The role in the prophecy text.
     * e.g. "The Silver Hand", "The Betrayer", "The innocent".
     */
    role: string;
}
/**
 * A mechanical condition that advances the prophecy.
 * Hidden from players, but derived from the text.
 */
export interface ProphecyTrigger {
    id: string;
    /**
     * Description of the event to watch for.
     * e.g. "Target NPC acquires the Iron Crown"
     */
    conditionDescription: string;
    /**
     * Is this condition currently met?
     */
    isMet: boolean;
    /**
     * When this trigger was met.
     */
    dateMet?: GameDate;
}
/**
 * A potential resolution to the prophecy.
 */
export interface ProphecyOutcome {
    id: string;
    /**
     * e.g. "The King dies", "The Kingdom falls", "The Curse is lifted"
     */
    description: string;
    /**
     * The type of outcome.
     */
    type: 'calamity' | 'blessing' | 'change' | 'revelation';
    /**
     * Consequences to apply if this outcome occurs.
     * Can trigger world events, reputation changes, etc.
     */
    consequences: string[];
}
/**
 * An in-universe interpretation of the prophecy.
 */
export interface ProphecyInterpretation {
    id: string;
    /**
     * Who holds this belief? (Faction ID, Scholar name, or 'Player')
     */
    believedBy: string;
    /**
     * Explanation of what they think the text means.
     */
    theory: string;
    /**
     * How confident they are (0-100).
     */
    confidence: number;
    /**
     * Is this interpretation actually correct according to the system logic?
     * (Hidden from UI, used for dramatic irony or hints).
     */
    isAccurate: boolean;
}
