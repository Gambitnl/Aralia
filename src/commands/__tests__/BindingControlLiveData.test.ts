import { describe, expect, it, vi } from 'vitest';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { StatusConditionEffect } from '../../types/spells';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../utils/factories';
import geas from '../../../public/data/spells/level-5/geas.json';
import planarBinding from '../../../public/data/spells/level-5/planar-binding.json';

/**
 * Geas and Planar Binding control an existing target through a command or binding
 * relationship instead of creating a summon actor. This proof keeps those facts
 * attached to the live status condition so later UI, AI, cleanup, and travel
 * work can read the runtime condition without reparsing spell JSON.
 */

vi.mock('../../utils/savingThrowUtils', () => ({
  calculateSpellDC: vi.fn(() => 16),
  rollSavingThrow: vi.fn(() => ({
    roll: 3,
    modifier: 0,
    total: 3,
    dc: 16,
    success: false,
    modifiersApplied: []
  }))
}));

type BindingControlView = {
  bindingControl?: {
    entityType?: string;
    controlType?: string;
    commandScope?: string;
    serviceDuration?: string;
    obedience?: string;
    hostileTwist?: string;
    sourceSpellExtension?: string;
    communication?: {
      mode?: string;
      targetMustUnderstand?: boolean;
      commandExamples?: string[];
      reportBehavior?: string;
    };
    travel?: {
      mode?: string;
      samePlane?: string;
      differentPlane?: string;
      sourceSpellExtension?: string;
    };
    conditionalEndings?: Array<{
      trigger?: string;
      scope?: string;
      description?: string;
    }>;
  };
};

describe('Binding and command-control live data bridge', () => {
  it('preserves Geas command-compulsion metadata on the Charmed target', async () => {
    const caster = createMockCombatCharacter({
      id: 'geas-caster',
      name: 'Geas Caster'
    }) as CombatCharacter;
    const target = createMockCombatCharacter({
      id: 'geas-target',
      name: 'Geas Target',
      creatureTypes: ['Humanoid'],
      conditions: [],
      statusEffects: []
    }) as CombatCharacter;
    const effect = geas.effects.find(candidate => candidate.type === 'STATUS_CONDITION') as unknown as StatusConditionEffect;
    const context = {
      spellId: geas.id,
      spellName: geas.name,
      castAtLevel: geas.level,
      caster,
      targets: [target],
      gameState: createMockGameState(),
      effectDuration: geas.duration
    } as CommandContext;
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 9,
        currentCharacterId: caster.id,
        turnOrder: [caster.id, target.id],
        phase: 'action',
        actionsThisTurn: []
      }
    }) as CombatState;

    const afterCast = await new StatusConditionCommand(effect, context).execute(state);
    const updatedTarget = afterCast.characters.find(character => character.id === target.id);
    const charmedStatus = updatedTarget?.statusEffects.find(status => status.name === 'Charmed') as BindingControlView | undefined;
    const charmedCondition = updatedTarget?.conditions?.find(condition => condition.name === 'Charmed') as BindingControlView | undefined;

    expect(charmedStatus?.bindingControl).toEqual(expect.objectContaining({
      entityType: 'compelled_command_target',
      controlType: 'long-duration verbal obligation',
      commandScope: 'service or refrain from action',
      communication: expect.objectContaining({
        mode: 'understood_verbal_command_status_gate',
        targetMustUnderstand: true
      }),
      conditionalEndings: expect.arrayContaining([
        expect.objectContaining({ trigger: 'caster_issues_suicidal_command' }),
        expect.objectContaining({ trigger: 'remove_curse_greater_restoration_or_wish' })
      ])
    }));
    expect(charmedCondition?.bindingControl).toEqual(charmedStatus?.bindingControl);
  });

  it('preserves Planar Binding service, reporting, and travel metadata on the Bound target', async () => {
    const caster = createMockCombatCharacter({
      id: 'binding-caster',
      name: 'Binding Caster'
    }) as CombatCharacter;
    const target = createMockCombatCharacter({
      id: 'binding-target',
      name: 'Binding Target',
      creatureTypes: ['Fiend'],
      conditions: [],
      statusEffects: []
    }) as CombatCharacter;
    const effect = planarBinding.effects.find(candidate => candidate.type === 'STATUS_CONDITION') as unknown as StatusConditionEffect;
    const context = {
      spellId: planarBinding.id,
      spellName: planarBinding.name,
      castAtLevel: planarBinding.level,
      caster,
      targets: [target],
      gameState: createMockGameState(),
      effectDuration: planarBinding.duration
    } as CommandContext;
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 12,
        currentCharacterId: caster.id,
        turnOrder: [caster.id, target.id],
        phase: 'action',
        actionsThisTurn: []
      }
    }) as CombatState;

    const afterCast = await new StatusConditionCommand(effect, context).execute(state);
    const updatedTarget = afterCast.characters.find(character => character.id === target.id);
    const boundStatus = updatedTarget?.statusEffects.find(status => status.name === 'Bound') as BindingControlView | undefined;
    const boundCondition = updatedTarget?.conditions?.find(condition => condition.name === 'Bound') as BindingControlView | undefined;

    expect(boundStatus?.bindingControl).toEqual(expect.objectContaining({
      entityType: 'bound_celestial_elemental_fey_or_fiend',
      serviceDuration: '24 hours base, scaling by slot',
      obedience: 'serves caster and follows instructions to best of ability',
      hostileTwist: 'hostile target can twist words to its own objectives',
      sourceSpellExtension: 'summoned or created target source spell duration extends to match binding',
      communication: expect.objectContaining({
        mode: 'literal_instruction_binding',
        commandExamples: ['accompany caster', 'guard a location', 'deliver a message'],
        reportBehavior: 'if instructions complete before spell ends, creature reports based on same-plane/different-plane rules'
      }),
      travel: expect.objectContaining({
        mode: 'bound_creature_report_travel',
        sourceSpellExtension: 'summoned or created target source spell duration extends to match binding duration'
      }),
      conditionalEndings: expect.arrayContaining([
        expect.objectContaining({ trigger: 'instructions_completed_before_spell_ends_same_plane' }),
        expect.objectContaining({ trigger: 'instructions_completed_before_spell_ends_different_plane' })
      ])
    }));
    expect(boundCondition?.bindingControl).toEqual(boundStatus?.bindingControl);
  });
});
