
import { describe, it, expect } from 'vitest';
import { StatusConditionCommand } from '../StatusConditionCommand';
import { createMockCombatState, createMockCombatCharacter } from '../../../utils/factories';
import { StatusConditionEffect, EffectDuration } from '../../../types/spells';

describe('StatusConditionCommand', () => {
    it('applies a status condition correctly', () => {
        const target = createMockCombatCharacter({ id: 'target-1', name: 'Goblin' });
        const caster = createMockCombatCharacter({ id: 'caster-1', name: 'Wizard' });

        const state = createMockCombatState({
            characters: [target, caster],
        });

        const duration: EffectDuration = { type: 'rounds', value: 3 };
        const effect: StatusConditionEffect = {
            type: 'STATUS_CONDITION', // Fixed: Uppercase to match type definition
            trigger: { type: 'immediate' }, // Fixed: Valid trigger type
            condition: { type: 'always' },   // Fixed: Valid condition type
            statusCondition: {
                name: 'Blinded',
                duration: duration
            }
        };

        const command = new StatusConditionCommand(effect, {
            spellId: 'spell-1',
            spellName: 'Blindness',
            caster,
            targets: [target]
        });

        const newState = command.execute(state);
        const updatedTarget = newState.characters.find(c => c.id === target.id);

        expect(updatedTarget).toBeDefined();

        // Check legacy statusEffects
        expect(updatedTarget!.statusEffects).toHaveLength(1);
        expect(updatedTarget!.statusEffects[0].name).toBe('Blinded');
        expect(updatedTarget!.statusEffects[0].duration).toBe(3);

        // Check new conditions array
        expect(updatedTarget!.conditions).toBeDefined();
        expect(updatedTarget!.conditions).toHaveLength(1);
        expect(updatedTarget!.conditions![0].name).toBe('Blinded');
    });

    it('updates duration if condition already exists', () => {
         const target = createMockCombatCharacter({ id: 'target-1', name: 'Goblin' });
         // Pre-apply condition
         target.conditions = [{
             name: 'Blinded',
             duration: { type: 'rounds', value: 1 },
             appliedTurn: 1,
             source: 'old-spell'
         }];
         // Also pre-apply status effect for legacy check
         target.statusEffects = [{
             id: 'existing-status',
             name: 'Blinded',
             type: 'debuff',
             duration: 1,
             effect: { type: 'condition' }
         }];

         const caster = createMockCombatCharacter({ id: 'caster-1', name: 'Wizard' });
         const state = createMockCombatState({
             characters: [target, caster],
         });

         const effect: StatusConditionEffect = {
             type: 'STATUS_CONDITION',
             trigger: { type: 'immediate' },
             condition: { type: 'always' },
             statusCondition: {
                 name: 'Blinded',
                 duration: { type: 'rounds', value: 5 }
             }
         };

         const command = new StatusConditionCommand(effect, {
             spellId: 'spell-2',
             spellName: 'Better Blindness',
             caster,
             targets: [target]
         });

         const newState = command.execute(state);
         const updatedTarget = newState.characters.find(c => c.id === target.id);

         // Should still be one condition, but updated
         expect(updatedTarget!.conditions).toHaveLength(1);
         expect(updatedTarget!.conditions![0].duration.value).toBe(5);

         // Should update legacy status effect too
         expect(updatedTarget!.statusEffects).toHaveLength(1);
         expect(updatedTarget!.statusEffects[0].duration).toBe(5);
    });
});
