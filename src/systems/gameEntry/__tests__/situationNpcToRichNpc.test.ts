/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/__tests__/situationNpcToRichNpc.test.ts
 *
 * Proves a generated situational NPC becomes a placeable RichNPC grounded in the
 * scene (role mapping, disposition/goal personality, speaker dialogue seed).
 */

import { describe, it, expect } from 'vitest';
import {
    mapSituationRole,
    situationNpcToRichNpc,
    situationNpcsToRichNpcs,
} from '../situationNpcToRichNpc';
import type { OpeningSituation, SituationNPC } from '../types';

const VOLK: SituationNPC = {
    id: 'sit-1',
    name: 'Sergeant Volk',
    role: 'toll guard captain',
    disposition: 'aggressive',
    goal: 'extract a bribe',
};

const MIRA: SituationNPC = {
    id: 'sit-2',
    name: 'Mira',
    role: 'cornered apothecary',
    disposition: 'frightened',
    goal: 'avoid arrest',
};

const SITUATION: OpeningSituation = {
    setting: { place: 'p', timeOfDay: 't', weather: 'w' },
    predicament: 'A toll guard seizes a merchant.',
    npcs: [VOLK, MIRA],
    openingLine: { speakerId: 'sit-1', text: 'Walk on, this is no business of yours.' },
};

describe('mapSituationRole', () => {
    it('maps free-text roles to the engine role enum', () => {
        expect(mapSituationRole('toll guard captain')).toBe('guard');
        expect(mapSituationRole('cornered apothecary')).toBe('merchant');
        expect(mapSituationRole('a cryptic stranger')).toBe('unique');
        expect(mapSituationRole('a passing farmhand')).toBe('civilian');
    });
});

describe('situationNpcToRichNpc', () => {
    it('preserves the situational id and name', () => {
        const rich = situationNpcToRichNpc(VOLK, SITUATION.openingLine);
        expect(rich.id).toBe('sit-1');
        expect(rich.name).toBe('Sergeant Volk');
        expect(rich.role).toBe('guard');
    });

    it('grounds personality in disposition + goal', () => {
        const rich = situationNpcToRichNpc(VOLK, SITUATION.openingLine);
        expect(rich.initialPersonalityPrompt).toContain('aggressive');
        expect(rich.initialPersonalityPrompt).toContain('extract a bribe');
    });

    it('seeds the speaker with the opening line, others keep a default seed', () => {
        const speaker = situationNpcToRichNpc(VOLK, SITUATION.openingLine);
        const bystander = situationNpcToRichNpc(MIRA, SITUATION.openingLine);
        expect(speaker.dialoguePromptSeed).toBe('Walk on, this is no business of yours.');
        expect(bystander.dialoguePromptSeed).not.toBe('Walk on, this is no business of yours.');
    });

    it('produces valid RichNPC stats (placeable / interactable)', () => {
        const rich = situationNpcToRichNpc(VOLK, SITUATION.openingLine);
        expect(rich.stats).toBeDefined();
        expect(typeof rich.stats.maxHp).toBe('number');
        expect(rich.biography).toBeDefined();
        expect(rich.equippedItems).toBeDefined();
    });

    it('converts every NPC in the situation', () => {
        const all = situationNpcsToRichNpcs(SITUATION);
        expect(all.map((n) => n.id)).toEqual(['sit-1', 'sit-2']);
    });
});
