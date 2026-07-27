/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 01:42:15
 * Dependents: hooks/useOpeningSituation.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/generateOpeningSituation.ts
 *
 * The opening-situation generator. Builds a character-grounded prompt, asks the
 * local Ollama model for a fresh predicament, and parses it into an
 * {@link OpeningSituation}.
 *
 * HARD RULE — no fallback (D-NOFB): if the model is unavailable or its output
 * cannot be parsed into a valid situation, this THROWS. The caller turns that
 * into the honest "Ollama required" block; it must never invent a scene.
 *
 * Non-determinism is intentional and lives here: the `opening_situation` task
 * profile is high-temperature and unseeded, so two new games with the same
 * character produce different openings. Tests inject a stub client + id factory
 * to keep assertions deterministic.
 */
import type { OllamaClient } from '../../services/ollama/client';
import type { OpeningSituation, OpeningSituationCharacter, OpeningSituationLocation } from './types';
/** Thrown when the local model is unavailable (not running / no model installed). */
export declare class OpeningSituationUnavailableError extends Error {
    constructor(message: string);
}
/** Thrown when the model responded but its output was not a usable situation. */
export declare class OpeningSituationParseError extends Error {
    readonly rawResponse: string;
    constructor(message: string, rawResponse: string);
}
export interface GenerateOpeningSituationDeps {
    /** Ollama client (injected in tests). Defaults to the shared singleton. */
    client?: OllamaClient;
    /** Id factory for NPC ids (injected in tests). Defaults to {@link generateId}. */
    idFactory?: () => string;
    /**
     * Dev-only mood override (from `?openingMood=peaceful|hostile`). It steers the
     * model's HOSTILITY choice so QA can reliably land a peaceful (or hostile)
     * opening for live verification. It does NOT invent a scene — the model still
     * writes the whole situation; this only fixes whether a `threat` block appears.
     */
    moodHint?: 'peaceful' | 'hostile';
}
/**
 * Build the generation prompt. Exported so tests can assert it is grounded in
 * the specific character (race/class/background/name) and location.
 */
export declare function buildOpeningSituationPrompt(character: OpeningSituationCharacter, location: OpeningSituationLocation, moodHint?: 'peaceful' | 'hostile'): string;
/**
 * Join a sequence of narration fragments into one clean sentence-run.
 *
 * The opening narration is glued from independently-authored pieces (place,
 * time of day, weather, predicament). Naively templating them (`a, b. c`)
 * produced artifacts when a fragment was itself a full, capitalised sentence:
 * e.g. `Sih — Day, The air is biting cold. The sun is high.. Testius...`
 * (a comma before a capitalised "The", and a doubled period when the weather
 * already ended in one). This normalises every join:
 *
 *  - trims each fragment and drops empties;
 *  - strips any trailing `,`/`;`/`.`/`!`/`?` the previous fragment carried;
 *  - re-terminates it with the punctuation the boundary needs — a sentence
 *    stop (`.`) when the next fragment starts a new (capitalised) sentence,
 *    otherwise a comma — so we never emit `,The`, `..`, or `. .`.
 *
 * Exported for unit testing and reuse by the conversation-seed assembly.
 */
export declare function joinNarrationFragments(fragments: Array<string | undefined>): string;
/**
 * Compose the seeded opening-narration line from a generated situation's setting
 * and predicament, free of the glue artifacts described on
 * {@link joinNarrationFragments}. The setting reads as `Place — Time` (an em-dash
 * locative header), then the weather and predicament follow as clean sentences.
 */
export declare function composeOpeningNarration(setting: {
    place?: string;
    timeOfDay?: string;
    weather?: string;
}, predicament: string): string;
/**
 * Drop generated situation NPCs that are really the PLAYER echoed back.
 *
 * The opening-situation model sometimes lists the player character themselves
 * as one of the scene's "strangers", which surfaced as a "Talk to <the
 * player>" action (talking to yourself). Any NPC whose name case-insensitively
 * matches a party member's name is removed BEFORE placement/conversation
 * seeding. If the filtered speaker was the echo, the opening line is
 * reassigned to the first surviving NPC. If EVERY generated NPC is a player
 * echo we keep the situation unchanged (a self-echo scene beats a crash — the
 * prompt-side "the player is NOT an NPC" instruction makes this vanishingly
 * rare).
 */
export declare function filterPlayerEchoNpcs(situation: OpeningSituation, partyNames: readonly string[]): OpeningSituation;
/**
 * Generate a fresh opening situation for a new game.
 *
 * @throws OpeningSituationUnavailableError if the model could not be reached.
 * @throws OpeningSituationParseError if the model output was not a valid situation.
 */
export declare function generateOpeningSituation(character: OpeningSituationCharacter, location: OpeningSituationLocation, deps?: GenerateOpeningSituationDeps): Promise<OpeningSituation>;
