/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/gameEntry/__tests__/openingScenePrompt.test.ts
 */

import { describe, expect, it } from 'vitest';
import { buildOpeningScenePrompt } from '../openingScenePrompt';
import type { OpeningSituation } from '../types';

const SITUATION: OpeningSituation = {
  setting: { place: 'a collapsed mine mouth', timeOfDay: 'dusk', weather: 'a thin cold drizzle' },
  predicament: 'A cave-in has trapped miners and the timbers are still groaning.',
  npcs: [
    { id: 'situation-npc-1', name: 'Garrick', role: 'a panicked foreman', disposition: 'desperate', goal: 'get help digging' },
    { id: 'situation-npc-2', name: 'Wen', role: 'a wounded miner', disposition: 'fading', goal: 'be pulled free' },
  ],
  openingLine: { speakerId: 'situation-npc-1', text: 'Help us!' },
};

describe('buildOpeningScenePrompt', () => {
  it('grounds the prompt in the situation setting, predicament, and NPC roles', () => {
    const prompt = buildOpeningScenePrompt(SITUATION);
    expect(prompt).toContain('a collapsed mine mouth');
    expect(prompt).toContain('dusk');
    expect(prompt).toContain('a thin cold drizzle');
    expect(prompt).toContain('cave-in has trapped miners');
    // Roles, not names — names are meaningless to an image model.
    expect(prompt).toContain('a panicked foreman');
    expect(prompt).not.toContain('Garrick');
  });

  it('frames a wide scene and forbids text/UI/portrait artifacts', () => {
    const prompt = buildOpeningScenePrompt(SITUATION);
    expect(prompt.toLowerCase()).toContain('wide cinematic');
    expect(prompt).toContain('No text');
    expect(prompt.toLowerCase()).toContain('no character portrait');
  });

  it('stays robust when optional fields are missing', () => {
    const sparse: OpeningSituation = {
      setting: { place: 'a crossroads', timeOfDay: '', weather: '' },
      predicament: '',
      npcs: [],
      openingLine: { speakerId: 'x', text: '' },
    };
    const prompt = buildOpeningScenePrompt(sparse);
    expect(prompt).toContain('a crossroads');
    expect(prompt).toContain('Wide cinematic');
  });
});
