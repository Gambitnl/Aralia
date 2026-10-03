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
type ReactionSpellOption = Spell | Ability;
interface ReactionPromptProps {
    attackerName: string;
    targetName?: string;
    reactionSpells?: ReactionSpellOption[];
    reactionWeapons?: Ability[];
    triggerType: string;
    onResolve: (choiceId: string | null) => void;
}
export declare const ReactionPrompt: React.FC<ReactionPromptProps>;
export {};
