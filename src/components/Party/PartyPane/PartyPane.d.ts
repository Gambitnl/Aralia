/**
 * @file PartyPane.tsx
 * Displays a list of party member cards with detailed combat stats.
 * This is the main content area of the Party Overlay modal.
 */
import React from 'react';
import { PlayerCharacter, MissingChoice, Companion } from '../../../types';
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
/**
 * PartyPane renders a vertical list of party member cards.
 * Each card shows the character's key stats, HP, spell slots, and abilities.
 */
declare const PartyPane: React.FC<PartyPaneProps>;
export default PartyPane;
