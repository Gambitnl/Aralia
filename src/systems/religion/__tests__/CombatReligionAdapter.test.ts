
import { describe, it, expect, vi } from 'vitest';
import { CombatReligionAdapter } from '../CombatReligionAdapter';
import { CombatLogEntry } from '../../../types/combat';

describe('CombatReligionAdapter', () => {
    it('dispatches DESTROY_UNDEAD when an undead is killed', () => {
        const dispatch = vi.fn();
        const entry: CombatLogEntry = {
            id: '1',
            timestamp: 123,
            type: 'damage',
            message: 'Skeleton dies',
            data: {
                isDeath: true,
                targetTags: ['Undead', 'Skeleton'],
                damage: 10
            }
        };

        CombatReligionAdapter.processLogEntry(entry, dispatch);

        expect(dispatch).toHaveBeenCalledWith({
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'DESTROY_UNDEAD' }
        });
    });

    it('dispatches KILL_ELF when an elf is killed', () => {
        const dispatch = vi.fn();
        const entry: CombatLogEntry = {
            id: '1',
            timestamp: 123,
            type: 'damage',
            message: 'Elf dies',
            data: {
                isDeath: true,
                targetTags: ['Humanoid', 'Elf'],
                damage: 10
            }
        };

        CombatReligionAdapter.processLogEntry(entry, dispatch);

        expect(dispatch).toHaveBeenCalledWith({
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'KILL_ELF' }
        });
    });

    it('dispatches HEAL_ALLY when significant healing occurs', () => {
        const dispatch = vi.fn();
        const entry: CombatLogEntry = {
            id: '1',
            timestamp: 123,
            type: 'heal',
            message: 'Cleric heals Fighter',
            data: {
                healAmount: 10,
                source: 'Cure Wounds'
            }
        };

        CombatReligionAdapter.processLogEntry(entry, dispatch);

        expect(dispatch).toHaveBeenCalledWith({
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'HEAL_ALLY' }
        });
    });

    it('ignores minor healing', () => {
        const dispatch = vi.fn();
        const entry: CombatLogEntry = {
            id: '1',
            timestamp: 123,
            type: 'heal',
            message: 'Regen',
            data: {
                healAmount: 1, // Below threshold
                source: 'Regen'
            }
        };

        CombatReligionAdapter.processLogEntry(entry, dispatch);

        expect(dispatch).not.toHaveBeenCalled();
    });

    it('handles necromancy spell casting', () => {
        const dispatch = vi.fn();
        const entry: CombatLogEntry = {
            id: '1',
            timestamp: 123,
            type: 'action', // Assuming spells log as actions
            message: 'Wizard casts Animate Dead',
            data: {
                spellSchool: 'necromancy',
                spellName: 'Animate Dead'
            }
        };

        CombatReligionAdapter.processLogEntry(entry, dispatch);

        expect(dispatch).toHaveBeenCalledWith({
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'USE_NECROMANCY' }
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'CAST_NECROMANCY' }
        });
    });
});
