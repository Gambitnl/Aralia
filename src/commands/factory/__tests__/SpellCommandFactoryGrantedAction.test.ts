import { describe, it, expect, beforeEach } from 'vitest';
import { SpellCommandFactory } from '../SpellCommandFactory';
import { createMockCombatCharacter, createMockGameState } from '@/utils/factories';
import { SpellSchool, type Spell, type UtilityEffect } from '@/types/spells';

/**
 * This test file proves that extra actions granted by a spell stay attached to
 * the command produced for combat.
 *
 * Package 16 added `grantedActions` to the shared effect shape because repeat
 * actions can live on utility, terrain, or damage-adjacent spell effects. The
 * command factory is the handoff point between spell JSON and the combat
 * simulator, so this test protects that handoff from silently dropping the new
 * player-facing action data.
 *
 * Called by: Vitest when Package 16 or the spell command factory is verified.
 * Depends on: SpellCommandFactory plus the shared spell type definitions.
 */

describe('SpellCommandFactory - Granted Action Integration', () => {
  let caster: ReturnType<typeof createMockCombatCharacter>;
  let gameState: ReturnType<typeof createMockGameState>;

  // Build a fresh caster and game state for each check so one test cannot leak
  // command state into the next one.
  beforeEach(() => {
    caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Test Caster'
    });
    gameState = createMockGameState();
  });

  it('preserves grantedActions on the output command', async () => {
    // This lightweight spell mirrors the Package 16 data shape without needing
    // to load a real spell JSON fixture. The important part is that the effect
    // carries a bonus action before it enters the command factory.
    const spellWithGrantedAction: Spell = {
      id: 'granted-action-test',
      name: 'Granted Action Test',
      level: 1,
      school: SpellSchool.Transmutation,
      classes: [],
      subClasses: [],
      tags: [],
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'self', distance: 0 },
      components: { verbal: true, somatic: true, material: false, materialDescription: '', isConsumed: false, materialCost: 0 },
      duration: { type: 'timed', value: 10, unit: 'minute', concentration: true },
      targeting: { type: 'self', validTargets: ['self'] },
      effects: [
        {
          type: 'UTILITY',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'always' },
          utilityType: 'other',
          description: 'Grants an action',
          grantedActions: [
            {
              type: 'bonus_action',
              action: 'Dash',
              frequency: 'each_turn',
              actor: 'caster',
              actionKind: 'standard_action',
              notes: 'You can take the Dash action as a Bonus Action.'
            }
          ]
        } as UtilityEffect
      ],
      arbitrationType: 'mechanical',
      description: 'Test spell for granted action.'
    };

    const commands = await SpellCommandFactory.createCommands(spellWithGrantedAction, caster, [caster], 1, gameState);

    // Find the command created for the utility effect and make sure combat can
    // still see the granted Dash action after command creation.
    const utilityCommand = commands.find(
      command => (command as unknown as { effect?: { type?: string } }).effect?.type === 'UTILITY'
    );
    expect(utilityCommand).toBeDefined();

    const utilityEffect = (utilityCommand as unknown as { effect: UtilityEffect }).effect;
    expect(utilityEffect.grantedActions).toBeDefined();
    expect(utilityEffect.grantedActions![0].action).toBe('Dash');
  });
});
