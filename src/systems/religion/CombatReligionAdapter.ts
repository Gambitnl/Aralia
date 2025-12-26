
import React from 'react';
import { CombatLogEntry } from '../../types/combat';
import { AppAction } from '../../state/actionTypes';

/**
 * Adapter to translate Combat Log events into Religion System triggers.
 * It listens to the log stream and dispatches 'TRIGGER_DEITY_ACTION' when appropriate.
 */
export class CombatReligionAdapter {
    /**
     * Analyzes a log entry and dispatches deity triggers if matches are found.
     */
    static processLogEntry(
        entry: CombatLogEntry,
        dispatch: React.Dispatch<AppAction>
    ): void {
        const { type, data } = entry;
        if (!data) return;

        // 1. Handle Death Events (e.g., Kill Undead, Kill Elf)
        if (type === 'damage' && data.isDeath && data.targetTags) {
            const tags = (data.targetTags as string[]).map(t => t.toLowerCase());

            if (tags.includes('undead')) {
                dispatch({
                    type: 'TRIGGER_DEITY_ACTION',
                    payload: { trigger: 'DESTROY_UNDEAD' }
                });
            }

            if (tags.includes('elf')) {
                dispatch({
                    type: 'TRIGGER_DEITY_ACTION',
                    payload: { trigger: 'KILL_ELF' }
                });
            }

            // Check for specific deity approvals on kill types
            // This is a simplified check. Ideally we'd look up every tag against every deity trigger map.
            // But 'DESTROY_UNDEAD' and 'KILL_ELF' are the primary ones in data right now.
        }

        // 2. Handle Healing (Heal Ally)
        // Note: CombatLog doesn't explicitly say "Ally", but usually players heal allies.
        // We assume positive healing during combat is benevolent.
        if (type === 'heal' && (data.healAmount || 0) > 0) {
            // Threshold to avoid spamming for +1 HP
            if ((data.healAmount as number) >= 5) {
                dispatch({
                    type: 'TRIGGER_DEITY_ACTION',
                    payload: { trigger: 'HEAL_ALLY' }
                });
            }
        }

        // 3. Handle Necromancy (Cast Spell, Damage, or Heal)
        // Check for spellSchool in data regardless of event type, as DamageCommand/HealingCommand emit specific types.
        if (data.spellSchool === 'necromancy') {
             dispatch({
                type: 'TRIGGER_DEITY_ACTION',
                payload: { trigger: 'USE_NECROMANCY' } // Often a forbidden action
            });
             dispatch({
                type: 'TRIGGER_DEITY_ACTION',
                payload: { trigger: 'CAST_NECROMANCY' } // Vecna approves
            });
        }

        // 4. Handle Spellcasting (General)
        if (data.spellSchool) {
             // Corellon likes high level spells, but we need spell level info.
             // For now, simple school checks.
        }
    }
}
