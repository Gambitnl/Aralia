import { describe, expect, it } from 'vitest';
import { UtilityCommand } from '../UtilityCommand';
import shapeWater from '../../../../public/data/spells/level-0/shape-water.json';
import type { CombatCharacter, CombatState, SelectedSpellTarget } from '@/types/combat';

const caster: CombatCharacter = {
  id: 'caster',
  name: 'Hydromancer',
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 16,
    wisdom: 12,
    charisma: 10
  },
  level: 1,
  position: { x: 0, y: 0 },
  currentHP: 10,
  maxHP: 10,
  armorClass: 12,
  abilities: [],
  actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, legendary: { used: 0, total: 0 }, movement: { used: 0, total: 30 }, freeActions: 1 }
} as CombatCharacter;

const swimmer: CombatCharacter = {
  ...caster,
  id: 'swimmer',
  name: 'Swimmer',
  position: { x: 2, y: 2 }
} as CombatCharacter;

const waterObjectTarget: SelectedSpellTarget = {
  kind: 'object',
  id: 'pond-1',
  name: 'Pond Water',
  position: { x: 1, y: 1 },
  object: {
    id: 'pond-1',
    name: 'Pond Water',
    position: { x: 1, y: 1 }
  }
};

const dryPointTarget: SelectedSpellTarget = {
  kind: 'point',
  position: { x: 3, y: 3 },
  purpose: 'ground_target'
};

const waterPointTarget: SelectedSpellTarget = {
  kind: 'point',
  position: { x: 2, y: 2 },
  purpose: 'ground_target'
};

const createState = (characters: CombatCharacter[] = [caster]): CombatState => ({
  isActive: true,
  characters,
  combatLog: [],
  turnState: {
    currentTurn: 5,
    turnOrder: characters.map(character => character.id),
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
  activeLightSources: [],
  mapData: {
    dimensions: { width: 5, height: 5 },
    tiles: new Map([
      ['2,2', { terrain: 'water' }]
    ]),
    theme: 'forest',
    seed: 1
  }
} as CombatState);

const castShapeWater = (
  state: CombatState,
  playerInput: string,
  selectedSpellTargets: SelectedSpellTarget[] = [waterObjectTarget]
): CombatState => {
  const effect = shapeWater.effects[0] as any;

  return new UtilityCommand(effect, {
    spellId: shapeWater.id,
    spellName: shapeWater.name,
    castAtLevel: 0,
    caster,
    targets: [],
    selectedSpellTargets,
    gameState: {} as any,
    playerInput
  }).execute(state);
};

describe('Shape Water runtime bridge', () => {
  it('rejects dry targets and records Move Or Flow as no-damage water state', () => {
    const dryResult = castShapeWater(createState(), 'Move Or Flow', [dryPointTarget]);

    expect(dryResult.activeShapeWaterEffects).toBeUndefined();
    expect(dryResult.combatLog.some(entry => entry.data?.rejectedShapeWaterTarget === 'dry_target')).toBe(true);

    const result = castShapeWater(createState(), 'Move Or Flow');
    const waterEffect = result.activeShapeWaterEffects?.[0];

    expect(waterEffect?.mode).toBe('move_or_flow');
    expect(waterEffect?.instantaneous).toBe(true);
    expect(waterEffect?.noDamage).toBe(true);
    expect(waterEffect?.volumeCubicFeet).toBe(125);
  });

  it('creates persistent water effects, enforces the two-effect cap, and dismisses one', () => {
    const shaped = castShapeWater(createState(), 'Shape And Animate');
    const colored = castShapeWater(shaped, 'Color Or Opacity');
    const capped = castShapeWater(colored, 'Freeze');

    expect(colored.activeShapeWaterEffects?.filter(effect => !effect.instantaneous && !effect.dismissed)).toHaveLength(2);
    expect(capped.activeShapeWaterEffects?.filter(effect => !effect.instantaneous && !effect.dismissed)).toHaveLength(2);
    expect(capped.combatLog.some(entry => entry.data?.rejectedShapeWaterMode === 'active_effect_cap')).toBe(true);

    const dismissed = castShapeWater(capped, 'Dismiss');

    expect(dismissed.activeShapeWaterEffects?.filter(effect => !effect.instantaneous && !effect.dismissed)).toHaveLength(1);
    expect(dismissed.combatLog.some(entry => entry.data?.dismissedShapeWaterEffectId)).toBe(true);
  });

  it('freezes water tiles only when no creature occupies the selected water cube', () => {
    const occupied = castShapeWater(createState([caster, swimmer]), 'Freeze', [waterPointTarget]);

    expect(occupied.activeShapeWaterEffects).toBeUndefined();
    expect(occupied.combatLog.some(entry => entry.data?.rejectedShapeWaterMode === 'creature_in_water')).toBe(true);

    const emptyWater = castShapeWater(createState(), 'Freeze', [waterPointTarget]);

    expect(emptyWater.activeShapeWaterEffects?.[0]?.mode).toBe('freeze');
    expect(emptyWater.activeShapeWaterEffects?.[0]?.expiresAtRound).toBe(605);
  });
});
