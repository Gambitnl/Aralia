import { useState, useCallback } from 'react';
import { CombatCharacter } from '../../types/combat';
import { Spell } from '../../types/spells';
import { generateId } from '../../utils/combatUtils';
import { getSummonTemplate, SummonTemplate } from '../../data/summonTemplates';

interface UseSummonsProps {
    onSummonAdded?: (summon: CombatCharacter) => void;
    onSummonRemoved?: (summonId: string) => void;
}

export const useSummons = ({ onSummonAdded, onSummonRemoved }: UseSummonsProps = {}) => {
    const [summonedEntities, setSummonedEntities] = useState<CombatCharacter[]>([]);

    const addSummon = useCallback((
        caster: CombatCharacter,
        spell: Spell,
        summonEffect: any, // Typed as SummoningEffect["summon"] in usage
        position: { x: number; y: number },
        formIndex: number = 0
    ) => {
        // Determine stats based on effect definition or selected form
        let statBlock: SummonTemplate | undefined = summonEffect.statBlock;

        // Handle form selection (e.g. from familiar options) if statBlock is missing
        if (!statBlock) {
            const forms = summonEffect.formOptions || summonEffect.familiarContract?.forms;
            if (forms && Array.isArray(forms) && forms.length > 0) {
                // Safely access the selected form, defaulting to the first one if index is invalid
                const selectedFormName = forms[formIndex] || forms[0];
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
            name: statBlock.name || `Summoned ${summonEffect.entityType}`,
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
            abilities: [], // TODO: Parse special actions into abilities
            statusEffects: [],
            conditions: [],
            level: 1, // Default for summons
            class: 'Monster' as any, // Or specific class if applicable
            initiative: 0,
            actionEconomy: {
                action: { used: false, remaining: 1 },
                bonusAction: { used: false, remaining: 1 },
                reaction: { used: false, remaining: 1 },
                movement: { used: 0, total: statBlock.speed || 30 },
                freeActions: 1
            },
            isSummon: true,
            summonMetadata: {
                casterId: caster.id,
                spellId: spell.id,
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

    const updateSummons = useCallback((activeRound: number) => {
        // Decrement duration logic could go here if managed centrally
        // For now, rely on TurnManager to handle generic duration if added as status effect
    }, []);

    return {
        summonedEntities,
        addSummon,
        removeSummon
    };
};
