/**
 * @file src/systems/intent/__tests__/resolvePlayerIntent.test.ts
 * Pins how the reader maps model output onto a game-legal intent, and that it
 * fails honestly rather than guessing (NO FALLBACK).
 */
import { describe, expect, it, vi } from 'vitest';
import { buildIntentPrompt, resolvePlayerIntent } from '../resolvePlayerIntent';
import type { IntentScene, IntentSkillInfo } from '../types';

const SCENE: IntentScene = {
    tension: 'A festival argument.',
    hostile: false,
    participants: ['Finnley Swiftfoot'],
};

const SKILLS: IntentSkillInfo[] = [
    { name: 'Performance', ability: 'Charisma', proficient: true, modifier: 5 },
    { name: 'Stealth', ability: 'Dexterity', proficient: false, modifier: 3 },
    { name: 'Persuasion', ability: 'Charisma', proficient: true, modifier: 5 },
];

/** A client that answers with one canned JSON body. */
const clientSaying = (body: unknown) => ({
    generateForTask: vi.fn(async () => ({
        ok: true as const,
        data: { response: typeof body === 'string' ? body : JSON.stringify(body) },
    })),
}) as any;

const read = (body: unknown) => resolvePlayerIntent('x', SCENE, SKILLS, { client: clientSaying(body) });

describe('resolvePlayerIntent', () => {
    it('reads plain talk', async () => {
        await expect(read({ kind: 'talk' })).resolves.toEqual({ kind: 'talk' });
    });

    it('reads an attack', async () => {
        await expect(read({ kind: 'attack' })).resolves.toEqual({ kind: 'attack' });
    });

    it('reads a skill attempt and resolves its ability from game data', async () => {
        const intent = await read({
            kind: 'skill', skill: 'Performance', stakes: 'moderate', dc: 13, rationale: 'dazzle them',
        });
        expect(intent).toEqual({
            kind: 'skill', skill: 'Performance', ability: 'Charisma',
            dc: 13, stakes: 'moderate', rationale: 'dazzle them',
        });
    });

    it('clamps a difficulty the model overreached on', async () => {
        const intent = await read({ kind: 'skill', skill: 'Performance', stakes: 'trivial', dc: 30 });
        expect(intent).toMatchObject({ dc: 10 });
    });

    it('reads flee as its own kind', async () => {
        const intent = await read({ kind: 'flee', skill: 'Stealth', stakes: 'moderate', dc: 12 });
        expect(intent).toMatchObject({ kind: 'flee', skill: 'Stealth', ability: 'Dexterity' });
    });

    it('reads an ambiguous line and keeps only real skills', async () => {
        const intent = await read({
            kind: 'ambiguous', candidateSkills: ['Persuasion', 'Deception', 'Jazz Hands'],
        });
        expect(intent).toEqual({ kind: 'ambiguous', candidateSkills: ['Persuasion', 'Deception'] });
    });

    it('treats a degenerate one-candidate ambiguity as the skill it named', async () => {
        const intent = await read({
            kind: 'ambiguous', candidateSkills: ['Persuasion'], skill: 'Persuasion', stakes: 'moderate', dc: 12,
        });
        expect(intent).toMatchObject({ kind: 'skill', skill: 'Persuasion' });
    });

    it('throws when the model names a skill that does not exist', async () => {
        // Downgrading an unreadable attempt to small talk would silently swallow
        // what the player tried to do.
        await expect(read({ kind: 'skill', skill: 'Jazz Hands', dc: 12 })).rejects.toThrow('rephrasing');
    });

    it('throws on unparseable output', async () => {
        await expect(read('not json at all')).rejects.toThrow('rephrasing');
    });

    it('throws with the transport error when the model is unreachable', async () => {
        const client = {
            generateForTask: vi.fn(async () => ({ ok: false as const, error: 'ECONNREFUSED' })),
        } as any;
        await expect(resolvePlayerIntent('x', SCENE, SKILLS, { client }))
            .rejects.toThrow('ECONNREFUSED');
    });

    it('routes through the judgment task profile, not a prose one', async () => {
        const client = clientSaying({ kind: 'talk' });
        await resolvePlayerIntent('x', SCENE, SKILLS, { client });
        expect(client.generateForTask).toHaveBeenCalledWith(
            expect.objectContaining({ taskType: 'situation_analysis', format: 'json' }),
        );
    });
});

describe('buildIntentPrompt', () => {
    it('keeps the talk-by-default guardrail', () => {
        // Losing this line turns every greeting into a die roll.
        const prompt = buildIntentPrompt('hello', SCENE, SKILLS);
        expect(prompt).toContain('prefer "talk"');
        expect(prompt).toContain('Do NOT invent a skill check for ordinary speech');
    });

    it('states the scene mood so the reader can judge violence in context', () => {
        expect(buildIntentPrompt('x', SCENE, SKILLS)).toContain('MOOD: peaceful');
        expect(buildIntentPrompt('x', { ...SCENE, hostile: true }, SKILLS)).toContain('HOSTILE');
    });

    it('lists the people present so a named target can be read', () => {
        expect(buildIntentPrompt('x', SCENE, SKILLS)).toContain('Finnley Swiftfoot');
    });
});
