/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/types.ts
 *
 * Types for the GAME-ENTRY-SITUATION feature: a freshly Ollama-generated opening
 * predicament the player is dropped into the moment character creation finishes.
 *
 * There is intentionally NO canned/templated fallback shape here — the opening is
 * Ollama or an honest block (see docs/projects/worldforge/DECISIONS.md D-NOFB).
 */

/**
 * Where and when the opening situation takes place. Free-form strings the model
 * fills from the player's spawn context; surfaced as flavour, not mechanics.
 */
export interface SituationSetting {
    /** Concrete place ("the muddy market crossroads", "a collapsed mine mouth"). */
    place: string;
    /** Time of day descriptor ("dusk", "the grey hour before dawn"). */
    timeOfDay: string;
    /** Weather / atmosphere ("a thin cold drizzle", "still and oppressively hot"). */
    weather: string;
}

/**
 * An NPC already present in the opening situation. Not a companion — a stranger
 * the predicament places in front of the player. `id` is assigned by the
 * generator (so the conversation system can address it) and is unique per game.
 */
export interface SituationNPC {
    /** Runtime id, e.g. `situation-npc-...`. Assigned by the generator, not the model. */
    id: string;
    name: string;
    /** What they are to the scene ("a panicked caravan guard", "a smug toll collector"). */
    role: string;
    /** Their stance toward the player right now ("wary", "desperate for help", "hostile"). */
    disposition: string;
    /** What they want in this moment — drives how they respond. */
    goal: string;
}

/**
 * A single structured opening situation. This is the contract the generator
 * returns and the entry orchestration consumes.
 */
export interface OpeningSituation {
    setting: SituationSetting;
    /** 1–2 sentences of narration describing the predicament already in motion. */
    predicament: string;
    /** 1–3 NPCs present in the scene. The first is the one who speaks first. */
    npcs: SituationNPC[];
    /** The opening utterance, spoken by one of `npcs` (by `speakerId`). */
    openingLine: {
        /** Must match one of `npcs[].id`. */
        speakerId: string;
        text: string;
    };
    /** Optional 2–4 suggested replies the UI may offer the player. */
    suggestedReplies?: string[];
}

/**
 * Entry-flow state machine status.
 * - `idle`            — no opening pending (existing-save loads stay here).
 * - `generating`      — model is writing the situation; show a non-blocking overlay.
 * - `in-situation`    — situation generated; the conversation is open.
 * - `model-unavailable` — Ollama down / unparseable; show the dependency block + retry.
 */
export type GameEntryStatus = 'idle' | 'generating' | 'in-situation' | 'model-unavailable';

/**
 * The slice of GameState that tracks opening-situation entry.
 */
export interface GameEntryState {
    status: GameEntryStatus;
    /** The generated situation once resolved; null until then. */
    situation: OpeningSituation | null;
    /** Honest error string when status is `model-unavailable`; null otherwise. */
    error: string | null;
}

export const INITIAL_GAME_ENTRY_STATE: GameEntryState = {
    status: 'idle',
    situation: null,
    error: null,
};

/**
 * Character facts fed to the generator so the predicament is grounded in this PC.
 */
export interface OpeningSituationCharacter {
    name: string;
    race: string;
    characterClass: string;
    background: string;
}

/**
 * Spawn-location facts fed to the generator.
 */
export interface OpeningSituationLocation {
    name: string;
    biome?: string;
    timeOfDay?: string;
    weather?: string;
}
