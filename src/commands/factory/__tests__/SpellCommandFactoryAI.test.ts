import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpellCommandFactory } from '../SpellCommandFactory';
import { DamageEffect, Spell, SpellEffect } from '@/types/spells';
import { CombatCharacter } from '@/types/combat';
import { DamageCommand } from '@/commands/effects/DamageCommand';
import { NarrativeCommand } from '@/commands/effects/NarrativeCommand';
import { createMockCombatCharacter, createMockGameState } from '@/utils/factories';

// Mock AISpellArbitrator
const mockArbitrate = vi.fn();
vi.mock('@/systems/spells/ai/AISpellArbitrator', () => ({
  aiSpellArbitrator: {
    arbitrate: (...args: unknown[]) => mockArbitrate(...args)
  }
}));

describe('SpellCommandFactory - AI Integration', () => {
  const mockCaster: CombatCharacter = createMockCombatCharacter({
    id: 'caster-1',
    name: 'Merlin',
    position: { x: 10, y: 10 },
    team: 'player'
  });
  mockCaster.stats.size = 'Medium';
  mockCaster.currentHP = 20;
  mockCaster.maxHP = 20;

  const mockTarget: CombatCharacter = createMockCombatCharacter({
    id: 'target-1',
    name: 'Goblin',
    position: { x: 12, y: 10 },
    team: 'enemy'
  });
  mockTarget.stats.size = 'Small';
  mockTarget.currentHP = 10;
  mockTarget.maxHP = 10;

  const mockGameState = createMockGameState();

  const aiSpell: Spell = {
    id: 'wish',
    name: 'Wish',
    level: 9,
    school: 'Conjuration',
    classes: ['Wizard'],
    description: 'A wish spell',
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'self' },
    components: { verbal: true, somatic: false, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'self', validTargets: ['self'] },
    effects: [], // No default effects
    arbitrationType: 'ai_dm',
    aiContext: { prompt: 'DM adjudication', playerInputRequired: true }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process mechanical effects returned by AI', async () => {
    const mechanicalEffect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      damage: { dice: '4d8', type: 'Force' }
    };

    mockArbitrate.mockResolvedValue({
      allowed: true,
      narrativeOutcome: 'The wish manifests a blast of force!',
      mechanicalEffects: [mechanicalEffect]
    });

    const commands = await SpellCommandFactory.createCommands(
      aiSpell,
      mockCaster,
      [mockTarget],
      9,
      mockGameState,
      'I wish to blast the goblin'
    );

    expect(mockArbitrate).toHaveBeenCalled();

    // Should have NarrativeCommand and DamageCommand
    expect(commands.length).toBe(2);
    expect(commands[0]).toBeInstanceOf(NarrativeCommand);
    expect(commands[1]).toBeInstanceOf(DamageCommand);

    const damageCmd = commands[1] as DamageCommand;
    expect(damageCmd.effect.type).toBe('DAMAGE');
    const damageEffect = damageCmd.effect as DamageEffect;
    expect(damageEffect.damage.dice).toBe('4d8');
  });

  it('should supplement existing effects with AI effects', async () => {
    // Spell has a base effect
    const baseEffect: SpellEffect = {
        type: 'HEALING',
        trigger: { type: 'immediate' },
        condition: { type: 'always' },
        healing: { dice: '1d4' }
    };

    const spellWithEffects: Spell = {
        ...aiSpell,
        effects: [baseEffect]
    };

    const aiEffect: SpellEffect = {
      type: 'DAMAGE',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      damage: { dice: '2d6', type: 'Fire' }
    };

    mockArbitrate.mockResolvedValue({
      allowed: true,
      mechanicalEffects: [aiEffect]
    });

    const commands = await SpellCommandFactory.createCommands(
      spellWithEffects,
      mockCaster,
      [mockTarget],
      9,
      mockGameState,
      'I wish for fire and healing'
    );

    // Should have DamageCommand (from AI) and HealingCommand (from base)
    // Note: In current implementation plan, AI effects are processed first (in the if block),
    // then base effects. So DamageCommand then HealingCommand.
    expect(commands.length).toBe(2);
    expect(commands[0]).toBeInstanceOf(DamageCommand);
    expect(commands[1].constructor.name).toBe('HealingCommand');
  });
});
