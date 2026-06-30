import { describe, expect, it } from 'vitest';
import { UtilityCommand } from '../UtilityCommand';
import thaumaturgy from '../../../../public/data/spells/level-0/thaumaturgy.json';
import type { CombatCharacter, CombatState, SelectedSpellTarget } from '@/types/combat';

const caster: CombatCharacter = {
  id: 'caster',
  name: 'Cleric',
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 16,
    charisma: 14
  },
  level: 1,
  position: { x: 0, y: 0 },
  currentHP: 10,
  maxHP: 10,
  armorClass: 12,
  abilities: [],
  actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, legendary: { used: 0, total: 0 }, movement: { used: 0, total: 30 }, freeActions: 1 }
} as CombatCharacter;

const pointTarget: SelectedSpellTarget = {
  kind: 'point',
  position: { x: 2, y: 2 },
  purpose: 'area_origin'
};

const doorTarget: SelectedSpellTarget = {
  kind: 'object',
  id: 'door-1',
  name: 'Unlocked Door',
  position: { x: 3, y: 1 },
  object: {
    id: 'door-1',
    name: 'Unlocked Door',
    position: { x: 3, y: 1 }
  }
};

const createState = (currentTurn = 4): CombatState => ({
  isActive: true,
  characters: [caster],
  combatLog: [],
  turnState: {
    currentTurn,
    turnOrder: ['caster'],
    currentCharacterId: 'caster',
    phase: 'action',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: [],
  reactiveTriggers: [],
  activeLightSources: []
} as CombatState);

const castThaumaturgy = (
  state: CombatState,
  playerInput: string,
  selectedSpellTargets: SelectedSpellTarget[] = [pointTarget]
): CombatState => {
  const effect = thaumaturgy.effects[0] as any;

  return new UtilityCommand(effect, {
    spellId: thaumaturgy.id,
    spellName: thaumaturgy.name,
    castAtLevel: 0,
    caster,
    targets: [],
    selectedSpellTargets,
    gameState: {} as any,
    playerInput
  }).execute(state);
};

describe('Thaumaturgy runtime bridge', () => {
  it('materializes all six mode artifacts and the Booming Voice check rider', () => {
    const eyes = castThaumaturgy(createState(), 'Altered Eyes');
    expect(eyes.activeThaumaturgyEffects?.[0]).toMatchObject({
      mode: 'altered_eyes',
      appearanceChange: 'caster_eyes',
      instantaneous: false,
      expiresAtRound: 14
    });

    const voice = castThaumaturgy(createState(), 'Booming Voice');
    expect(voice.activeThaumaturgyEffects?.[0]?.mode).toBe('booming_voice');
    expect(voice.activeThaumaturgyEffects?.[0]?.abilityCheckModifier?.skillPool).toContain('Intimidation');
    expect(voice.characters[0].statusEffects?.[0]?.abilityCheckModifier?.flatModifier).toBe('advantage');

    const fire = castThaumaturgy(createState(), 'Fire Play');
    expect(fire.activeThaumaturgyEffects?.[0]?.fireStateChange).toEqual(['flicker', 'brighten', 'dim', 'change_color']);

    const hand = castThaumaturgy(createState(), 'Invisible Hand', [doorTarget]);
    expect(hand.activeThaumaturgyEffects?.[0]).toMatchObject({
      mode: 'invisible_hand',
      targetObjectId: 'door-1',
      instantaneous: true,
      objectMotion: ['fly_open', 'slam_shut']
    });

    const sound = castThaumaturgy(createState(), 'Phantom Sound');
    expect(sound.activeThaumaturgyEffects?.[0]).toMatchObject({
      mode: 'phantom_sound',
      instantaneous: true
    });

    const tremors = castThaumaturgy(createState(), 'Tremors');
    expect(tremors.activeThaumaturgyEffects?.[0]).toMatchObject({
      mode: 'tremors',
      harmless: true,
      groundMotion: 'harmless_ground_tremors'
    });
  });

  it('enforces the three active one-minute effect cap and prunes expired effects before recast', () => {
    const first = castThaumaturgy(createState(), 'Altered Eyes');
    const second = castThaumaturgy(first, 'Booming Voice');
    const third = castThaumaturgy(second, 'Fire Play');
    const rejected = castThaumaturgy(third, 'Tremors');

    expect(rejected.activeThaumaturgyEffects?.filter(effect => !effect.instantaneous)).toHaveLength(3);
    expect(rejected.combatLog.some(entry => entry.data?.rejectedThaumaturgyMode === 'active_effect_cap')).toBe(true);

    const afterExpiry = {
      ...rejected,
      turnState: { ...rejected.turnState, currentTurn: 20 }
    };
    const accepted = castThaumaturgy(afterExpiry, 'Tremors');

    expect(accepted.activeThaumaturgyEffects?.filter(effect => !effect.instantaneous)).toHaveLength(1);
    expect(accepted.activeThaumaturgyEffects?.[0]?.mode).toBe('tremors');
  });

  it('rejects command execution when no point or object target reaches the command context', () => {
    const result = castThaumaturgy(createState(), 'Altered Eyes', []);

    expect(result.activeThaumaturgyEffects).toBeUndefined();
    expect(result.combatLog.some(entry => entry.data?.rejectedThaumaturgyTarget === 'missing_point')).toBe(true);
  });
});
