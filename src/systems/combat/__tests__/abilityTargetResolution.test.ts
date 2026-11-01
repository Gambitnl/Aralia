/** Pins area selection without loading React, paying costs, or allocating random targets. */
import { describe, expect, it } from 'vitest';
import type { Spell, UtilityEffect } from '../../../types/spells';
import type { BattleMapData } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import swordBurst from '@/data/spells/level-0/sword-burst.json';
import wordOfRadiance from '@/data/spells/level-0/word-of-radiance.json';
import { getSpellControlOptions, resolveAreaTargetSelection } from '../abilityTargetResolution';

const caster = () => createMockCombatCharacter({ id: 'caster', position: { x: 3, y: 3 } });
const target = () => createMockCombatCharacter({ id: 'target', position: { x: 4, y: 3 } });
// Visible-target spells need actual map authority; mapless LOS fails closed.
const openMap = (): BattleMapData => ({
  dimensions: { width: 8, height: 8 }, theme: 'dungeon', seed: 11,
  tiles: new Map(Array.from({ length: 8 }, (_, x) => x).flatMap(x =>
    Array.from({ length: 8 }, (_, y) => [`${x}-${y}`, {
      id: `${x}-${y}`, coordinates: { x, y }, terrain: 'floor' as const,
      elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false,
      decoration: null, effects: []
    }] as const)
  ))
});

describe('pure ability target selection', () => {
  it('excludes the caster from an implicit self-centered burst and leaves inputs unchanged', () => {
    const spell = structuredClone(swordBurst) as unknown as Spell;
    const characters = [caster(), target()];
    const before = structuredClone({ spell, characters });
    const result = resolveAreaTargetSelection({ spell, caster: characters[0], characters, targetPosition: characters[0].position, mapData: null });
    expect(result.targetCharacterIds).toEqual(['target']);
    expect(result.selectedSpellTargets).toEqual([{ kind: 'creature', id: 'target' }]);
    expect({ spell, characters }).toEqual(before);
  });

  it('keeps the explicit chosen subset and its original reference order', () => {
    const spell = structuredClone(wordOfRadiance) as unknown as Spell;
    const characters = [caster(), target(), createMockCombatCharacter({ id: 'unchosen', position: { x: 3, y: 4 } })];
    const selected = [{ kind: 'creature' as const, id: 'target' }, { kind: 'creature' as const, id: 'caster' }];
    const result = resolveAreaTargetSelection({ spell, caster: characters[0], characters, targetPosition: characters[0].position, mapData: openMap(), selectedSpellTargets: selected });
    expect(result.targetCharacterIds).toEqual(['caster', 'target']);
    expect(result.selectedSpellTargets).toEqual(selected);
    expect(result.selectedSpellTargets[0]).toBe(selected[0]);
  });

  it('preserves the existing implicit-area fallback when only the caster is explicitly selected', () => {
    const spell = structuredClone(wordOfRadiance) as unknown as Spell;
    const characters = [caster(), target()];
    const result = resolveAreaTargetSelection({ spell, caster: characters[0], characters, targetPosition: characters[0].position, mapData: openMap(), selectedSpellTargets: [{ kind: 'creature', id: 'caster' }] });
    expect(result.targetCharacterIds).toEqual(['caster', 'target']);
  });

  it('returns no area candidates for a spell without an area', () => {
    const spell: Spell = { ...structuredClone(swordBurst) as unknown as Spell, targeting: { type: 'self', validTargets: ['self'] } };
    expect(resolveAreaTargetSelection({ spell, caster: caster(), characters: [target()], targetPosition: { x: 3, y: 3 }, mapData: null })).toEqual({ targetCharacterIds: [], selectedSpellTargets: [] });
  });

  it('retains executable control words in order while leaving source-only menu metadata intact', () => {
    const options = [{ name: 'Approach', effect: 'approach' }, { label: 'source only' }, { name: ' ', effect: 'halt' }, { name: 'Halt', effect: 'halt' }];
    const utility: UtilityEffect = { type: 'UTILITY', utilityType: 'other', description: 'A control-word fixture', trigger: { type: 'immediate' }, condition: { type: 'always' }, controlOptions: options };
    const spell = { ...structuredClone(swordBurst) as unknown as Spell, effects: [utility] };
    expect(getSpellControlOptions(spell)).toEqual([options[0], options[3]]);
    expect(utility.controlOptions).toHaveLength(4);
  });
});
