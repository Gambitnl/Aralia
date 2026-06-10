
import { describe, it, expect, vi } from 'vitest';
import { CombatReligionAdapter } from '../CombatReligionAdapter';
import { CombatLogEntry } from '../../../types/combat';

/**
 * This file protects the bridge between combat logs and religion favor triggers.
 *
 * Combat can report deaths, healing, and spell actions with mixed labels from
 * different systems. These tests make sure the adapter still fires legacy
 * doctrine triggers while also honoring the new deity-authored combat taxonomy.
 *
 * Called by: Vitest Religion System checks
 * Depends on: CombatReligionAdapter.ts, deity trigger data, shared combat log types
 */

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
                targetTags: ['uNdEaD', 'Skeleton', 'Minion'],
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
                targetTags: ['Humanoid', 'eLf', 'Drow'],
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

    it('ignores death logs that do not expose combat tags', () => {
        const dispatch = vi.fn();
        const entry: CombatLogEntry = {
            id: '1',
            timestamp: 123,
            type: 'damage',
            message: 'Unknown foe falls',
            data: {
                isDeath: true,
                damage: 8,
                source: 'Axe strike'
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

    it('dispatches taxonomy-backed combat triggers from mixed-case labels', () => {
        const dispatch = vi.fn();
        const entry: CombatLogEntry = {
            id: '1',
            timestamp: 123,
            type: 'damage',
            message: 'Orc raider falls',
            data: {
                isDeath: true,
                targetTags: ['Bandit', 'oRc'],
                damage: 12
            }
        };

        CombatReligionAdapter.processLogEntry(entry, dispatch);

        expect(dispatch).toHaveBeenCalledWith({
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'DEFEAT_ORC' }
        });
    });
});
