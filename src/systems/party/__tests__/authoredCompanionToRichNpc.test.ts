/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/party/__tests__/authoredCompanionToRichNpc.test.ts
 *
 * Proves the authored companions (Kaelen, Elara) become placeable RichNPC shells
 * that PRESERVE their authored identity + personality, so a fresh player can meet
 * and recruit them. Guards against the regression where they were seeded into
 * state.companions but placed nowhere in the world.
 */

import { describe, it, expect } from 'vitest';
import {
  authoredCompanionToRichNpc,
  authoredCompanionsToRichNpcs,
  roleForCompanionClass,
} from '../authoredCompanionToRichNpc';
import { promoteCompanionToMember } from '../npcToPartyMember';
import { COMPANIONS } from '../../../data/companions';
import type { Companion } from '../../../types/companions';
import { gameEntryReducer } from '../../../state/reducers/gameEntryReducer';
import { createMockGameState } from '../../../utils/factories';

const KAELEN = COMPANIONS['kaelen_thorne'];
const ELARA = COMPANIONS['elara_vance'];

describe('roleForCompanionClass', () => {
  it('maps martial classes to guard', () => {
    expect(roleForCompanionClass('Fighter')).toBe('guard');
    expect(roleForCompanionClass('Paladin')).toBe('guard');
  });

  it('falls back to unique for people of consequence', () => {
    expect(roleForCompanionClass('Rogue')).toBe('unique');
    expect(roleForCompanionClass('Cleric')).toBe('unique');
  });
});

describe('authoredCompanionToRichNpc', () => {
  it('preserves the authored id and name (so recruit resolves the real companion)', () => {
    const rich = authoredCompanionToRichNpc(KAELEN);
    expect(rich.id).toBe('kaelen_thorne');
    expect(rich.name).toBe('Kaelen "Drift" Thorne');
  });

  it('uses the authored physical description as the base description, not a generic template', () => {
    const rich = authoredCompanionToRichNpc(ELARA);
    expect(rich.baseDescription).toBe(ELARA.identity.physicalDescription);
    expect(rich.baseDescription).toContain('half-plate');
  });

  it('folds the authored personality (values/quirks/fears) into the prompt', () => {
    const rich = authoredCompanionToRichNpc(KAELEN);
    // Kaelen's authored values/quirks must show up so his soul comes through.
    expect(rich.initialPersonalityPrompt).toContain('Freedom');
    expect(rich.initialPersonalityPrompt).toContain('Flipping a coin when undecided');
    expect(rich.initialPersonalityPrompt).toContain('Imprisonment');
    expect(rich.initialPersonalityPrompt).toContain('Kaelen');
  });

  it('produces a rules-valid skeleton (stats/biography) the scene can render', () => {
    const rich = authoredCompanionToRichNpc(KAELEN);
    expect(rich.stats.maxHp).toBeGreaterThan(0);
    expect(rich.biography.abilityScores).toBeDefined();
    expect(['merchant', 'quest_giver', 'guard', 'civilian', 'unique']).toContain(rich.role);
  });
});

describe('authoredCompanionsToRichNpcs', () => {
  it('places both authored companions when neither is in the party', () => {
    const placed = authoredCompanionsToRichNpcs(Object.values(COMPANIONS));
    const ids = placed.map((n) => n.id).sort();
    expect(ids).toEqual(['elara_vance', 'kaelen_thorne']);
  });

  it('skips companions already travelling with the party', () => {
    const inParty: Companion = { ...KAELEN, inParty: true };
    const placed = authoredCompanionsToRichNpcs([inParty, ELARA]);
    expect(placed.map((n) => n.id)).toEqual(['elara_vance']);
  });
});

describe('recruit round-trip (placement -> promote)', () => {
  it('promoteCompanionToMember recruits the SAME authored companion the shell represents', () => {
    // The shell id must match the companion key so handleRecruitOffer resolves the
    // authored record (state.companions) and promotes it — preserving loyalty etc.
    const rich = authoredCompanionToRichNpc(ELARA);
    const recruited = COMPANIONS[rich.id];
    expect(recruited).toBeDefined();

    const payload = promoteCompanionToMember(recruited);
    expect(payload.source).toBe('promote');
    expect(payload.character.id).toBe('elara_vance');
    expect(payload.character.name).toBe('Elara Vance');
    expect(payload.companion.inParty).toBe(true);
    // Authored loyalty must carry through (Elara starts at 80 by duty).
    expect(payload.companion.loyalty).toBe(80);
  });
});

describe('placement into the present-NPC list (PLACE_SITUATION_NPCS)', () => {
  it('lands both companions in the exact fields getCurrentNPCs reads', () => {
    // getCurrentNPCs (App.tsx) resolves the present-NPC list from
    // currentLocationActiveDynamicNpcIds -> (NPCS ?? generatedNpcs). Prove the
    // real shells, run through the real reducer, populate BOTH so the ActionPane
    // surfaces "Talk to" and (via generatedNpcs) "Ask to join".
    const state = createMockGameState();
    const shells = authoredCompanionsToRichNpcs(Object.values(COMPANIONS));

    const next = gameEntryReducer(
      { ...state, currentLocationActiveDynamicNpcIds: [] },
      { type: 'PLACE_SITUATION_NPCS', payload: { npcs: shells } },
    );

    expect(next.generatedNpcs?.['kaelen_thorne']).toBeDefined();
    expect(next.generatedNpcs?.['elara_vance']).toBeDefined();
    expect(next.currentLocationActiveDynamicNpcIds).toContain('kaelen_thorne');
    expect(next.currentLocationActiveDynamicNpcIds).toContain('elara_vance');
  });
});
