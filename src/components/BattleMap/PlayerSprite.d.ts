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
import { TownDirection } from '../../types/town';
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
declare const PlayerSprite: React.FC<PlayerSpriteProps>;
export default PlayerSprite;
