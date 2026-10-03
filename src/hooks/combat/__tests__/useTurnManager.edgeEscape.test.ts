/**
 * @file useTurnManager.edgeEscape.test.ts — integration proof for 9B.
 *
 * The claim: a combatant standing at the battlefield boundary can flee; the
 * escape costs their full movement action, removes them from combat, and hands
 * the turn on. A combatant in the open field cannot.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnManager } from '../useTurnManager';
import type { BattleMapData, CombatCharacter } from '@/types/combat';
import type { Class } from '@/types';

const mockClass: Class = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A martial combatant.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: [],
};

const makeCharacter = (
  id: string,
  team: 'player' | 'enemy',
  position: { x: number; y: number },
): CombatCharacter => ({
  id,
  name: id,
  level: 3,
  class: mockClass,
  position,
  stats: {
    strength: 10, dexterity: 12, constitution: 12, intelligence: 10,
    wisdom: 10, charisma: 8, baseInitiative: 0, speed: 30, cr: '0',
  },
  abilities: [],
  team,
  currentHP: 10,
  maxHP: 10,
  initiative: 0,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 1,
  },
} as unknown as CombatCharacter);

const mapData = {
  dimensions: { width: 40, height: 30 },
  tiles: new Map(),
  theme: 'forest',
  seed: 1,
} as unknown as BattleMapData;

describe('useTurnManager edge-of-map escape (9B)', () => {
  it('offers no escape from the middle of the battlefield', () => {
    const hero = makeCharacter('hero', 'player', { x: 20, y: 15 });
    const { result } = renderHook(() => useTurnManager({
      characters: [hero],
      mapData,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
    }));

    const verdict = result.current.canEscapeFromCombat('hero');
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe('not-at-edge');
  });

  it('offers the escape once the character reaches the boundary', () => {
    const hero = makeCharacter('hero', 'player', { x: 0, y: 15 });
    const { result } = renderHook(() => useTurnManager({
      characters: [hero],
      mapData,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
    }));

    const verdict = result.current.canEscapeFromCombat('hero');
    expect(verdict.available).toBe(true);
    expect(verdict.movementCostFeet).toBe(30);
  });

  it('spends the full movement action and removes the escapee from combat', () => {
    const hero = makeCharacter('hero', 'player', { x: 39, y: 15 });
    const goblin = makeCharacter('goblin', 'enemy', { x: 20, y: 15 });
    const characters = [hero, goblin];
    const onCharacterUpdate = vi.fn();
    const onCharacterRemove = vi.fn();
    const onLogEntry = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters,
      mapData,
      onCharacterUpdate,
      onCharacterRemove,
      onLogEntry,
      initiativeRoller: (character) => (character.id === 'hero' ? 25 : 2),
    }));

    act(() => { result.current.initializeCombat(characters); });
    onCharacterUpdate.mockClear();

    let verdict: ReturnType<typeof result.current.escapeFromCombat> | undefined;
    act(() => { verdict = result.current.escapeFromCombat('hero'); });

    expect(verdict?.available).toBe(true);

    // 1. The whole remaining movement action was charged before they left.
    const spent = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .reverse()
      .find(character => character.id === 'hero');
    expect(spent?.actionEconomy.movement).toEqual({ used: 30, total: 30 });
    // The action and bonus action survive — escape is a movement decision.
    expect(spent?.actionEconomy.action.used).toBe(false);

    // 2. The combatant is out of the encounter.
    expect(onCharacterRemove).toHaveBeenCalledWith('hero');
    expect(result.current.turnState.turnOrder).not.toContain('hero');

    // 3. The flight is on the record.
    const escapeLog = onLogEntry.mock.calls
      .map(call => call[0])
      .find(entry => entry.data?.escape === 'edge-of-map');
    expect(escapeLog).toBeDefined();
    expect(escapeLog.message).toContain('flees the battlefield');
  });

  it('refuses to resolve an escape the referee did not allow', () => {
    const hero = makeCharacter('hero', 'player', { x: 20, y: 15 });
    const onCharacterRemove = vi.fn();
    const { result } = renderHook(() => useTurnManager({
      characters: [hero],
      mapData,
      onCharacterUpdate: vi.fn(),
      onCharacterRemove,
      onLogEntry: vi.fn(),
    }));

    act(() => { result.current.initializeCombat([hero]); });

    let verdict: ReturnType<typeof result.current.escapeFromCombat> | undefined;
    act(() => { verdict = result.current.escapeFromCombat('hero'); });

    expect(verdict?.available).toBe(false);
    expect(onCharacterRemove).not.toHaveBeenCalled();
    expect(result.current.turnState.turnOrder).toContain('hero');
  });

  it('reports a combatant who is not in this encounter instead of throwing', () => {
    const { result } = renderHook(() => useTurnManager({
      characters: [],
      mapData,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
    }));

    expect(result.current.canEscapeFromCombat('ghost').available).toBe(false);
  });
});
