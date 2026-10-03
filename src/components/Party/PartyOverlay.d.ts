/**
 * @file PartyOverlay.tsx
 * A modal overlay to display the player's party members with detailed stats.
 * Uses WindowFrame for consistent modal behavior (draggable, resizable).
 *
 * Features:
 * - Party member cards with combat stats, HP, spell slots
 * - Footer with Long Rest and Short Rest buttons
 * - Short rest indicator showing remaining rests for the day
 * - Combat-aware rest gating so the overlay cannot open rest flows mid-fight
 */
import React from 'react';
import { PlayerCharacter, MissingChoice, ShortRestTracker, Companion } from '../../types';
interface PartyOverlayProps {
    /** Whether the overlay is currently visible */
    isOpen: boolean;
    /** Callback to close the overlay */
    onClose: () => void;
    /** Array of party members to display */
    party: PlayerCharacter[];
    /** Optional record of companions in state */
    companions?: Record<string, Companion>;
    /** Callback when viewing a character's full sheet */
    onViewCharacterSheet: (character: PlayerCharacter) => void;
    /** Callback when fixing a missing character choice */
    onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
    /** Callback to initiate a long rest */
    onLongRest?: () => void;
    /** Callback to initiate a short rest (opens RestModal) */
    onShortRest?: () => void;
    /** Current short rest tracking state */
    shortRestTracker?: ShortRestTracker;
    /** Whether active enemies are present in the current combat state */
    isCombatActive?: boolean;
    /**
     * Optional dismiss handler threaded down to PartyPane and each member card.
     * The card omits the control for the party leader (`player` id), so the
     * leader can never be dismissed even when this is provided.
     */
    onDismissMember?: (id: string) => void;
}
declare const PartyOverlay: React.FC<PartyOverlayProps>;
export default PartyOverlay;
