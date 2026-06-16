/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/__tests__/generateOpeningSituation.test.ts
 *
 * Generator unit tests. Ollama is STUBBED — we cannot golden a live model, so we
 * inject a fake client and a deterministic id factory. These prove:
 *  - the prompt is grounded in THIS character (race/class/background/name) + place
 *  - a good model response maps to a valid OpeningSituation
 *  - model-unavailable THROWS (no fallback)
 *  - unparseable output THROWS (no fallback)
 */

import { describe, it, expect } from 'vitest';
import {
    generateOpeningSituation,
    buildOpeningSituationPrompt,
    OpeningSituationUnavailableError,
    OpeningSituationParseError,
} from '../generateOpeningSituation';
import type { OllamaClient } from '../../../services/ollama/client';
import type {
    OpeningSituationCharacter,
    OpeningSituationLocation,
} from '../types';

const CHARACTER: OpeningSituationCharacter = {
    name: 'Brannoch',
    race: 'Tiefling',
    characterClass: 'Warlock',
    background: 'Charlatan',
};

const LOCATION: OpeningSituationLocation = {
    name: 'Aralia Town Center',
    biome: 'plains',
};

/** Build a fake client whose generateForTask returns the given result. */
function fakeClient(
    impl: OllamaClient['generateForTask'],
    spy?: { calls: Array<{ taskType: string; prompt: string }> },
): OllamaClient {
    return {
        generateForTask: (async (opts: { taskType: string; prompt: string }) => {
            spy?.calls.push({ taskType: opts.taskType, prompt: opts.prompt });
            return impl(opts as never);
        }) as OllamaClient['generateForTask'],
    } as unknown as OllamaClient;
}

const GOOD_RESPONSE = JSON.stringify({
    setting: { place: 'the rain-slick market steps', timeOfDay: 'dusk', weather: 'cold drizzle' },
    predicament:
        'A toll collector has seized a merchant by the collar and the crowd is turning ugly.',
    npcs: [
        { name: 'Sergeant Volk', role: 'toll collector', disposition: 'aggressive', goal: 'extract a bribe' },
        { name: 'Mira', role: 'cornered merchant', disposition: 'frightened', goal: 'avoid arrest' },
    ],
    openingLine: { speakerName: 'Sergeant Volk', text: 'You there — this is no business of yours. Walk on.' },
    suggestedReplies: ['Let her go.', 'What is the toll?', 'Step aside.'],
});

describe('generateOpeningSituation', () => {
    it('builds a prompt grounded in the specific character and place', () => {
        const prompt = buildOpeningSituationPrompt(CHARACTER, LOCATION);
        expect(prompt).toContain('Brannoch');
        expect(prompt).toContain('Tiefling');
        expect(prompt).toContain('Warlock');
        expect(prompt).toContain('Charlatan');
        expect(prompt).toContain('Aralia Town Center');
        expect(prompt).toContain('plains');
    });

    it('passes the character-grounded prompt through the opening_situation task', async () => {
        const spy = { calls: [] as Array<{ taskType: string; prompt: string }> };
        const client = fakeClient(
            async () => ({ ok: true, data: { response: GOOD_RESPONSE }, model: 'stub' }),
            spy,
        );
        await generateOpeningSituation(CHARACTER, LOCATION, { client, idFactory: () => 'npc-x' });
        expect(spy.calls).toHaveLength(1);
        expect(spy.calls[0].taskType).toBe('opening_situation');
        expect(spy.calls[0].prompt).toContain('Brannoch');
        expect(spy.calls[0].prompt).toContain('Warlock');
    });

    it('maps a good model response to a valid OpeningSituation', async () => {
        let n = 0;
        const client = fakeClient(async () => ({ ok: true, data: { response: GOOD_RESPONSE }, model: 'stub' }));
        const situation = await generateOpeningSituation(CHARACTER, LOCATION, {
            client,
            idFactory: () => `npc-${n++}`,
        });

        expect(situation.setting.place).toBe('the rain-slick market steps');
        expect(situation.predicament).toContain('toll collector');
        expect(situation.npcs).toHaveLength(2);
        // Ids are assigned by the generator, not the model.
        expect(situation.npcs[0].id).toBe('npc-0');
        expect(situation.npcs[1].id).toBe('npc-1');
        // The opening line resolves to the named speaker's assigned id.
        expect(situation.openingLine.speakerId).toBe('npc-0');
        expect(situation.openingLine.text).toContain('Walk on');
        expect(situation.suggestedReplies).toEqual(['Let her go.', 'What is the toll?', 'Step aside.']);
    });

    it('THROWS (no fallback) when the model is unavailable', async () => {
        const client = fakeClient(async () => ({ ok: false, error: 'NO_MODEL' }));
        await expect(generateOpeningSituation(CHARACTER, LOCATION, { client })).rejects.toBeInstanceOf(
            OpeningSituationUnavailableError,
        );
    });

    it('THROWS (no fallback) when the output is unparseable', async () => {
        const client = fakeClient(async () => ({
            ok: true,
            data: { response: 'I am a chatty model and forgot to emit any JSON at all.' },
            model: 'stub',
        }));
        await expect(generateOpeningSituation(CHARACTER, LOCATION, { client })).rejects.toBeInstanceOf(
            OpeningSituationParseError,
        );
    });

    it('THROWS when JSON parses but lacks required structure (no NPC / no line)', async () => {
        const client = fakeClient(async () => ({
            ok: true,
            data: { response: JSON.stringify({ predicament: 'Something happens.', npcs: [] }) },
            model: 'stub',
        }));
        await expect(generateOpeningSituation(CHARACTER, LOCATION, { client })).rejects.toBeInstanceOf(
            OpeningSituationParseError,
        );
    });
});
