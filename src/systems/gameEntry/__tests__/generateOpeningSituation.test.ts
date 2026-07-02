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
    joinNarrationFragments,
    composeOpeningNarration,
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

/**
 * Build a deps bundle whose stub client resolves the given raw JSON string as an
 * `ok` model response, plus a deterministic id factory. Mirrors the inline stub
 * pattern used by the other tests so new cases slot in without ceremony.
 */
function makeDeps(rawResponse: string) {
    let n = 0;
    const client = fakeClient(async () => ({
        ok: true,
        data: { response: rawResponse },
        model: 'stub',
    }));
    return { client, idFactory: () => `npc-${n++}` };
}

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

        // G5: the displayed place is ANCHORED to the authoritative start location
        // (here 'Aralia Town Center'), NOT the model's free-text place — this is
        // what stops a chosen capital city being narrated as an "ancient forest".
        expect(situation.setting.place).toBe('Aralia Town Center');
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

    it('parses a valid threat block when the model flags the scene hostile', async () => {
        const raw = JSON.stringify({
            setting: { place: 'the toll bridge', timeOfDay: 'dusk', weather: 'cold drizzle' },
            predicament: 'Two toll-collectors block the bridge, hands on their hilts.',
            npcs: [{ name: 'Garrok', role: 'toll-collector', disposition: 'greedy', goal: 'shake you down' }],
            openingLine: { speakerName: 'Garrok', text: 'Pay the toll — or bleed.' },
            suggestedReplies: ['Pay up', 'Refuse'],
            threat: {
                hostile: true,
                enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }],
                deEscalationDC: 13,
                tension: 'toll-collectors itching to rob you',
            },
        });
        const situation = await generateOpeningSituation(CHARACTER, LOCATION, makeDeps(raw));
        expect(situation.threat).toEqual({
            hostile: true,
            enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }],
            deEscalationDC: 13,
            tension: 'toll-collectors itching to rob you',
        });
    });

    it('drops a malformed threat but keeps the (peaceful) scene', async () => {
        const raw = JSON.stringify({
            setting: { place: 'a plaza', timeOfDay: 'noon', weather: 'clear' },
            predicament: 'A crowd parts around a shouting herald.',
            npcs: [{ name: 'Herald', role: 'town crier', disposition: 'loud', goal: 'be heard' }],
            openingLine: { speakerName: 'Herald', text: 'Hear ye!' },
            threat: { hostile: true, enemies: [{ name: '', quantity: 0, cr: '' }], deEscalationDC: 999 },
        });
        const situation = await generateOpeningSituation(CHARACTER, LOCATION, makeDeps(raw));
        expect(situation.threat).toBeUndefined();
        expect(situation.predicament).toContain('herald');
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

describe('opening-narration glue normalisation (G4/X4)', () => {
    it('joins fragments without comma-before-capital or doubled-period artifacts', () => {
        // The exact shape from the bug report: a capitalised, period-terminated
        // weather sentence glued after a time-of-day word, then the predicament.
        const text = composeOpeningNarration(
            { place: 'Sih', timeOfDay: 'Day', weather: 'The air is biting cold. The sun is high.' },
            'Testius Maximus blocks the gate.',
        );
        expect(text).toBe(
            'Sih — Day. The air is biting cold. The sun is high. Testius Maximus blocks the gate.',
        );
        // Regression guards for the two specific artifacts.
        expect(text).not.toContain('..');
        expect(text).not.toMatch(/,\s+[A-Z]/u); // no comma before a capitalised sentence
    });

    it('uses a comma boundary for lower-case continuation fragments', () => {
        expect(joinNarrationFragments(['a quiet square', 'cold drizzle'])).toBe(
            'a quiet square, cold drizzle.',
        );
    });

    it('preserves terminal sentence punctuation and drops empty fragments', () => {
        expect(joinNarrationFragments(['Dawn', undefined, '', 'Something stirs!'])).toBe(
            'Dawn. Something stirs!',
        );
        expect(joinNarrationFragments([])).toBe('');
    });

    it('builds the Place — Time header even when weather is absent', () => {
        expect(composeOpeningNarration({ place: 'Sih', timeOfDay: 'Day' }, 'A scream.')).toBe(
            'Sih — Day. A scream.',
        );
    });
});
