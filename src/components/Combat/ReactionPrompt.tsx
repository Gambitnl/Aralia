/**
 * @file ReactionPrompt.tsx
 * Modal component for displaying reaction opportunities (e.g. Shield spell)
 * and capturing user choice.
 */
/**
 * This file renders a popup modal when a character can use their reaction.
 *
 * During combat, if something happens that allows a character to react (such as getting hit
 * by an attack and casting the Shield spell, or a foe moving away provoking an Opportunity Attack),
 * this component halts user input on the map and displays the available reaction options.
 * The player can choose to execute one of the reactions (casting a spell or swinging a specific weapon)
 * or decline/skip the reaction entirely.
 *
 * The blocking overlay, dim backdrop, focus trap, and centered panel are provided by the
 * shared {@link ModalDialog} shell; this component supplies the reaction-specific header,
 * scenario description, and choice buttons, keeping its purple identity via `accentClass`.
 *
 * Rendered by: CombatView.tsx (Modal overlay layer)
 * Depends on: ModalDialog for the accessible blocking shell, Spell and Ability types for data.
 */

import React from 'react';
import { Spell } from '../../types/spells';
import { Ability } from '../../types/combat';
import { ModalDialog } from '../ui/ModalDialog';

type ReactionSpellOption = Spell | Ability;

// ============================================================================
// Reaction Prompt Properties
// ============================================================================
// Defines what the parent combat coordinator must pass down to render the
// reaction modal. Supports both spells (like Shield) and weapons (for Opportunity Attacks).
// ============================================================================
interface ReactionPromptProps {
    // The name of the character attacking or provoking the reaction
    attackerName: string;
    // The name of the target being attacked or moving away (useful for Opportunity Attacks)
    targetName?: string;
    // Spells available to cast as a reaction
    reactionSpells?: ReactionSpellOption[];
    // Melee weapons/attacks available to execute as an Opportunity Attack reaction
    reactionWeapons?: Ability[];
    // The category/trigger type of this reaction (e.g., 'on_hit', 'opportunity_attack')
    triggerType: string;
    // Callback when the player selects a reaction option or decides to skip
    onResolve: (choiceId: string | null) => void;
}

// ============================================================================
// Reaction Prompt Component
// ============================================================================
// A modal window that traps keyboard focus and forces the player to decide
// whether to spend their reaction resource before the turn sequence continues.
// ============================================================================
export const ReactionPrompt: React.FC<ReactionPromptProps> = ({
    attackerName,
    targetName = 'Unknown',
    reactionSpells = [],
    reactionWeapons = [],
    triggerType,
    onResolve
}) => {
    // Determine if this reaction is a tactical Opportunity Attack
    const isOpportunityAttack = triggerType === 'opportunity_attack';

    // Build user-friendly strings for title and descriptions
    const titleText = isOpportunityAttack ? 'Opportunity Attack!' : 'Reaction Opportunity!';
    const actionCostLabel = '1 Reaction';

    return (
        <ModalDialog
            isOpen={true}
            onClose={() => onResolve(null)}
            id="reaction"
            size="md"
            accentClass="border-purple-500/50"
            ariaDescribedBy="reaction-description"
            footer={
                // Decline reaction and resume normal turn flow
                <button
                    onClick={() => onResolve(null)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium hover:bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                    Skip Reaction
                </button>
            }
        >
            {/* Modal Title Bar */}
            <div className="flex items-center justify-between mb-6">
                <h2
                    id="reaction-title"
                    className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"
                >
                    {titleText}
                </h2>
                <div className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs rounded uppercase tracking-wider font-semibold">
                    {triggerType.replace('_', ' ')}
                </div>
            </div>

            {/* Scenario Description */}
            <p id="reaction-description" className="text-gray-300 mb-6 leading-relaxed">
                {isOpportunityAttack ? (
                    <>
                        <span className="text-white font-medium">{targetName}</span> is moving out of your reach!
                        Would you like to use your reaction to make an Opportunity Attack?
                    </>
                ) : (
                    <>
                        <span className="text-white font-medium">{attackerName}</span> hit you!
                        Would you like to use your reaction?
                    </>
                )}
            </p>

            {/* List of Choice Buttons */}
            <div className="space-y-3 mb-6">
                {/* Render weapon choices if this is an Opportunity Attack */}
                {isOpportunityAttack && reactionWeapons.map((weaponAbility) => {
                    // Extract damage information to show in the choice button
                    const damageEffect = weaponAbility.effects.find(e => e.type === 'damage');
                    const damageLabel = damageEffect
                        ? ` (${damageEffect.dice || damageEffect.value}${damageEffect.damageType ? ' ' + damageEffect.damageType : ''})`
                        : '';

                    return (
                        <button
                            key={weaponAbility.id}
                            onClick={() => onResolve(weaponAbility.id)}
                            className="w-full group relative overflow-hidden p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/80 transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="flex items-center justify-between relative z-[var(--z-index-content-overlay-low)]">
                                <span className="font-semibold text-purple-300 group-hover:text-purple-200 transition-colors">
                                    Strike with {weaponAbility.name}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                    {actionCostLabel}
                                </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                Attack roll with weapon properties{damageLabel}
                            </div>
                        </button>
                    );
                })}

                {/* Render reaction spells for magical protection/countermeasures, including War Caster Opportunity Attack substitutions. */}
                {reactionSpells.map((spell) => (
                    <button
                        key={spell.id}
                        onClick={() => onResolve(spell.id)}
                        className="w-full group relative overflow-hidden p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/80 transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="flex items-center justify-between relative z-[var(--z-index-content-overlay-low)]">
                            <span className="font-semibold text-purple-300 group-hover:text-purple-200 transition-colors">
                                Cast {spell.name}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                                1 Reaction + Slot
                            </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                            {isOpportunityAttack ? `War Caster spell option. ${spell.description}` : spell.description}
                        </div>
                    </button>
                ))}
            </div>
        </ModalDialog>
    );
};
