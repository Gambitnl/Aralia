/**
 * @file PartyMemberCard.tsx
 * A modern, information-dense card component for displaying party member stats.
 * Shows key combat stats (AC, Save DC, Movement, Initiative, Attack Bonuses),
 * HP bar, spell slots for casters, hit dice, and expendable abilities.
 *
 * Design based on concept mockup with charcoal gradient backgrounds and
 * gold/amber accent colors for the D&D fantasy theme.
 */
import React from 'react';
import { PlayerCharacter, MissingChoice, Companion } from '../../../types';
interface PartyMemberCardProps {
    /** The character data to display */
    character: PlayerCharacter;
    /** Optional companion data to show relationship/approval status */
    companion?: Companion;
    /** Callback when the "more" button is clicked (opens character sheet) */
    onMoreClick: () => void;
    /** Callback when missing choice warning is clicked */
    onMissingChoiceClick: (char: PlayerCharacter, missing: MissingChoice) => void;
    /**
     * Optional dismiss handler. When provided, renders a "Dismiss" control that
     * calls back with the member's id. Intentionally NOT rendered for the party
     * leader (`player` id) — see {@link PartyMemberCard} guard below.
     */
    onDismiss?: (id: string) => void;
    /** True for the party leader (roster index 0). The leader can never be dismissed. */
    isLeader?: boolean;
}
declare const PartyMemberCard: React.FC<PartyMemberCardProps>;
export default PartyMemberCard;
