/**
 * @file src/components/Submap/painters/SubmapPlayerPainter.ts
 * Renders the player marker on the submap.
 */

import 'pixi.js/unsafe-eval'; // CSP patch
import * as PIXI from 'pixi.js';
import { TILE_SIZE } from './shared';

// ============================================================================
// Types
// ============================================================================

export type FacingDirection = 'north' | 'south' | 'east' | 'west';

export interface PlayerRenderConfig {
    x: number;
    y: number;
    facing: FacingDirection;
    isMoving?: boolean;
}

// ============================================================================
// SubmapPlayerPainter Class
// ============================================================================

export class SubmapPlayerPainter {
    private playerContainer: PIXI.Container | null = null;
    private animationTime: number = 0;

    constructor() { }

    /**
     * Render the player marker.
     */
    public renderPlayer(config: PlayerRenderConfig): PIXI.Container {
        this.playerContainer = new PIXI.Container();

        const px = config.x * TILE_SIZE + TILE_SIZE / 2;
        const py = config.y * TILE_SIZE + TILE_SIZE / 2;

        // Shadow
        const shadow = this.createShadow(px, py);
        this.playerContainer.addChild(shadow);

        // Player body
        const body = this.createPlayerBody(px, py, config.facing);
        this.playerContainer.addChild(body);

        // Direction indicator
        const indicator = this.createDirectionIndicator(px, py, config.facing);
        this.playerContainer.addChild(indicator);

        // Selection ring (always visible for player)
        const ring = this.createSelectionRing(px, py);
        this.playerContainer.addChild(ring);

        return this.playerContainer;
    }

    /**
     * Update animation state.
     */
    public updateAnimation(delta: number): void {
        this.animationTime += delta * 0.016;
    }

    // ========================================================================
    // Player Components
    // ========================================================================

    private createShadow(px: number, py: number): PIXI.Graphics {
        const shadow = new PIXI.Graphics();

        shadow.beginFill(0x000000, 0.3);
        shadow.drawEllipse(px, py + 4, 8, 4);
        shadow.endFill();

        return shadow;
    }

    private createPlayerBody(px: number, py: number, facing: FacingDirection): PIXI.Container {
        const container = new PIXI.Container();

        // Body (simple humanoid shape)
        const body = new PIXI.Graphics();

        // Torso
        body.beginFill(0x3b82f6); // Blue shirt
        body.drawRect(px - 5, py - 8, 10, 10);
        body.endFill();

        // Head
        body.beginFill(0xfcd34d); // Skin tone
        body.drawCircle(px, py - 12, 5);
        body.endFill();

        // Hair (direction-dependent)
        body.beginFill(0x451a03);
        switch (facing) {
            case 'south':
                body.drawRect(px - 4, py - 16, 8, 3);
                break;
            case 'north':
                body.drawRect(px - 4, py - 16, 8, 5);
                break;
            case 'east':
                body.drawRect(px - 3, py - 16, 7, 4);
                break;
            case 'west':
                body.drawRect(px - 4, py - 16, 7, 4);
                break;
        }
        body.endFill();

        // Eyes (only visible from south)
        if (facing === 'south') {
            body.beginFill(0x000000);
            body.drawCircle(px - 2, py - 12, 1);
            body.drawCircle(px + 2, py - 12, 1);
            body.endFill();
        }

        // Legs
        body.beginFill(0x713f12);
        body.drawRect(px - 4, py + 2, 3, 5);
        body.drawRect(px + 1, py + 2, 3, 5);
        body.endFill();

        container.addChild(body);
        return container;
    }

    private createDirectionIndicator(px: number, py: number, facing: FacingDirection): PIXI.Graphics {
        const indicator = new PIXI.Graphics();

        // Small arrow showing facing direction
        indicator.beginFill(0xfbbf24, 0.8);

        const arrowSize = 4;
        let dx = 0;
        let dy = 0;

        switch (facing) {
            case 'north':
                dy = -TILE_SIZE / 2 - arrowSize;
                indicator.moveTo(px, py + dy);
                indicator.lineTo(px - arrowSize, py + dy + arrowSize);
                indicator.lineTo(px + arrowSize, py + dy + arrowSize);
                break;
            case 'south':
                dy = TILE_SIZE / 2 + arrowSize;
                indicator.moveTo(px, py + dy);
                indicator.lineTo(px - arrowSize, py + dy - arrowSize);
                indicator.lineTo(px + arrowSize, py + dy - arrowSize);
                break;
            case 'east':
                dx = TILE_SIZE / 2 + arrowSize;
                indicator.moveTo(px + dx, py);
                indicator.lineTo(px + dx - arrowSize, py - arrowSize);
                indicator.lineTo(px + dx - arrowSize, py + arrowSize);
                break;
            case 'west':
                dx = -TILE_SIZE / 2 - arrowSize;
                indicator.moveTo(px + dx, py);
                indicator.lineTo(px + dx + arrowSize, py - arrowSize);
                indicator.lineTo(px + dx + arrowSize, py + arrowSize);
                break;
        }

        indicator.closePath();
        indicator.endFill();

        return indicator;
    }

    private createSelectionRing(px: number, py: number): PIXI.Graphics {
        const ring = new PIXI.Graphics();

        // Animated selection ring
        ring.lineStyle(2, 0x22c55e, 0.6);
        ring.drawCircle(px, py, TILE_SIZE / 2 + 2);

        // Inner glow
        ring.lineStyle(1, 0x86efac, 0.4);
        ring.drawCircle(px, py, TILE_SIZE / 2 - 2);

        return ring;
    }

    // ========================================================================
    // Animation Helpers
    // ========================================================================

    /**
     * Get breathing animation offset.
     */
    public getBreathingOffset(): number {
        return Math.sin(this.animationTime * 2) * 0.5;
    }

    /**
     * Apply breathing animation to player container.
     */
    public applyBreathingAnimation(): void {
        if (!this.playerContainer) return;

        const offset = this.getBreathingOffset();
        // Apply subtle vertical offset to body (child index 1)
        const body = this.playerContainer.children[1];
        if (body) {
            body.y = offset;
        }
    }

    /**
     * Get walking bob animation offset.
     */
    public getWalkingBob(): number {
        return Math.abs(Math.sin(this.animationTime * 8)) * 2;
    }

    // ========================================================================
    // Update Position
    // ========================================================================

    /**
     * Update player position smoothly.
     */
    public updatePosition(x: number, y: number, immediate: boolean = false): void {
        if (!this.playerContainer) return;

        const targetX = x * TILE_SIZE + TILE_SIZE / 2;
        const targetY = y * TILE_SIZE + TILE_SIZE / 2;

        if (immediate) {
            this.playerContainer.x = targetX - TILE_SIZE / 2;
            this.playerContainer.y = targetY - TILE_SIZE / 2;
        } else {
            // Could add tweening here for smooth movement
            this.playerContainer.x = targetX - TILE_SIZE / 2;
            this.playerContainer.y = targetY - TILE_SIZE / 2;
        }
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    public destroy(): void {
        this.playerContainer?.destroy({ children: true });
        this.playerContainer = null;
    }
}
