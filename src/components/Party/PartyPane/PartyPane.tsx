/**
 * @file PartyPane.tsx
 * Displays a list of party member cards with detailed combat stats.
 * This is the main content area of the Party Overlay modal.
 */

import React from 'react';
import { PlayerCharacter, MissingChoice, Companion } from '../../../types';
import PartyMemberCard from './PartyMemberCard';
import { partyCount, isOverSoftCap, SOFT_PARTY_CAP } from '../../../systems/party/partyConstants';

// -----------------------------------------------------------------------------
// Props Interface
// -----------------------------------------------------------------------------

interface PartyPaneProps {
    /** Array of party member characters to display */
    party: PlayerCharacter[];
    /** Optional companion data to enrich the party cards */
    companions?: Record<string, Companion>;
    /** Callback when a character's "more" button is clicked (opens character sheet) */
    onViewCharacterSheet: (character: PlayerCharacter) => void;
    /** Callback when a missing choice warning is clicked */
    onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
    /**
     * Optional dismiss handler threaded down to each member card. The card omits
     * the control for the party leader (`player` id), so the leader can never be
     * dismissed even when this is provided.
     */
    onDismissMember?: (id: string) => void;
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
    companions,
    onViewCharacterSheet,
    onFixMissingChoice,
    onDismissMember
}) => {
    // Party-size hint vs the advisory soft cap (NOT a hard limit — over-cap is
    // allowed and only styled as a gentle "large party" warning).
    const count = partyCount(party);
    const overSoftCap = isOverSoftCap(party);

    // Handle empty party state
    if (party.length === 0) {
        return (
            <div className="w-full p-8 text-center">
                <p className="text-gray-400 text-lg">No party members yet.</p>
                <p className="text-gray-400 text-sm mt-2">
                    Create a character to begin your adventure.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-3">
            {/* Header: party count vs the advisory soft cap (hint, never a limit) */}
            <div className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400/90">
                    Party
                </h2>
                <div className="flex items-center gap-2 text-xs">
                    <span
                        className="font-mono text-gray-300"
                        aria-label={`Party size: ${count} of ${SOFT_PARTY_CAP} suggested`}
                    >
                        {count}<span className="text-gray-500"> / {SOFT_PARTY_CAP}</span>
                    </span>
                    {overSoftCap && (
                        <span
                            className="inline-flex items-center rounded border border-amber-400/40 bg-amber-950/60 px-2 py-0.5 font-semibold text-amber-200"
                            role="status"
                            title={`Your party is larger than the suggested ${SOFT_PARTY_CAP} members.`}
                        >
                            Large party
                        </span>
                    )}
                </div>
            </div>

            {/* Render a card for each party member */}
            {party.map((member, index) => {
                const companion = companions?.[member.id];
                return (
                    <PartyMemberCard
                        key={member.id || member.name}
                        character={member}
                        companion={companion}
                        isLeader={index === 0}
                        onMoreClick={() => onViewCharacterSheet(member)}
                        onMissingChoiceClick={onFixMissingChoice}
                        onDismiss={onDismissMember}
                    />
                );
            })}
        </div>
    );
};

export default PartyPane;
