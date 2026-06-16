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
): string {
    return `## CHARACTER (ground the situation in THIS person)
Name: ${character.name}
Race: ${character.race}
Class: ${character.characterClass}
Background: ${character.background}

## PLACE
Location: ${location.name}${location.biome ? `\nBiome: ${location.biome}` : ''}${
        location.timeOfDay ? `\nTime of day: ${location.timeOfDay}` : ''
    }${location.weather ? `\nWeather: ${location.weather}` : ''}

## TASK
Invent a fresh, specific predicament that is ALREADY HAPPENING as the player arrives —
something that demands a response in the next breath. Place 1 to 3 strangers (not the
player's allies) in the scene. One of them speaks first, directly drawing the player in.
Make it grounded in who this character is (their class, race, and background should matter)
and where they are. Be concrete, not generic.

## OUTPUT
Output ONLY this JSON shape, nothing else:
{
  "setting": { "place": "string", "timeOfDay": "string", "weather": "string" },
  "predicament": "1-2 sentences of narration describing what is happening",
  "npcs": [
    { "name": "string", "role": "string", "disposition": "string", "goal": "string" }
  ],
  "openingLine": { "speakerName": "name of the npc who speaks", "text": "what they say" },
  "suggestedReplies": ["2 to 4 short things the player could say"]
}`;
}

interface RawSituation {
    setting?: Partial<{ place: string; timeOfDay: string; weather: string }>;
    predicament?: string;
    npcs?: Array<Partial<{ name: string; role: string; disposition: string; goal: string }>>;
    openingLine?: Partial<{ speakerName: string; speakerId: string; text: string }>;
    suggestedReplies?: unknown;
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

    const prompt = `${SYSTEM_INSTRUCTION}\n\n${buildOpeningSituationPrompt(character, location)}`;

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
    const situation = raw ? mapRawSituation(raw, idFactory) : null;
    if (!situation) {
        throw new OpeningSituationParseError(
            'Model output could not be parsed into an opening situation.',
            result.data.response,
        );
    }
    return situation;
}

/**
 * Map loosely-typed model JSON into a validated OpeningSituation, assigning
 * runtime NPC ids and resolving the speaker. Returns null if the output lacks
 * the minimum required structure (predicament + at least one named NPC + line).
 */
function mapRawSituation(raw: RawSituation, idFactory: () => string): OpeningSituation | null {
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
            place: raw.setting?.place?.trim() || 'an unnamed place',
            timeOfDay: raw.setting?.timeOfDay?.trim() || 'an uncertain hour',
            weather: raw.setting?.weather?.trim() || 'still air',
        },
        predicament,
        npcs,
        openingLine: { speakerId: speaker.id, text: lineText },
        suggestedReplies: suggestedReplies && suggestedReplies.length > 0 ? suggestedReplies : undefined,
    };
}
