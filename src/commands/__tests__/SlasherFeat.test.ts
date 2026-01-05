import { describe, expect, it } from 'vitest';
import { DamageCommand } from '../effects/DamageCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState, Position } from '@/types/combat';
import type { DamageEffect } from '@/types/spells';
import type { Class, GameState } from '@/types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/factories';

const baseStats = {
  strength: 14,
  dexterity: 12,
  constitution: 12,
  intelligence: 10,
  wisdom: 10,
  charisma: 8,
  baseInitiative: 0,
  speed: 30,
  cr: '0'
};

const baseEconomy = {
  action: { used: false, remaining: 1 },
  bonusAction: { used: false, remaining: 1 },
  reaction: { used: false, remaining: 1 },
  movement: { used: 0, total: 30 },
  freeActions: 0
};

const mockClass: Class = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A martial warrior.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: ['light', 'medium', 'heavy', 'shields'],
  weaponProficiencies: ['simple', 'martial'],
  features: []
};

const makeCharacter = (id: string, position: Position, options: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id,
  name: id,
  level: 5,
  class: mockClass,
  position,
  stats: { ...baseStats },
  abilities: [],
  team: 'player',
  currentHP: 40,
  maxHP: 40,
  initiative: 10,
  statusEffects: [],
  conditions: [],
  actionEconomy: { ...baseEconomy },
  armorClass: 16,
  activeEffects: [],
  tempHP: 0,
  feats: [],
  featUsageThisTurn: [],
  ...options
});

const makeState = (characters: CombatCharacter[], currentCharacterId?: string): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 1,
    turnOrder: characters.map(c => c.id),
    currentCharacterId: currentCharacterId ?? characters[0]?.id ?? null,
    phase: 'action',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: [],
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: []
});

const makeContext = (caster: CombatCharacter, targets: CombatCharacter[], options: Partial<CommandContext> = {}): CommandContext => ({
  spellId: 'attack',
  spellName: 'Attack',
  castAtLevel: 0,
  caster,
  targets,
  isCritical: false,
  gameState: createMockGameState({
    party: [createMockPlayerCharacter({
      id: caster.id,
      name: caster.name,
    })],
    currentEnemies: targets,
    currentLocationId: 'arena',
    subMapCoordinates: { x: 0, y: 0 },
    mapData: null
  }) as GameState,
  ...options
});

const makeSlashingDamageEffect = (): DamageEffect => ({
  type: 'DAMAGE',
  damage: {
    dice: '1d8+3',
    type: 'slashing'
  },
  trigger: { type: 'immediate' },
  condition: { type: 'hit' }
});

const makeBludgeoningDamageEffect = (): DamageEffect => ({
  type: 'DAMAGE',
  damage: {
    dice: '1d8+3',
    type: 'bludgeoning'
  },
  trigger: { type: 'immediate' },
  condition: { type: 'hit' }
});

describe('Slasher Feat', () => {
  describe('Speed Reduction (Hamstring)', () => {
    it('applies -10 speed when dealing slashing damage with Slasher feat', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target = makeCharacter('target', { x: 1, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target], attacker.id);

      const effect = makeSlashingDamageEffect();
      const command = new DamageCommand(effect, makeContext(attacker, [target]));
      const result = command.execute(state);

      // Check that speed reduction status effect was applied
      const updatedTarget = result.characters.find(c => c.id === 'target');
      const slasherSlowEffect = updatedTarget?.statusEffects.find(e => e.name === 'Slasher Slow');
      expect(slasherSlowEffect).toBeDefined();
      expect(slasherSlowEffect?.effect?.type).toBe('stat_modifier');
      expect(slasherSlowEffect?.effect?.stat).toBe('speed');
      expect(slasherSlowEffect?.effect?.value).toBe(-10);

      // Check log entry
      const logEntry = result.combatLog.find(e => e.message.includes('Slasher feat slows'));
      expect(logEntry).toBeDefined();
    });

    it('does NOT apply speed reduction for non-slashing damage types', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target = makeCharacter('target', { x: 1, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target], attacker.id);

      const effect = makeBludgeoningDamageEffect();
      const command = new DamageCommand(effect, makeContext(attacker, [target]));
      const result = command.execute(state);

      // Should NOT have Slasher slow effect
      const updatedTarget = result.characters.find(c => c.id === 'target');
      const slasherSlowEffect = updatedTarget?.statusEffects.find(e => e.name === 'Slasher Slow');
      expect(slasherSlowEffect).toBeUndefined();

      // No Slasher log entry
      const logEntry = result.combatLog.find(e => e.message.includes('Slasher feat'));
      expect(logEntry).toBeUndefined();
    });

    it('does NOT apply speed reduction if attacker lacks Slasher feat', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: [] });
      const target = makeCharacter('target', { x: 1, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target], attacker.id);

      const effect = makeSlashingDamageEffect();
      const command = new DamageCommand(effect, makeContext(attacker, [target]));
      const result = command.execute(state);

      // Should NOT have Slasher slow effect
      const updatedTarget = result.characters.find(c => c.id === 'target');
      const slasherSlowEffect = updatedTarget?.statusEffects.find(e => e.name === 'Slasher Slow');
      expect(slasherSlowEffect).toBeUndefined();
    });

    it('enforces once-per-turn limit on speed reduction', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target1 = makeCharacter('target1', { x: 1, y: 0 }, { team: 'enemy' });
      const target2 = makeCharacter('target2', { x: 2, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target1, target2], attacker.id);

      const effect = makeSlashingDamageEffect();

      // First attack on target1
      const command1 = new DamageCommand(effect, makeContext(attacker, [target1]));
      const result1 = command1.execute(state);

      // Verify target1 got slowed
      const target1AfterFirst = result1.characters.find(c => c.id === 'target1');
      expect(target1AfterFirst?.statusEffects.find(e => e.name === 'Slasher Slow')).toBeDefined();

      // Verify attacker now has featUsageThisTurn marked
      const attackerAfterFirst = result1.characters.find(c => c.id === 'attacker');
      expect(attackerAfterFirst?.featUsageThisTurn).toContain('slasher_slow');

      // Second attack on target2 (same turn)
      const command2 = new DamageCommand(effect, makeContext(attackerAfterFirst!, [target2]));
      const result2 = command2.execute(result1);

      // target2 should NOT have Slowed effect (once per turn limit)
      const target2AfterSecond = result2.characters.find(c => c.id === 'target2');
      expect(target2AfterSecond?.statusEffects.find(e => e.name === 'Slasher Slow')).toBeUndefined();

      // Only one Slasher slow log entry should exist
      const slowLogEntries = result2.combatLog.filter(e => e.message.includes('Slasher feat slows'));
      expect(slowLogEntries.length).toBe(1);
    });
  });

  describe('Grievous Wound (Critical Hit Disadvantage)', () => {
    it('applies disadvantage on attacks when landing a critical hit with slashing damage', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target = makeCharacter('target', { x: 1, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target], attacker.id);

      const effect = makeSlashingDamageEffect();
      const context = makeContext(attacker, [target], { isCritical: true });
      const command = new DamageCommand(effect, context);
      const result = command.execute(state);

      // Check that disadvantage ActiveEffect was applied
      const updatedTarget = result.characters.find(c => c.id === 'target');
      const grievousWound = updatedTarget?.activeEffects?.find(e => e.mechanics?.disadvantageOnAttacks === true);
      expect(grievousWound).toBeDefined();
      expect(grievousWound?.sourceName).toBe('Slasher Grievous Wound');
      expect(grievousWound?.spellId).toBe('slasher');
      expect(grievousWound?.duration.type).toBe('rounds');
      expect(grievousWound?.duration.value).toBe(1);

      // Check log entry for critical
      const logEntry = result.combatLog.find(e => e.message.includes('CRITICAL HIT'));
      expect(logEntry).toBeDefined();
      expect(logEntry?.message).toContain('Disadvantage on attacks');
    });

    it('does NOT apply disadvantage on non-critical hits', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target = makeCharacter('target', { x: 1, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target], attacker.id);

      const effect = makeSlashingDamageEffect();
      const context = makeContext(attacker, [target], { isCritical: false });
      const command = new DamageCommand(effect, context);
      const result = command.execute(state);

      // Should have speed reduction but NOT disadvantage
      const updatedTarget = result.characters.find(c => c.id === 'target');
      expect(updatedTarget?.statusEffects.find(e => e.name === 'Slasher Slow')).toBeDefined();
      expect(updatedTarget?.activeEffects?.find(e => e.mechanics?.disadvantageOnAttacks === true)).toBeUndefined();
    });

    it('does NOT apply disadvantage on critical hits with non-slashing damage', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target = makeCharacter('target', { x: 1, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target], attacker.id);

      const effect = makeBludgeoningDamageEffect();
      const context = makeContext(attacker, [target], { isCritical: true });
      const command = new DamageCommand(effect, context);
      const result = command.execute(state);

      // Should NOT have any Slasher effects
      const updatedTarget = result.characters.find(c => c.id === 'target');
      expect(updatedTarget?.statusEffects.find(e => e.name === 'Slasher Slow')).toBeUndefined();
      expect(updatedTarget?.activeEffects?.find(e => e.mechanics?.disadvantageOnAttacks === true)).toBeUndefined();
    });

    it('can apply disadvantage multiple times on critical hits (not limited to once per turn)', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target1 = makeCharacter('target1', { x: 1, y: 0 }, { team: 'enemy' });
      const target2 = makeCharacter('target2', { x: 2, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target1, target2], attacker.id);

      const effect = makeSlashingDamageEffect();

      // First critical attack on target1
      const context1 = makeContext(attacker, [target1], { isCritical: true });
      const command1 = new DamageCommand(effect, context1);
      const result1 = command1.execute(state);

      // Second critical attack on target2 (same turn)
      const attackerAfterFirst = result1.characters.find(c => c.id === 'attacker')!;
      const context2 = makeContext(attackerAfterFirst, [target2], { isCritical: true });
      const command2 = new DamageCommand(effect, context2);
      const result2 = command2.execute(result1);

      // Both targets should have disadvantage (crits are not once-per-turn limited)
      const target1Final = result2.characters.find(c => c.id === 'target1');
      const target2Final = result2.characters.find(c => c.id === 'target2');
      expect(target1Final?.activeEffects?.find(e => e.mechanics?.disadvantageOnAttacks === true)).toBeDefined();
      expect(target2Final?.activeEffects?.find(e => e.mechanics?.disadvantageOnAttacks === true)).toBeDefined();

      // But only target1 should have speed reduction (once per turn)
      expect(target1Final?.statusEffects.find(e => e.name === 'Slasher Slow')).toBeDefined();
      expect(target2Final?.statusEffects.find(e => e.name === 'Slasher Slow')).toBeUndefined();
    });
  });

  describe('Integration: Both Effects Together', () => {
    it('applies both speed reduction and disadvantage on a critical slashing hit', () => {
      const attacker = makeCharacter('attacker', { x: 0, y: 0 }, { feats: ['slasher'] });
      const target = makeCharacter('target', { x: 1, y: 0 }, { team: 'enemy' });
      const state = makeState([attacker, target], attacker.id);

      const effect = makeSlashingDamageEffect();
      const context = makeContext(attacker, [target], { isCritical: true });
      const command = new DamageCommand(effect, context);
      const result = command.execute(state);

      const updatedTarget = result.characters.find(c => c.id === 'target');

      // Should have BOTH effects
      expect(updatedTarget?.statusEffects.find(e => e.name === 'Slasher Slow')).toBeDefined();
      expect(updatedTarget?.activeEffects?.find(e => e.mechanics?.disadvantageOnAttacks === true)).toBeDefined();

      // Should have both log entries
      expect(result.combatLog.find(e => e.message.includes('Slasher feat slows'))).toBeDefined();
      expect(result.combatLog.find(e => e.message.includes('CRITICAL HIT'))).toBeDefined();
    });
  });
});
