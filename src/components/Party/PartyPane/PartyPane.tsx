/**
 * @file PartyPane.tsx
 * Displays a list of party member cards with detailed combat stats.
 * This is the main content area of the Party Overlay modal.
 */

import React from 'react';
import { PlayerCharacter, MissingChoice } from '../../../types';
import PartyMemberCard from './PartyMemberCard';

// -----------------------------------------------------------------------------
// Props Interface
// -----------------------------------------------------------------------------

interface PartyPaneProps {
    /** Array of party member characters to display */
    party: PlayerCharacter[];
    /** Callback when a character's "more" button is clicked (opens character sheet) */
    onViewCharacterSheet: (character: PlayerCharacter) => void;
    /** Callback when a missing choice warning is clicked */
    onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * PartyPane renders a vertical list of party member cards.
 * Each card shows the character's key stats, HP, spell slots, and abilities.
 */
const PartyPane: React.FC<PartyPaneProps> = ({
    party,
    onViewCharacterSheet,
    onFixMissingChoice
}) => {
    // Handle empty party state
    if (party.length === 0) {
        return (
            <div className="w-full p-8 text-center">
                <p className="text-gray-400 text-lg">No party members yet.</p>
                <p className="text-gray-500 text-sm mt-2">
                    Create a character to begin your adventure.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-3">
            {/* Render a card for each party member */}
            {party.map(member => (
                <PartyMemberCard
                    key={member.id || member.name}
                    character={member}
                    onMoreClick={() => onViewCharacterSheet(member)}
                    onMissingChoiceClick={onFixMissingChoice}
                />
            ))}
        </div>
    );
};

export default PartyPane;
