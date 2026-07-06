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
import { getDefaultClient } from '../../services/ollama/client';
import { parseJsonRobustly } from '../../services/ollama/jsonParser';
import { generateId } from '../../utils/core/idGenerator';
import type {
    OpeningSituation,
    OpeningSituationCharacter,
    OpeningSituationLocation,
    SituationNPC,
    SituationThreat,
} from './types';

/** Thrown when the local model is unavailable (not running / no model installed). */
export class OpeningSituationUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OpeningSituationUnavailableError';
    }
}

/** Thrown when the model responded but its output was not a usable situation. */
export class OpeningSituationParseError extends Error {
    readonly rawResponse: string;
    constructor(message: string, rawResponse: string) {
        super(message);
        this.name = 'OpeningSituationParseError';
        this.rawResponse = rawResponse;
    }
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

const SYSTEM_INSTRUCTION =
    'You are the opening Narrator and Game Master for Aralia, a gritty high-fantasy RPG. ' +
    'You drop the player into the MIDDLE of a situation already in motion — never a quiet, ' +
    'static scene. The player should feel they have just walked into a predicament and must ' +
    'respond. Ground everything in the specific character and place given. Output ONLY JSON.';

/**
 * Build the generation prompt. Exported so tests can assert it is grounded in
 * the specific character (race/class/background/name) and location.
 */
export function buildOpeningSituationPrompt(
    character: OpeningSituationCharacter,
    location: OpeningSituationLocation,
    moodHint?: 'peaceful' | 'hostile',
): string {
    const moodOverride =
        moodHint === 'peaceful'
            ? `\n\n## MOOD OVERRIDE (MANDATORY)\nThis opening MUST be PEACEFUL. Do NOT include a "threat" block. No violence is imminent — the predicament is social, mysterious, or opportunistic, resolvable by talking.`
            : moodHint === 'hostile'
              ? `\n\n## MOOD OVERRIDE (MANDATORY)\nThis opening MUST be a STANDOFF where violence is the real next beat. You MUST include a valid "threat" block.`
              : '';
    return `## CHARACTER (ground the situation in THIS person)
Name: ${character.name}
Race: ${character.race}
Class: ${character.characterClass}
Background: ${character.background}

## PLACE (FIXED — the player is HERE, do not relocate them)
Location: ${location.name}${location.biome ? `\nBiome: ${location.biome}` : ''}${
        location.timeOfDay ? `\nTime of day: ${location.timeOfDay}` : ''
    }${location.weather ? `\nWeather: ${location.weather}` : ''}

The player is standing in the named Location above. It is their actual starting
place on the world map — set the scene THERE and nowhere else. Your "setting.place"
MUST be this Location (you may add specific detail WITHIN it — a plaza, a gate, a
market row — but never move the scene to a different kind of place). Do NOT invent
an unrelated wilderness, forest, dungeon, road, or town. If the Location names a
settlement, the scene is inside that settlement, among its streets and people${
        location.biome ? `; the Biome describes the surrounding country, not a place to relocate the scene into` : ''
    }.

## TASK
Invent a fresh, specific predicament that is ALREADY HAPPENING as the player arrives —
something that demands a response in the next breath, set in the fixed Location above.
Place 1 to 3 strangers (not the player's allies) in the scene. The player character,
${character.name}, is NOT an NPC — never include them in "npcs" and never write lines
spoken as them. One of them speaks first,
directly drawing the player in. Make it grounded in who this character is (their class,
race, and background should matter) and exactly where they are. Be concrete, not generic.${
        location.timeOfDay || location.weather
            ? `\n\nThe time of day and weather above are FIXED by the world clock. Your ` +
              `"setting.timeOfDay" and "setting.weather" MUST match them — do not invent a ` +
              `different time or weather, and keep the predicament consistent with them.`
            : ''
    }

## HOSTILITY (usually OMIT this)
Most openings are NOT fights. But if the predicament is genuinely a standoff or
ambush where violence is a real next beat, add a "threat" block: the enemies as
REAL monster-manual names (bandit, wolf, goblin, cultist, thug, guard, etc.) with
a "cr" (challenge rating string like "1/8", "1/4", "1", "2") and a whole-number
"quantity"; a "deEscalationDC" chosen from this ladder by your toughest enemy's
CR — CR<=1/8 -> 10, CR 1/4-1 -> 13, CR 2-4 -> 15, CR 5+ -> 18; and a short "tension"
phrase. If the scene is peaceful, DO NOT include "threat".

## OUTPUT
Output ONLY this JSON shape, nothing else:
{
  "setting": { "place": "string", "timeOfDay": "string", "weather": "string" },
  "predicament": "1-2 sentences of narration describing what is happening",
  "npcs": [
    { "name": "string", "role": "string", "disposition": "string", "goal": "string" }
  ],
  "openingLine": { "speakerName": "name of the npc who speaks", "text": "what they say" },
  "suggestedReplies": ["2 to 4 short things the player could say"],
  "threat": { "hostile": true, "enemies": [{ "name": "string", "quantity": 1, "cr": "1/8" }], "deEscalationDC": 13, "tension": "string" }
}${moodOverride}`;
}

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
export function joinNarrationFragments(fragments: Array<string | undefined>): string {
    const parts = fragments
        .map((f) => (typeof f === 'string' ? f.trim() : ''))
        .filter((f) => f.length > 0);
    if (parts.length === 0) return '';

    let out = '';
    for (let i = 0; i < parts.length; i += 1) {
        const isLast = i === parts.length - 1;
        // Strip whatever terminal punctuation/whitespace this fragment carried so
        // we control the join boundary ourselves (no doubled or mismatched marks).
        // The LAST fragment keeps its own trailing sentence punctuation — a
        // predicament may legitimately end in `!`, `?`, or `...` and we preserve it.
        const core = isLast
            ? parts[i].replace(/[\s,;]+$/u, '')
            : parts[i].replace(/[\s,;.!?]+$/u, '');
        if (!core) continue;

        if (out === '') {
            out = core;
            continue;
        }

        // A fragment that opens with a capital (or opening quote/paren followed by
        // one) reads as a NEW sentence, so the previous clause must be closed with
        // a sentence stop rather than a comma.
        const startsNewSentence = /^["'“‘([]?[A-Z]/u.test(parts[i]);
        out += startsNewSentence ? `. ${core}` : `, ${core}`;
    }

    // Ensure the whole run ends in sentence punctuation (add a period only if the
    // last fragment did not already provide `.`/`!`/`?`).
    return /[.!?]$/u.test(out) ? out : `${out}.`;
}

/**
 * Compose the seeded opening-narration line from a generated situation's setting
 * and predicament, free of the glue artifacts described on
 * {@link joinNarrationFragments}. The setting reads as `Place — Time` (an em-dash
 * locative header), then the weather and predicament follow as clean sentences.
 */
export function composeOpeningNarration(
    setting: { place?: string; timeOfDay?: string; weather?: string },
    predicament: string,
): string {
    const place = setting.place?.trim();
    const timeOfDay = setting.timeOfDay?.trim();
    // "Place — Time" keeps the locative header readable; the em-dash join is part
    // of the header, not a sentence boundary, so build it before normalisation.
    const header =
        place && timeOfDay ? `${place} — ${timeOfDay}` : place || timeOfDay || '';
    return joinNarrationFragments([header, setting.weather, predicament]);
}

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
export function filterPlayerEchoNpcs(
    situation: OpeningSituation,
    partyNames: readonly string[],
): OpeningSituation {
    const names = new Set(
        partyNames.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0),
    );
    if (names.size === 0) return situation;

    const kept = situation.npcs.filter((n) => !names.has(n.name.trim().toLowerCase()));
    if (kept.length === situation.npcs.length || kept.length === 0) return situation;

    const speakerSurvives = kept.some((n) => n.id === situation.openingLine.speakerId);
    return {
        ...situation,
        npcs: kept,
        openingLine: speakerSurvives
            ? situation.openingLine
            : { ...situation.openingLine, speakerId: kept[0].id },
    };
}

interface RawSituation {
    setting?: Partial<{ place: string; timeOfDay: string; weather: string }>;
    predicament?: string;
    npcs?: Array<Partial<{ name: string; role: string; disposition: string; goal: string }>>;
    openingLine?: Partial<{ speakerName: string; speakerId: string; text: string }>;
    suggestedReplies?: unknown;
    threat?: {
        hostile?: unknown;
        enemies?: Array<Partial<{ name: string; quantity: number; cr: string }>>;
        deEscalationDC?: unknown;
        tension?: unknown;
    };
}

/**
 * Generate a fresh opening situation for a new game.
 *
 * @throws OpeningSituationUnavailableError if the model could not be reached.
 * @throws OpeningSituationParseError if the model output was not a valid situation.
 */
export async function generateOpeningSituation(
    character: OpeningSituationCharacter,
    location: OpeningSituationLocation,
    deps: GenerateOpeningSituationDeps = {},
): Promise<OpeningSituation> {
    const client = deps.client ?? getDefaultClient();
    const idFactory = deps.idFactory ?? generateId;

    const prompt = `${SYSTEM_INSTRUCTION}\n\n${buildOpeningSituationPrompt(character, location, deps.moodHint)}`;

    const result = await client.generateForTask({
        taskType: 'opening_situation',
        prompt,
        // Explicit json format so the model grounds its output as an object.
        format: 'json',
    });

    if (!result.ok) {
        // NO_MODEL or any transport failure → honest block, never a canned scene.
        throw new OpeningSituationUnavailableError(
            result.error === 'NO_MODEL'
                ? 'No Ollama model available to generate the opening situation.'
                : `Ollama unavailable: ${result.error}`,
        );
    }

    const raw = parseJsonRobustly<RawSituation>(result.data.response);
    const situation = raw ? mapRawSituation(raw, idFactory, location) : null;
    if (!situation) {
        throw new OpeningSituationParseError(
            'Model output could not be parsed into an opening situation.',
            result.data.response,
        );
    }
    return situation;
}

/** Validate a raw threat block. Returns undefined (peaceful scene) if malformed. */
function mapThreat(raw: RawSituation['threat']): SituationThreat | undefined {
    if (!raw || raw.hostile !== true) return undefined;
    const enemies = (Array.isArray(raw.enemies) ? raw.enemies : [])
        .filter((e) => e && typeof e.name === 'string' && e.name.trim().length > 0)
        .map((e) => ({
            name: (e.name as string).trim(),
            quantity: Math.max(1, Math.min(8, Math.floor(Number(e.quantity) || 1))),
            cr: typeof e.cr === 'string' && e.cr.trim() ? e.cr.trim() : '0',
        }));
    if (enemies.length === 0) return undefined;
    const dc = Number(raw.deEscalationDC);
    if (!Number.isFinite(dc) || dc < 5 || dc > 25) return undefined;
    const tension = typeof raw.tension === 'string' ? raw.tension.trim() : '';
    return { hostile: true, enemies, deEscalationDC: Math.round(dc), tension };
}

/**
 * Map loosely-typed model JSON into a validated OpeningSituation, assigning
 * runtime NPC ids and resolving the speaker. Returns null if the output lacks
 * the minimum required structure (predicament + at least one named NPC + line).
 */
function mapRawSituation(
    raw: RawSituation,
    idFactory: () => string,
    location?: OpeningSituationLocation,
): OpeningSituation | null {
    const predicament = typeof raw.predicament === 'string' ? raw.predicament.trim() : '';
    const rawNpcs = Array.isArray(raw.npcs) ? raw.npcs : [];

    const npcs: SituationNPC[] = rawNpcs
        .filter((n) => n && typeof n.name === 'string' && n.name.trim().length > 0)
        .slice(0, 3)
        .map((n) => ({
            id: idFactory(),
            name: (n.name as string).trim(),
            role: typeof n.role === 'string' ? n.role.trim() : 'stranger',
            disposition: typeof n.disposition === 'string' ? n.disposition.trim() : 'neutral',
            goal: typeof n.goal === 'string' ? n.goal.trim() : '',
        }));

    const lineText =
        raw.openingLine && typeof raw.openingLine.text === 'string'
            ? raw.openingLine.text.trim()
            : '';

    if (!predicament || npcs.length === 0 || !lineText) {
        return null;
    }

    // Resolve which NPC speaks: prefer a name match, else the first NPC.
    const spokenName = raw.openingLine?.speakerName?.trim().toLowerCase();
    const speaker =
        npcs.find((n) => n.name.toLowerCase() === spokenName) ?? npcs[0];

    const suggestedReplies = Array.isArray(raw.suggestedReplies)
        ? raw.suggestedReplies
              .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
              .map((r) => r.trim())
              .slice(0, 4)
        : undefined;

    return {
        setting: {
            // Anchor the displayed place to the AUTHORITATIVE start location so the
            // narration can never contradict the settlement the player chose at
            // Start Point Selection (G5: model once placed a 51k-pop capital "in the
            // heart of an ancient forest"). The model's free-text place is only a
            // fallback for dev/skip flows that pass no location.
            place: location?.name?.trim() || raw.setting?.place?.trim() || 'an unnamed place',
            timeOfDay: raw.setting?.timeOfDay?.trim() || 'an uncertain hour',
            weather: raw.setting?.weather?.trim() || 'still air',
        },
        predicament,
        npcs,
        openingLine: { speakerId: speaker.id, text: lineText },
        suggestedReplies: suggestedReplies && suggestedReplies.length > 0 ? suggestedReplies : undefined,
        threat: mapThreat(raw.threat),
    };
}
