// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 16/07/2026, 01:41:45
 * Dependents: hooks/useDeEscalation.ts, hooks/useOpeningSituation.ts, state/appState.ts, state/initialState.ts, state/reducers/gameEntryReducer.ts, systems/combat/fightInPlace/activeGroundCombatSession.ts, systems/combat/worldScenario/openingThreatBattlefield.ts, systems/gameEntry/deEscalationToCombat.ts, systems/gameEntry/entryStateMachine.ts, systems/gameEntry/generateOpeningSituation.ts, systems/gameEntry/openingQuest.ts, systems/gameEntry/openingScenePrompt.ts, systems/gameEntry/situationNpcToRichNpc.ts, systems/social/watchReaction.ts, utils/core/factories.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

// ============================================================================
// Canonical Opening Battlefield Source
// ============================================================================
// The language model writes the social predicament and enemy roster, but it is
// never allowed to choose where the battle happens. This receipt is stamped by
// game state before generation and follows a hostile threat into combat so the
// mounted GroundWorld can prove it is projecting the same starting location.
// ============================================================================

export interface OpeningBattlefieldSource {
    kind: 'worldforge-opening-location';
    /** Stable lineage for logs, tactical provenance, and the World Battle Lab. */
    receiptId: string;
    /** World seed that authored the opening's atlas cell and live GroundWorld. */
    worldSeed: number;
    /** Canonical atlas cell occupied when the opening situation was generated. */
    cellId: number;
    /** Optional burg/site center used to frame the initial Locale window. */
    centerPx?: readonly [number, number];
    /** Player-facing location name retained without asking combat to recreate it. */
    locationLabel: string;
}

/**
 * A hostile opening scene's combat data. Present only when the model flags the
 * scene combat-capable; absent scenes behave exactly as a peaceful opening.
 */
export interface SituationThreat {
    hostile: true;
    /** Enemies as REAL bestiary monsters; mapped via createEnemyFromMonster.
     *  `cr` is the monster's Challenge Rating string (e.g. "1/8", "2"). */
    enemies: Array<{ name: string; quantity: number; cr: string }>;
    /** De-escalation check DC, scaled by the toughest enemy's CR (5..25). */
    deEscalationDC: number;
    /** Short cue describing what the tension is, used to judge de-escalation. */
    tension: string;
    /** Game-authored location receipt; never accepted from model output. */
    battlefieldSource?: OpeningBattlefieldSource;
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
    /** Present when the scene is hostile/combat-capable. Omitted for peaceful openings. */
    threat?: SituationThreat;
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
 * Lifecycle of the opening-scene illustration request (parallels the portrait
 * pattern). The image is generated asynchronously after the situation resolves;
 * it never blocks the conversation.
 * - `idle`       — not requested (e.g. flag off, or a non-opening entry).
 * - `generating` — request in flight; show a non-blocking placeholder.
 * - `ready`      — `url` holds a locally served image to display.
 * - `error`      — generation failed; show an honest "unavailable" note (NO FALLBACK).
 */
export type SceneImageStatus = 'idle' | 'generating' | 'ready' | 'error';

/**
 * Async state for the opening-scenario establishing illustration.
 */
export interface SceneImageState {
    status: SceneImageStatus;
    /** Raw URL returned by /api/scenes/generate (run through assetUrl before use); null until ready. */
    url: string | null;
    /** Honest error string when status is `error`; null otherwise. */
    error: string | null;
}

export const INITIAL_SCENE_IMAGE_STATE: SceneImageState = {
    status: 'idle',
    url: null,
    error: null,
};

/**
 * The slice of GameState that tracks opening-situation entry.
 */
export interface GameEntryState {
    status: GameEntryStatus;
    /** The generated situation once resolved; null until then. */
    situation: OpeningSituation | null;
    /** Honest error string when status is `model-unavailable`; null otherwise. */
    error: string | null;
    /** The establishing scene illustration for this opening (async, optional enrichment). */
    sceneImage: SceneImageState;
}

export const INITIAL_GAME_ENTRY_STATE: GameEntryState = {
    status: 'idle',
    situation: null,
    error: null,
    sceneImage: INITIAL_SCENE_IMAGE_STATE,
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
    /** Canonical combat source stamped from GameState, not exposed to the model. */
    battlefieldSource?: OpeningBattlefieldSource;
}
