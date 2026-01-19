/**
 * @file PartyOverlay.tsx
 * A modal overlay to display the player's party members with detailed stats.
 * Uses WindowFrame for consistent modal behavior (draggable, resizable).
 *
 * Features:
 * - Party member cards with combat stats, HP, spell slots
 * - Footer with Long Rest and Short Rest buttons
 * - Short rest indicator showing remaining rests for the day
 */

import React from 'react';
import { PlayerCharacter, MissingChoice, ShortRestTracker } from '../../types';
import { WindowFrame } from '../ui/WindowFrame';
import PartyPane from './PartyPane';
import Tooltip from '../ui/Tooltip';
import { GlossaryIcon } from '../Glossary/IconRegistry';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum number of short rests allowed per day */
const MAX_SHORT_RESTS_PER_DAY = 3;

// -----------------------------------------------------------------------------
// Props Interface
// -----------------------------------------------------------------------------

interface PartyOverlayProps {
    /** Whether the overlay is currently visible */
    isOpen: boolean;
    /** Callback to close the overlay */
    onClose: () => void;
    /** Array of party members to display */
    party: PlayerCharacter[];
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
}

// -----------------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------------

/**
 * Footer action button with icon and label.
 */
interface FooterButtonProps {
    /** Icon name from GlossaryIcon registry */
    iconName: string;
    /** Button label text */
    label: string;
    /** Click handler */
    onClick?: () => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Optional tooltip content */
    tooltip?: string;
    /** Button variant - primary has golden background */
    variant?: 'primary' | 'secondary';
    /** Optional badge text (e.g., "2/3") */
    badge?: string;
}

const FooterButton: React.FC<FooterButtonProps> = ({
    iconName,
    label,
    onClick,
    disabled = false,
    tooltip,
    variant = 'secondary',
    badge
}) => {
    const baseClasses = "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors";

    const variantClasses = variant === 'primary'
        ? "bg-amber-500 hover:bg-amber-400 text-gray-900 shadow-lg shadow-amber-500/20"
        : "hover:bg-white/5 text-gray-300 hover:text-white";

    const disabledClasses = disabled
        ? "opacity-50 cursor-not-allowed"
        : "";

    const button = (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses} ${disabledClasses}`}
        >
            <GlossaryIcon name={iconName} className="w-5 h-5" />
            <span>{label}</span>
            {badge && (
                <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                    {badge}
                </span>
            )}
        </button>
    );

    if (tooltip) {
        return (
            <Tooltip content={tooltip}>
                {button}
            </Tooltip>
        );
    }

    return button;
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const PartyOverlay: React.FC<PartyOverlayProps> = ({
    isOpen,
    onClose,
    party,
    onViewCharacterSheet,
    onFixMissingChoice,
    onLongRest,
    onShortRest,
    shortRestTracker
}) => {
    // Don't render anything if not open
    if (!isOpen) return null;

    // Calculate remaining short rests
    const shortRestsTaken = shortRestTracker?.restsTakenToday ?? 0;
    const shortRestsRemaining = MAX_SHORT_RESTS_PER_DAY - shortRestsTaken;
    const canShortRest = shortRestsRemaining > 0;

    return (
        <WindowFrame
            title="Party Roster"
            onClose={onClose}
            storageKey="party-overlay-window"
            initialMaximized={false}
        >
            {/* Main content container with flex column to allow footer */}
            <div className="flex flex-col h-full">
                {/* Scrollable party content area */}
                <div className="flex-1 overflow-y-auto scrollable-content p-4">
                    <PartyPane
                        party={party}
                        onViewCharacterSheet={onViewCharacterSheet}
                        onFixMissingChoice={onFixMissingChoice}
                    />
                </div>

                {/* Footer with rest actions */}
                <div className="shrink-0 border-t border-gray-700 bg-gray-800/50 p-3">
                    <div className="flex items-center justify-center gap-2">
                        {/* Rest action buttons container */}
                        <div className="bg-gray-800 border border-amber-500/20 p-2 rounded-xl flex items-center gap-2 shadow-lg">
                            {/* Long Rest button */}
                            {onLongRest && (
                                <FooterButton
                                    iconName="moon"
                                    label="Long Rest"
                                    onClick={onLongRest}
                                    tooltip="Take a long rest to fully recover HP, spell slots, and abilities (8 hours)"
                                />
                            )}

                            {/* Divider */}
                            {onLongRest && onShortRest && (
                                <div className="w-px h-6 bg-white/10 mx-1" />
                            )}

                            {/* Short Rest button with remaining indicator */}
                            {onShortRest && (
                                <FooterButton
                                    iconName="clock"
                                    label="Short Rest"
                                    onClick={onShortRest}
                                    disabled={!canShortRest}
                                    badge={`${shortRestsRemaining}/${MAX_SHORT_RESTS_PER_DAY}`}
                                    tooltip={
                                        canShortRest
                                            ? `Take a short rest to spend Hit Dice and recover some abilities (1 hour). ${shortRestsRemaining} remaining today.`
                                            : "No short rests remaining today. Take a long rest to reset."
                                    }
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </WindowFrame>
    );
};

export default PartyOverlay;
