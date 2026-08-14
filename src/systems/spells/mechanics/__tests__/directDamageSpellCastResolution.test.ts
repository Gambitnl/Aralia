/**
 * This file proves the live damage-spell transaction is atomic.
 *
 * Fireball supplies canonical slot scaling, saves, and Fire damage. The tests
 * cover cumulative live state, exact payment, every pre-payment rejection,
 * targeting and sight, resistance/immunity, downing, and non-upcastable cantrip
 * boundaries without replacing production helpers with expected-result mocks.
 */

import { describe, expect, it, vi } from 'vitest';
import fireBoltData from '../../../../data/spells/level-0/fire-bolt.json';
import fireballData from '../../../../data/spells/level-3/fireball.json';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  TurnState,
} from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createMockCombatCharacter } from '../../../../utils/core';
import {
  createDamageSpellCastAction,
  resolveDamageSpellCast,
} from '../directDamageSpellCastResolution';

const FIREBALL = fireballData as Spell;
const FIRE_BOLT = fireBoltData as Spell;
const CASTER_ID = 'damage-spell-caster';
const TARGET_ID = 'damage-spell-target';

// ============================================================================
// Deterministic Live Combat Fixture
// ============================================================================
// A forty-square board is large enough to prove Fireball's 150-foot range.
// Ordinary tiles preserve line of sight unless one test explicitly blocks it.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'stone',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 40; x += 1) {
    for (let y = 0; y < 12; y += 1) {
      tiles.set(`${x}-${y}`, createTile(x, y));
    }
  }
  return { dimensions: { width: 40, height: 12 }, tiles, theme: 'dungeon', seed: 26 };
}

function createTurn(currentCharacterId = CASTER_ID): TurnState {
  return {
    currentTurn: 1,
    turnOrder: [CASTER_ID, TARGET_ID],
    currentCharacterId,
    phase: 'action',
    actionsThisTurn: [],
  };
}

function createActors(): CombatCharacter[] {
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Evoker',
    team: 'player',
    level: 7,
    position: { x: 4, y: 5 },
    spellcastingAbility: 'intelligence',
    spellSlots: {
      level_3: { current: 1, max: 1 },
      level_4: { current: 1, max: 1 },
    },
  });
  caster.stats.intelligence = 18;
  const fireball = createDamageSpellCastAction(FIREBALL, caster, 3);
  const fireBolt = createDamageSpellCastAction(FIRE_BOLT, caster, 0);
  caster.abilities = [fireball.ability, fireBolt.ability];

  const target = createMockCombatCharacter({
    id: TARGET_ID,
    name: 'Target',
    team: 'enemy',
    position: { x: 9, y: 5 },
    currentHP: 60,
    maxHP: 60,
  });
  target.stats.dexterity = 8;
  target.savingThrowProficiencies = [];

  return [caster, target, createMockCombatCharacter({ id: 'bystander', name: 'Bystander' })];
}

function actor(characters: CombatCharacter[], id: string): CombatCharacter {
  const found = characters.find(character => character.id === id);
  if (!found) throw new Error(`Missing direct-damage actor ${id}.`);
  return found;
}

function fixedD6(face = 4): () => number {
  return () => (face - 0.5) / 6;
}

function fixedD20(face = 5): () => number {
  return () => (face - 0.5) / 20;
}

function createInput(characters = createActors(), requestedSlotLevel = 3) {
  const caster = actor(characters, CASTER_ID);
  return {
    characters,
    mapData: createMap(),
    turnState: createTurn(),
    casterId: CASTER_ID,
    targetId: TARGET_ID,
    action: createDamageSpellCastAction(FIREBALL, caster, requestedSlotLevel),
    damageRng: fixedD6(),
    saveRng: fixedD20(),
  };
}

// ============================================================================
// Legal Casts And Cumulative State
// ============================================================================
// A successful cast pays one exact slot and one Action. A second request sees
// that paid roster, so it must reject rather than rebuilding the fixture.
// ============================================================================

describe('resolveDamageSpellCast', () => {
  it('pays one level-3 slot and Action, then resolves canonical 8d6 save damage', () => {
    const result = resolveDamageSpellCast(createInput());

    expect(result).toMatchObject({
      status: 'resolved',
      baseFormula: '8d6',
      scaledFormula: '8d6',
      rolledDamage: 32,
      damageAfterSave: 32,
      finalDamage: 32,
      saveTotal: 4,
      saveDC: 15,
    });
    expect(actor(result.characters, CASTER_ID).actionEconomy.action.used).toBe(true);
    expect(actor(result.characters, CASTER_ID).spellSlots?.level_3?.current).toBe(0);
    expect(actor(result.characters, CASTER_ID).spellSlots?.level_4?.current).toBe(1);
    expect(actor(result.characters, TARGET_ID).currentHP).toBe(28);
  });

  it('scales level-4 Fireball to 9d6 and pays only the selected higher slot', () => {
    const result = resolveDamageSpellCast(createInput(createActors(), 4));

    expect(result).toMatchObject({
      status: 'resolved',
      baseFormula: '8d6',
      scaledFormula: '9d6',
      rolledDamage: 36,
      finalDamage: 36,
    });
    expect(actor(result.characters, CASTER_ID).spellSlots?.level_3?.current).toBe(1);
    expect(actor(result.characters, CASTER_ID).spellSlots?.level_4?.current).toBe(0);
    expect(actor(result.characters, TARGET_ID).currentHP).toBe(24);
  });

  it('rejects a repeat from cumulative paid state before another roll or mutation', () => {
    const first = resolveDamageSpellCast(createInput());
    const damageRng = vi.fn(fixedD6());
    const saveRng = vi.fn(fixedD20());
    const repeatInput = {
      ...createInput(first.characters, 4),
      damageRng,
      saveRng,
    };
    const repeat = resolveDamageSpellCast(repeatInput);

    expect(repeat).toMatchObject({ status: 'rejected', reason: 'action_unavailable' });
    expect(repeat.characters).toBe(first.characters);
    expect(damageRng).not.toHaveBeenCalled();
    expect(saveRng).not.toHaveBeenCalled();
    expect(actor(repeat.characters, CASTER_ID).spellSlots?.level_4?.current).toBe(1);
    expect(actor(repeat.characters, TARGET_ID).currentHP).toBe(28);
  });

  // ========================================================================
  // Defenses And Downed-State Path
  // ========================================================================
  // Save damage settles before resistance/immunity, then the shared HP helper
  // owns temporary HP and the player downed/Unconscious transition.
  // ========================================================================

  it('applies Fire resistance and immunity through canonical defenses', () => {
    const resistantActors = createActors();
    actor(resistantActors, TARGET_ID).resistances = ['Fire'];
    actor(resistantActors, TARGET_ID).currentHP = 20;
    actor(resistantActors, TARGET_ID).maxHP = 20;
    const resisted = resolveDamageSpellCast(createInput(resistantActors));

    expect(resisted.finalDamage).toBe(16);
    expect(actor(resisted.characters, TARGET_ID).currentHP).toBe(4);

    const immuneActors = createActors();
    actor(immuneActors, TARGET_ID).immunities = ['Fire'];
    const immune = resolveDamageSpellCast(createInput(immuneActors));
    expect(immune.finalDamage).toBe(0);
    expect(actor(immune.characters, TARGET_ID).currentHP).toBe(60);
  });

  it('uses the canonical player downing path when live HP reaches zero', () => {
    const characters = createActors();
    const target = actor(characters, TARGET_ID);
    target.team = 'player';
    target.currentHP = 10;
    target.maxHP = 60;
    const result = resolveDamageSpellCast(createInput(characters));
    const downed = actor(result.characters, TARGET_ID);

    expect(downed.currentHP).toBe(0);
    expect(downed.deathSaves).toMatchObject({ successes: 0, failures: 0 });
    expect(downed.statusEffects.map(effect => effect.name)).toContain('Unconscious');
  });

  // ========================================================================
  // Complete Pre-Payment Boundary Matrix
  // ========================================================================
  // Each rejection preserves the exact input roster and never invokes either
  // random source, proving validation precedes rolls, payment, and effects.
  // ========================================================================

  it.each([
    ['off turn', (input: ReturnType<typeof createInput>) => ({ ...input, turnState: createTurn(TARGET_ID) }), 'off_turn'],
    ['spent Action', (input: ReturnType<typeof createInput>) => {
      actor(input.characters, CASTER_ID).actionEconomy.action.used = true;
      return input;
    }, 'action_unavailable'],
    ['empty exact slot', (input: ReturnType<typeof createInput>) => {
      actor(input.characters, CASTER_ID).spellSlots!.level_3!.current = 0;
      return input;
    }, 'slot_unavailable'],
    ['missing requested slot', (input: ReturnType<typeof createInput>) => ({
      ...input,
      action: createDamageSpellCastAction(FIREBALL, actor(input.characters, CASTER_ID), 5),
    }), 'slot_unavailable'],
    ['below base slot', (input: ReturnType<typeof createInput>) => ({
      ...input,
      action: createDamageSpellCastAction(FIREBALL, actor(input.characters, CASTER_ID), 2),
    }), 'below_base_slot'],
    ['invalid fractional slot', (input: ReturnType<typeof createInput>) => ({
      ...input,
      action: createDamageSpellCastAction(FIREBALL, actor(input.characters, CASTER_ID), 3.5),
    }), 'invalid_slot_level'],
    ['ineligible spell', (input: ReturnType<typeof createInput>) => {
      actor(input.characters, CASTER_ID).abilities = [];
      return input;
    }, 'spell_not_eligible'],
    ['out of range target', (input: ReturnType<typeof createInput>) => {
      actor(input.characters, TARGET_ID).position = { x: 35, y: 5 };
      return input;
    }, 'invalid_target:out_of_range'],
    ['blocked line of sight', (input: ReturnType<typeof createInput>) => {
      const blockingTile = input.mapData!.tiles.get('6-5')!;
      blockingTile.blocksLoS = true;
      return input;
    }, 'invalid_target:line_of_sight_blocked'],
  ])('rejects %s atomically', (_label, arrange, reason) => {
    const damageRng = vi.fn(fixedD6());
    const saveRng = vi.fn(fixedD20());
    const input = arrange({ ...createInput(), damageRng, saveRng });
    const beforeCasterPosition = { ...actor(input.characters, CASTER_ID).position };
    const beforeTargetPosition = { ...actor(input.characters, TARGET_ID).position };
    const result = resolveDamageSpellCast(input);

    expect(result).toMatchObject({ status: 'rejected', reason });
    expect(result.characters).toBe(input.characters);
    expect(damageRng).not.toHaveBeenCalled();
    expect(saveRng).not.toHaveBeenCalled();
    expect(actor(result.characters, CASTER_ID).position).toEqual(beforeCasterPosition);
    expect(actor(result.characters, TARGET_ID).position).toEqual(beforeTargetPosition);
  });

  it('rejects a cantrip offered a spell slot as explicitly non-upcastable', () => {
    const input = createInput();
    input.action = createDamageSpellCastAction(FIRE_BOLT, actor(input.characters, CASTER_ID), 1);
    const result = resolveDamageSpellCast(input);

    expect(result).toMatchObject({ status: 'rejected', reason: 'cantrip_slot_forbidden' });
    expect(result.characters).toBe(input.characters);
  });
});
