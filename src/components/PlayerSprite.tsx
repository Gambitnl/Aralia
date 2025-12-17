/**
 * @file PlayerSprite.tsx
 * SVG-based player character sprite that can be used in HTML contexts.
 * Matches the pixel-art style of the canvas-based AssetPainter.drawPlayer().
 *
 * USED BY:
 * - ./Submap/SubmapTile.tsx (submap player position)
 * - Can be reused in other HTML-based game views
 */
import React from 'react';
import { TownDirection } from '../types/town';

interface PlayerSpriteProps {
    /** Direction the player is facing */
    facing?: TownDirection;
    /** Size of the sprite in pixels (default: 24) */
    size?: number;
    /** Whether the player is currently moving (for animation) */
    isMoving?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * SVG-based player sprite component.
 * Renders a small pixel-art humanoid figure.
 */
const PlayerSprite: React.FC<PlayerSpriteProps> = ({
    facing = 'south',
    size = 24,
    isMoving = false,
    className = '',
}) => {
    // Determine if we need to flip horizontally for east-facing directions
    const shouldFlip = facing === 'east' || facing === 'northeast' || facing === 'southeast';

    // Map facing to base direction for rendering
    const baseFacing = shouldFlip
        ? (facing === 'east' ? 'west' : facing === 'northeast' ? 'northwest' : 'southwest')
        : facing;

    // Check if facing north (back view)
    const isBackView = baseFacing === 'north' || baseFacing === 'northwest' || baseFacing === 'northeast';
    const isSideView = baseFacing === 'west';

    // Colors (matching AssetPainter)
    const skinColor = '#d4a574';
    const cloakColor = '#374151';
    const cloakHighlight = '#4b5563';
    const accentColor = '#f59e0b';
    const bootColor = '#1f2937';
    const hairColor = '#451a03';
    const eyeColor = '#1f2937';

    // Animation offset
    const bounceOffset = isMoving ? 'animate-bounce-subtle' : '';

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 28"
            className={`${className} ${bounceOffset}`}
            style={{
                transform: shouldFlip ? 'scaleX(-1)' : undefined,
                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))',
            }}
            aria-label={`Player character facing ${facing}`}
        >
            {/* Shadow */}
            <ellipse cx="12" cy="26" rx="6" ry="2" fill="rgba(0,0,0,0.3)" />

            {/* Legs */}
            <rect x="7" y="18" width="3" height="8" fill={bootColor} rx="1" />
            <rect x="14" y="18" width="3" height="8" fill={bootColor} rx="1" />

            {/* Body (Cloak) */}
            <rect x="6" y="8" width="12" height="12" fill={cloakColor} rx="2" />

            {/* Cloak highlight */}
            <rect x="7" y="9" width="2" height="10" fill={cloakHighlight} rx="1" />

            {/* Belt/accent */}
            <rect x="6" y="16" width="12" height="2" fill={accentColor} />

            {/* Head */}
            {isBackView ? (
                // Back view - show hair covering head
                <>
                    <circle cx="12" cy="6" r="5" fill={hairColor} />
                    <circle cx="12" cy="5" r="4" fill={skinColor} />
                </>
            ) : isSideView ? (
                // Side view
                <>
                    <circle cx="12" cy="5" r="5" fill={skinColor} />
                    {/* Hair on side */}
                    <ellipse cx="10" cy="3" rx="4" ry="3" fill={hairColor} />
                    {/* One eye visible */}
                    <rect x="9" y="4" width="1" height="2" fill={eyeColor} />
                </>
            ) : (
                // Front view (south-facing)
                <>
                    <circle cx="12" cy="5" r="5" fill={skinColor} />
                    {/* Hair tuft */}
                    <ellipse cx="12" cy="1" rx="4" ry="2" fill={hairColor} />
                    {/* Eyes */}
                    <rect x="9" y="4" width="1" height="2" fill={eyeColor} />
                    <rect x="14" y="4" width="1" height="2" fill={eyeColor} />
                </>
            )}

            {/* Arms */}
            {isBackView ? (
                // Back view - arms slightly visible at sides
                <>
                    <rect x="4" y="10" width="2" height="5" fill={skinColor} rx="1" />
                    <rect x="18" y="10" width="2" height="5" fill={skinColor} rx="1" />
                </>
            ) : isSideView ? (
                // Side view - one arm visible
                <rect x="17" y="10" width="2" height="6" fill={skinColor} rx="1" />
            ) : (
                // Front view - arms at sides
                <>
                    <rect x="3" y="10" width="2" height="6" fill={skinColor} rx="1" />
                    <rect x="19" y="10" width="2" height="6" fill={skinColor} rx="1" />
                </>
            )}
        </svg>
    );
};

export default PlayerSprite;
