// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 01/07/2026, 22:47:09
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, useCallback } from 'react';
import { CombatCharacter, ActionCostType, AbilityEffect } from '../../types/combat';
import { Spell, SummoningEffect, FamiliarContract } from '../../types/spells';
import { generateId } from '../../utils/combatUtils';
import { getSummonTemplate, SummonTemplate } from '../../data/summonTemplates';
import { Class } from '../../types/character';

/**
 * This hook keeps a local list of summoned actors for UI/helper flows.
 *
 * The active spell-casting runtime currently creates combat summons through
 * `SummoningCommand`, not through this hook. We keep this hook aligned with the
 * command metadata shape because older tests still reference it, but it is not
 * the authoritative summon owner and production spell casting should not route
 * through it unless a future parity slice deliberately changes that contract.
 *
 * Called by: helper tests and any future preview-only UI that needs local summon
 * state without claiming ownership of production spell-created actors.
 * Depends on: summon templates and CombatCharacter metadata.
 */

interface UseSummonsProps {
    onSummonAdded?: (summon: CombatCharacter) => void;
    onSummonRemoved?: (summonId: string) => void;
}

// Extends the core spell effect with runtime resolution fields used by this hook
interface ResolvedSummonEffect extends Partial<SummoningEffect> {
    // Fields from SummoningEffect that are explicitly accessed
    duration?: SummoningEffect['duration'];
    familiarContract?: FamiliarContract;

    // Additional runtime fields used in addSummon
    statBlock?: SummonTemplate;
    formOptions?: string[];
    specialActions?: { name: string; description: string; cost?: string; damage?: { dice: string; type: string } }[];
    entityType?: string; // Appears to be an alias or legacy field for summonType
    dismissAction?: boolean;
}

export const useSummons = ({ onSummonAdded, onSummonRemoved }: UseSummonsProps = {}) => {
    const [summonedEntities, setSummonedEntities] = useState<CombatCharacter[]>([]);

    const addSummon = useCallback((
        caster: CombatCharacter,
        spell: Spell,
        summonEffect: ResolvedSummonEffect,
        position: { x: number; y: number },
        formIndex: number = 0
    ) => {
        // Determine stats based on effect definition or selected form
        let statBlock: SummonTemplate | undefined = summonEffect.statBlock;
        let selectedFormName: string | undefined;

        // Handle form selection (e.g. from familiar options) if statBlock is missing
        if (!statBlock) {
            const forms = summonEffect.formOptions || summonEffect.familiarContract?.forms;
            if (forms && Array.isArray(forms) && forms.length > 0) {
                // Safely access the selected form, defaulting to the first one if index is invalid
                selectedFormName = forms[formIndex] || forms[0];
                statBlock = getSummonTemplate(selectedFormName);

                if (!statBlock) {
                    console.warn(`Could not find stat block for form: ${selectedFormName}`);
                }
            }
        }

        if (!statBlock) {
            console.warn("Attempted to summon entity without stat block definition.");
            return;
        }

        const newSummon: CombatCharacter = {
            id: generateId(),
            name: statBlock.name || `Summoned ${summonEffect.entityType || 'Creature'}`,
            team: caster.team, // Allied with caster
            position,
            maxHP: statBlock.hp || 10,
            currentHP: statBlock.hp || 10,
            armorClass: statBlock.ac || 10,
            stats: {
                strength: statBlock.abilities?.str || 10,
                dexterity: statBlock.abilities?.dex || 10,
                constitution: statBlock.abilities?.con || 10,
                intelligence: statBlock.abilities?.int || 10,
                wisdom: statBlock.abilities?.wis || 10,
                charisma: statBlock.abilities?.cha || 10,
                baseInitiative: 0,
                speed: statBlock.speed || 30,
                cr: statBlock.cr ? String(statBlock.cr) : "0"
            },
            abilities: (summonEffect.specialActions || []).map((action, index: number) => {
                const isAttack = !!action.damage;
                // Calculate average damage for the value field (e.g., "1d6" -> 3.5 -> 3)
                let effectValue = 0;
                if (action.damage?.dice) {
                   const match = action.damage.dice.match(/^(\d+)d(\d+)([+-]\d+)?$/);
                   if (match) {
                       const num = parseInt(match[1], 10);
                       const die = parseInt(match[2], 10);
                       const mod = match[3] ? parseInt(match[3], 10) : 0;
                       effectValue = Math.floor(num * (die + 1) / 2 + mod);
                   }
                }

                return {
                    id: `summon_action_${index}`,
                    name: action.name,
                    description: action.description,
                    type: isAttack ? 'attack' : 'utility',
                    cost: { type: (action.cost as ActionCostType) || 'action' },
                    targeting: isAttack ? 'single_enemy' : 'self', // Default assumption
                    range: isAttack ? 5 : 0, // Default to melee range
                    effects: action.damage ? [{
                        type: 'damage',
                        value: effectValue,
                        damageType: (action.damage.type as AbilityEffect['damageType']) || 'bludgeoning'
                    }] : [],
                    icon: isAttack ? '⚔️' : '✨'
                };
            }),
            statusEffects: [],
            conditions: [],
            level: 1, // Default for summons
            class: 'Monster' as unknown as Class, // Or specific class if applicable
            initiative: 0,
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                movement: { used: 0, total: statBlock.speed || 30 },
                freeActions: 1,
                legendary: { used: 0, total: 0 }
            },
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: spell.id,
                // Keep this hook's summon records aligned with command-created
                // summons. Even if this path remains a UI/helper path, map
                // labels and lifecycle code need the same identity fields
                // instead of guessing from the rendered name.
                entityType: summonEffect.entityType,
                formName: selectedFormName ?? summonEffect.statBlock?.name ?? statBlock.name,
                sourceName: spell.name,
                durationRemaining: typeof summonEffect.duration?.value === 'number' ? summonEffect.duration.value : undefined,
                dismissable: !!summonEffect.dismissAction
            }
        };

        setSummonedEntities(prev => [...prev, newSummon]);
        if (onSummonAdded) onSummonAdded(newSummon);

        return newSummon;
    }, [onSummonAdded]);

    const removeSummon = useCallback((summonId: string) => {
        setSummonedEntities(prev => prev.filter(e => e.id !== summonId));
        if (onSummonRemoved) onSummonRemoved(summonId);
    }, [onSummonRemoved]);

    const _updateSummons = useCallback((_activeRound: number) => {
        // Decrement duration logic could go here if managed centrally
        // For now, rely on TurnManager to handle generic duration if added as status effect
    }, []);

    return {
        summonedEntities,
        addSummon,
        removeSummon
    };
};
