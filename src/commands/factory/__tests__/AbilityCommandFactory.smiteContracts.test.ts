import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter, SpellCommandFactory, RegisterRiderCommand } from './AbilityCommandFactory.testHelpers';
import type { CombatState, GameState, Spell } from './AbilityCommandFactory.testHelpers';
import shiningSmite from '../../../../public/data/spells/level-2/shining-smite.json';
import blindingSmite from '../../../../public/data/spells/level-3/blinding-smite.json';

// ============================================================================
// After-Hit Smite Data Contracts
// ============================================================================
// These checks protect the spell-data side of the after-hit runtime bridge.
// Blinding Smite's extra upcast damage must live on the damage rider because
// that is the effect the shared weapon-hit path sends through DamageCommand.
// The Blinded condition row owns repeat saves, not extra damage scaling.
// ============================================================================

describe('after-hit smite data contracts', () => {
  it('keeps Shining Smite on the shared after-hit reaction rider lane', () => {
    const damageEffect = shiningSmite.effects.find(effect => effect.type === 'DAMAGE');
    const modifierEffect = shiningSmite.effects.find(effect => effect.type === 'ATTACK_ROLL_MODIFIER');

    // Shining Smite should wake up from the same after-hit reaction prompt as
    // the other modern smites. The target binding keeps the selected reaction
    // pointed at the creature that was already hit instead of asking for a new
    // target after the attack has resolved.
    expect(shiningSmite.castingTrigger).toEqual(expect.objectContaining({
      type: 'after_attack_hit',
      requiredCost: 'reaction',
      targetBinding: 'triggering_attack_target',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'any',
        includesUnarmedStrike: true
      })
    }));
    expect(shiningSmite.aiContext.playerInputRequired).toBe(false);

    // Both payload rows must stay hit-bound so the shared after-hit
    // materialization step can apply damage, advantage, light, and Invisible
    // suppression to the triggering hit target immediately.
    expect(damageEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit'
    }));
    expect(damageEffect?.damage).toEqual(expect.objectContaining({
      dice: '2d6',
      type: 'Radiant'
    }));
    expect(damageEffect?.scaling).toEqual(expect.objectContaining({
      type: 'slot_level',
      bonusPerLevel: '+1d6'
    }));
    expect(modifierEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit'
    }));
    expect(modifierEffect?.attackRollModifier).toEqual(expect.objectContaining({
      modifier: 'advantage',
      direction: 'incoming',
      consumption: 'while_active'
    }));
    expect(modifierEffect?.light).toEqual(expect.objectContaining({
      brightRadius: 5,
      attachedTo: 'target'
    }));
    expect(modifierEffect?.invisibilitySuppression).toEqual(expect.objectContaining({
      suppressesConditionBenefit: 'Invisible',
      scope: 'target'
    }));
  });

  it('keeps Blinding Smite slot scaling on the executable damage rider', () => {
    const damageEffect = blindingSmite.effects.find(effect => effect.type === 'DAMAGE');
    const statusEffect = blindingSmite.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // Blinding Smite is the melee-only pair to Shining Smite's broader weapon
    // trigger. This live-data guard keeps its reaction prompt, target binding,
    // and unarmed-strike opt-in aligned with the shared after-hit bridge.
    expect(blindingSmite.castingTrigger).toEqual(expect.objectContaining({
      type: 'after_attack_hit',
      requiredCost: 'reaction',
      targetBinding: 'triggering_attack_target',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'melee',
        includesUnarmedStrike: true
      })
    }));
    expect(blindingSmite.aiContext.playerInputRequired).toBe(false);

    // The damage row is the only row that should own extra damage and slot
    // scaling because the shared hit-rider path sends it through DamageCommand.
    expect(damageEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'melee'
      })
    }));
    expect(damageEffect?.damage).toEqual(expect.objectContaining({
      dice: '3d8',
      type: 'Radiant'
    }));
    expect(damageEffect?.scaling).toEqual(expect.objectContaining({
      type: 'slot_level',
      bonusPerLevel: '+1d8'
    }));

    // The status row owns Blinded and its turn-end Constitution repeat save,
    // but it must not carry the upcast damage increment.
    expect(statusEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'melee'
      })
    }));
    expect(statusEffect?.statusCondition).toEqual(expect.objectContaining({
      name: 'Blinded',
      repeatSave: expect.objectContaining({
        timing: 'turn_end',
        saveType: 'Constitution',
        successEnds: true,
        useOriginalDC: true
      })
    }));
    expect(statusEffect?.scaling?.bonusPerLevel ?? '').toBe('');
  });

  it('keeps live smite spell casts on the shared after-hit reaction contract', async () => {
    const paladin = createMockCombatCharacter({
      id: 'paladin',
      name: 'Paladin',
      position: { x: 0, y: 0 }
    });
    const alreadyHitTarget = createMockCombatCharacter({
      id: 'already-hit-target',
      name: 'Already Hit Target',
      position: { x: 1, y: 0 }
    });

    // The hook-side after-hit tests prove when the prompt appears. This
    // live-data factory guard proves the real smite packets still enter that
    // shared reaction lane with a declared reaction cost and with executable
    // hit-bound payload rows ready for the command layer.
    for (const smiteSpell of [shiningSmite, blindingSmite]) {
      const commands = await SpellCommandFactory.createCommands(
        smiteSpell as unknown as Spell,
        paladin,
        [alreadyHitTarget],
        smiteSpell.level,
        {} as GameState
      );
      const riderCommands = commands.filter((command): command is RegisterRiderCommand =>
        command instanceof RegisterRiderCommand
      );
      const state: CombatState = {
        characters: [paladin],
        currentTurn: 1,
        round: 1,
        combatLog: []
      } as CombatState;
      const stateWithRiders = riderCommands.reduce(
        (nextState, command) => command.execute(nextState),
        state
      );
      const updatedPaladin = stateWithRiders.characters.find(character => character.id === paladin.id);

      expect(smiteSpell.castingTrigger).toEqual(expect.objectContaining({
        type: 'after_attack_hit',
        requiredCost: 'reaction',
        targetBinding: 'triggering_attack_target'
      }));
      expect(riderCommands.length).toBeGreaterThan(0);
      expect(riderCommands.every(command => command.description.includes(smiteSpell.name))).toBe(true);
      expect(updatedPaladin?.riders?.length).toBe(riderCommands.length);
      expect(updatedPaladin?.riders?.every(rider =>
        rider.duration.type === 'minutes' &&
        rider.duration.value === smiteSpell.duration.value
      )).toBe(true);
      if (smiteSpell.id === shiningSmite.id) {
        expect(updatedPaladin?.riders?.map(rider => rider.effect.type)).toEqual([
          'DAMAGE',
          'ATTACK_ROLL_MODIFIER'
        ]);
        expect(updatedPaladin?.riders?.[1].effect).toEqual(expect.objectContaining({
          attackRollModifier: expect.objectContaining({
            modifier: 'advantage',
            direction: 'incoming'
          }),
          light: expect.objectContaining({
            brightRadius: 5,
            attachedTo: 'target'
          })
        }));
      }
      if (smiteSpell.id === blindingSmite.id) {
        expect(updatedPaladin?.riders?.map(rider => rider.effect.type)).toEqual([
          'DAMAGE',
          'STATUS_CONDITION'
        ]);
        expect(updatedPaladin?.riders?.[1].effect).toEqual(expect.objectContaining({
          statusCondition: expect.objectContaining({
            name: 'Blinded',
            repeatSave: expect.objectContaining({
              timing: 'turn_end',
              saveType: 'Constitution',
              successEnds: true
            })
          })
        }));
      }
    }
  });
});
