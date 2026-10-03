/**
 * @file useTurnManager.cameraFocus.test.ts — integration proof for 9A.
 *
 * The claim: when a new turn starts, the turn manager publishes a camera-focus
 * request naming the combatant whose turn it is and where they stand, so the
 * tactical camera can orbit to them. This is the half of 9A that lives outside
 * the R3F canvas; the controller half consumes exactly these requests.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnManager } from '../useTurnManager';
import {
  CameraFocusEventEmitter,
  type CameraFocusRequest,
} from '../../../systems/combat/CameraFocusEventEmitter';
import type { CombatCharacter } from '@/types/combat';
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
  initiative: number,
): CombatCharacter => ({
  id,
  name: id,
  level: 3,
  class: mockClass,
  position,
  stats: {
    strength: 10, dexterity: 12, constitution: 12, intelligence: 10,
    wisdom: 10, charisma: 8, baseInitiative: initiative, speed: 30, cr: '0',
  },
  abilities: [],
  team,
  currentHP: 10,
  maxHP: 10,
  initiative,
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

describe('useTurnManager per-turn camera focus (9A)', () => {
  let received: CameraFocusRequest[];
  let unsubscribe: () => void;

  beforeEach(() => {
    // A fresh emitter per test so retained requests cannot leak between them.
    CameraFocusEventEmitter.setInstance(CameraFocusEventEmitter.createFresh());
    received = [];
    unsubscribe = CameraFocusEventEmitter.getInstance().onFocus((request) => {
      received.push(request);
    });
  });

  afterEach(() => {
    unsubscribe();
    CameraFocusEventEmitter.setInstance(null);
  });

  it('publishes a focus request naming the first actor when combat starts', () => {
    const hero = makeCharacter('hero', 'player', { x: 4, y: 7 }, 20);
    const goblin = makeCharacter('goblin', 'enemy', { x: 30, y: 22 }, 1);
    const characters = [hero, goblin];

    const { result } = renderHook(() => useTurnManager({
      characters,
      mapData: null,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
      // Deterministic initiative so the hero is unambiguously first.
      initiativeRoller: (character) => (character.id === 'hero' ? 25 : 2),
    }));

    act(() => { result.current.initializeCombat(characters); });

    expect(received).toHaveLength(1);
    expect(received[0].characterId).toBe('hero');
    expect(received[0].position).toEqual({ x: 4, y: 7 });
    expect(received[0].reason).toBe('turn-start');
  });

  it('publishes a NEW request pointing at the next combatant when the turn changes', () => {
    const hero = makeCharacter('hero', 'player', { x: 4, y: 7 }, 20);
    const goblin = makeCharacter('goblin', 'enemy', { x: 30, y: 22 }, 1);
    const characters = [hero, goblin];

    const { result } = renderHook(() => useTurnManager({
      characters,
      mapData: null,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
      initiativeRoller: (character) => (character.id === 'hero' ? 25 : 2),
    }));

    act(() => { result.current.initializeCombat(characters); });
    act(() => { result.current.skipToCharacter('goblin'); });

    expect(received.length).toBeGreaterThanOrEqual(2);
    const latest = received[received.length - 1];
    expect(latest.characterId).toBe('goblin');
    expect(latest.position).toEqual({ x: 30, y: 22 });
    // Ids strictly increase, so a listener can dedupe without missing a repeat
    // focus on the same combatant across consecutive turns.
    expect(latest.requestId).toBeGreaterThan(received[0].requestId);
  });

  it('retains the last request so a camera mounting mid-turn still frames the actor', () => {
    const hero = makeCharacter('hero', 'player', { x: 4, y: 7 }, 20);
    const characters = [hero];

    const { result } = renderHook(() => useTurnManager({
      characters,
      mapData: null,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
      initiativeRoller: () => 25,
    }));

    act(() => { result.current.initializeCombat(characters); });

    const replayed = CameraFocusEventEmitter.getInstance().getLastRequest();
    expect(replayed?.characterId).toBe('hero');
    expect(replayed?.position).toEqual({ x: 4, y: 7 });
  });

  it('does not let a throwing camera listener break the turn boundary', () => {
    const emitter = CameraFocusEventEmitter.getInstance();
    const offThrower = emitter.onFocus(() => { throw new Error('camera exploded'); });
    const hero = makeCharacter('hero', 'player', { x: 4, y: 7 }, 20);
    const onLogEntry = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [hero],
      mapData: null,
      onCharacterUpdate: vi.fn(),
      onLogEntry,
      initiativeRoller: () => 25,
    }));

    expect(() => {
      act(() => { result.current.initializeCombat([hero]); });
    }).not.toThrow();
    expect(onLogEntry.mock.calls.some(([entry]) => entry.type === 'turn_start')).toBe(true);

    offThrower();
  });
});
