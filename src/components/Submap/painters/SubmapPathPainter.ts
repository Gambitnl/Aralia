/**
 * @file src/components/Submap/painters/SubmapPathPainter.ts
 * Renders path-related visuals: quick travel paths, destinations, blocked indicators.
 */

import 'pixi.js/unsafe-eval'; // CSP patch
import * as PIXI from 'pixi.js';
import { TILE_SIZE } from './shared';

// ============================================================================
// Types
// ============================================================================

export interface PathPoint {
    x: number;
    y: number;
}

export interface PathRenderConfig {
    path: PathPoint[];
    destination: PathPoint | null;
    isDestinationBlocked: boolean;
    blockedTiles: Set<string>; // "x,y" format
    playerPosition: PathPoint;
}

// ============================================================================
// SubmapPathPainter Class
// ============================================================================

export class SubmapPathPainter {
    private pathContainer: PIXI.Container | null = null;
    private animationTime: number = 0;

    constructor() { }

    /**
     * Render the quick travel path and related visuals.
     */
    public renderPath(config: PathRenderConfig): PIXI.Container {
        this.pathContainer = new PIXI.Container();

        // Render blocked tile indicators
        config.blockedTiles.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const blocked = this.createBlockedIndicator(x, y);
            this.pathContainer!.addChild(blocked);
        });

        // Render path line
        if (config.path.length > 1) {
            const pathLine = this.createPathLine(config.path);
            this.pathContainer.addChild(pathLine);

            // Render path dots
            config.path.forEach((point, index) => {
                if (index === 0) return; // Skip player position
                const dot = this.createPathDot(point.x, point.y);
                this.pathContainer!.addChild(dot);
            });
        }

        // Render destination marker
        if (config.destination) {
            const marker = this.createDestinationMarker(
                config.destination.x,
                config.destination.y,
                config.isDestinationBlocked
            );
            this.pathContainer.addChild(marker);
        }

        return this.pathContainer;
    }

    /**
     * Update animation state.
     */
    public updateAnimation(delta: number): void {
        this.animationTime += delta * 0.016;
    }

    // ========================================================================
    // Path Visualization
    // ========================================================================

    private createPathLine(path: PathPoint[]): PIXI.Graphics {
        const graphics = new PIXI.Graphics();

        if (path.length < 2) return graphics;

        // Draw dashed line along path
        // PixiJS v8 uses stroke() method with options
        graphics.setStrokeStyle({ width: 2, color: 0xfbbf24, alpha: 0.6 });

        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];

            const fromX = from.x * TILE_SIZE + TILE_SIZE / 2;
            const fromY = from.y * TILE_SIZE + TILE_SIZE / 2;
            const toX = to.x * TILE_SIZE + TILE_SIZE / 2;
            const toY = to.y * TILE_SIZE + TILE_SIZE / 2;

            // Draw as dashed by creating segments
            const segments = 4;
            for (let s = 0; s < segments; s += 2) {
                const t1 = s / segments;
                const t2 = (s + 1) / segments;

                const x1 = fromX + (toX - fromX) * t1;
                const y1 = fromY + (toY - fromY) * t1;
                const x2 = fromX + (toX - fromX) * t2;
                const y2 = fromY + (toY - fromY) * t2;

                graphics.moveTo(x1, y1);
                graphics.lineTo(x2, y2);
            }
        }

        return graphics;
    }

    private createPathDot(x: number, y: number): PIXI.Graphics {
        const graphics = new PIXI.Graphics();

        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        // Outer glow
        graphics.beginFill(0xfbbf24, 0.3);
        graphics.drawCircle(px, py, 5);
        graphics.endFill();

        // Inner dot
        graphics.beginFill(0xffffff, 0.8);
        graphics.drawCircle(px, py, 2.5);
        graphics.endFill();

        return graphics;
    }

    private createDestinationMarker(x: number, y: number, isBlocked: boolean): PIXI.Container {
        const container = new PIXI.Container();
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;

        const color = isBlocked ? 0xef4444 : 0x22c55e;
        const pulseColor = isBlocked ? 0xfca5a5 : 0x86efac;

        // Pulsing ring (outer)
        const pulseRing = new PIXI.Graphics();
        pulseRing.lineStyle(2, pulseColor, 0.5);
        pulseRing.drawCircle(px, py, TILE_SIZE / 2 + 4);
        container.addChild(pulseRing);

        // Main ring
        const ring = new PIXI.Graphics();
        ring.lineStyle(3, color, 0.8);
        ring.drawCircle(px, py, TILE_SIZE / 2 - 2);
        container.addChild(ring);

        // Center marker
        const center = new PIXI.Graphics();
        center.beginFill(color, 0.6);
        center.drawCircle(px, py, 4);
        center.endFill();
        container.addChild(center);

        // X mark if blocked
        if (isBlocked) {
            const xMark = new PIXI.Graphics();
            xMark.lineStyle(3, 0xef4444, 0.9);
            xMark.moveTo(px - 6, py - 6);
            xMark.lineTo(px + 6, py + 6);
            xMark.moveTo(px + 6, py - 6);
            xMark.lineTo(px - 6, py + 6);
            container.addChild(xMark);
        } else {
            // Checkmark if valid
            const check = new PIXI.Graphics();
            check.lineStyle(2, 0x22c55e, 0.9);
            check.moveTo(px - 4, py);
            check.lineTo(px - 1, py + 3);
            check.lineTo(px + 5, py - 4);
            container.addChild(check);
        }

        return container;
    }

    private createBlockedIndicator(x: number, y: number): PIXI.Graphics {
        const graphics = new PIXI.Graphics();
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Red tint overlay
        graphics.beginFill(0x7f1d1d, 0.3);
        graphics.drawRect(px, py, TILE_SIZE, TILE_SIZE);
        graphics.endFill();

        // Diagonal stripes pattern (hazard-like)
        graphics.lineStyle(1, 0xef4444, 0.2);
        for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += 8) {
            graphics.moveTo(px + i, py);
            graphics.lineTo(px + i + TILE_SIZE, py + TILE_SIZE);
        }

        return graphics;
    }

    // ========================================================================
    // Animation Helpers
    // ========================================================================

    /**
     * Get pulse scale for destination marker animation.
     */
    public getPulseScale(): number {
        return 1 + Math.sin(this.animationTime * 4) * 0.1;
    }

    /**
     * Apply pulse animation to destination marker.
     */
    public applyPulseAnimation(container: PIXI.Container): void {
        const scale = this.getPulseScale();
        if (container.children[0]) {
            container.children[0].scale.set(scale);
        }
    }

    // ========================================================================
    // Hover Effect
    // ========================================================================

    /**
     * Create hover highlight for a tile.
     */
    public createHoverHighlight(x: number, y: number, isValid: boolean): PIXI.Graphics {
        const graphics = new PIXI.Graphics();
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        const color = isValid ? 0xffffff : 0xef4444;

        // Subtle fill
        graphics.beginFill(color, 0.1);
        graphics.drawRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        graphics.endFill();

        // Border
        graphics.lineStyle(1, color, 0.4);
        graphics.drawRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

        return graphics;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    public destroy(): void {
        this.pathContainer?.destroy({ children: true });
        this.pathContainer = null;
    }
}
