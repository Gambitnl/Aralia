/**
 * @file src/components/Submap/painters/SubmapFeaturePainter.ts
 * Paints seeded features (ponds, villages, thickets) for the submap.
 * These are larger structured features that span multiple tiles.
 */

import 'pixi.js/unsafe-eval'; // CSP patch
import * as PIXI from 'pixi.js';
import {
    TILE_SIZE,
    getBiomePalette,
    simpleHash,
    noise2D,
    lerpColor,
    rgbToHex,
    adjustBrightness,
    type RGB,
} from './shared';
import type { SeededFeatureConfig } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface FeatureRenderData {
    config: SeededFeatureConfig;
    centerX: number;
    centerY: number;
    actualSize: number;
    biomeId: string;
}

// ============================================================================
// SubmapFeaturePainter Class
// ============================================================================

export class SubmapFeaturePainter {
    constructor() { }

    /**
     * Render a seeded feature to a PIXI container.
     */
    public renderFeature(data: FeatureRenderData, container: PIXI.Container): void {
        const { config, centerX, centerY, actualSize, biomeId } = data;

        switch (config.id) {
            case 'pond':
            case 'murky_pool':
            case 'oasis':
                this.drawWaterFeature(container, data);
                break;

            case 'village':
                this.drawVillage(container, data);
                break;

            case 'dense_thicket':
            case 'small_forest_patch':
            case 'small_copse':
                this.drawThicket(container, data);
                break;

            case 'rock_outcrop':
            case 'scattered_boulders':
            case 'boulder_field':
                this.drawRockFormation(container, data);
                break;

            case 'ancient_stone_circle':
            case 'lone_monolith':
                this.drawStoneMonument(container, data);
                break;

            case 'snow_patch':
                this.drawSnowPatch(container, data);
                break;

            case 'mineral_vein':
            case 'geothermal_vent':
                this.drawMineralFeature(container, data);
                break;

            case 'wildflower_patch':
                this.drawFlowerPatch(container, data);
                break;

            case 'dense_reeds':
                this.drawReedBed(container, data);
                break;

            case 'sunken_ruin_fragment':
            case 'nomad_campsite_remains':
                this.drawRuins(container, data);
                break;

            case 'small_island':
                this.drawIsland(container, data);
                break;

            case 'kelp_forest':
            case 'coral_reef':
                this.drawUnderwaterFeature(container, data);
                break;

            case 'rocky_mesa':
            case 'sand_dunes':
                this.drawDesertFeature(container, data);
                break;

            case 'glowing_mushroom_grove':
            case 'ancient_burial_mound':
                this.drawMysticalFeature(container, data);
                break;

            default:
                this.drawGenericFeature(container, data);
        }
    }

    // ========================================================================
    // Feature Drawing Methods
    // ========================================================================

    private drawWaterFeature(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, biomeId } = data;
        const palette = getBiomePalette(biomeId);

        const px = centerX * TILE_SIZE;
        const py = centerY * TILE_SIZE;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        // Water body
        const water = new PIXI.Graphics();

        // Outer shore gradient
        water.beginFill(rgbToHex(adjustBrightness(palette.water, 0.7)), 0.4);
        water.drawEllipse(px + TILE_SIZE / 2, py + TILE_SIZE / 2, radius + 4, radius * 0.7 + 4);
        water.endFill();

        // Main water
        water.beginFill(rgbToHex(palette.water), 0.8);
        water.drawEllipse(px + TILE_SIZE / 2, py + TILE_SIZE / 2, radius, radius * 0.7);
        water.endFill();

        // Deeper center
        water.beginFill(rgbToHex(palette.waterDeep), 0.6);
        water.drawEllipse(px + TILE_SIZE / 2, py + TILE_SIZE / 2, radius * 0.5, radius * 0.35);
        water.endFill();

        // Highlight
        water.beginFill(0xffffff, 0.15);
        water.drawEllipse(px + TILE_SIZE / 2 - radius * 0.2, py + TILE_SIZE / 2 - radius * 0.2, radius * 0.3, radius * 0.15);
        water.endFill();

        container.addChild(water);

        // Add lily pads or reeds based on biome
        if (biomeId === 'swamp' || biomeId === 'forest') {
            this.addLilyPads(container, px, py, radius, 3 + actualSize);
        }
    }

    private addLilyPads(container: PIXI.Container, px: number, py: number, radius: number, count: number): void {
        for (let i = 0; i < count; i++) {
            const angle = simpleHash(i, 0, 100) * Math.PI * 2;
            const dist = simpleHash(i, 1, 101) * radius * 0.6;

            const lilyX = px + TILE_SIZE / 2 + Math.cos(angle) * dist;
            const lilyY = py + TILE_SIZE / 2 + Math.sin(angle) * dist * 0.7;

            const lily = new PIXI.Graphics();
            lily.beginFill(0x15803d, 0.8);
            lily.drawCircle(lilyX, lilyY, 3 + simpleHash(i, 2, 102) * 2);
            lily.endFill();

            // Lily pad notch
            lily.beginFill(rgbToHex({ r: 56, g: 120, b: 180 }), 0.8);
            lily.moveTo(lilyX, lilyY);
            lily.lineTo(lilyX + 3, lilyY - 2);
            lily.lineTo(lilyX + 3, lilyY + 2);
            lily.closePath();
            lily.endFill();

            container.addChild(lily);
        }
    }

    private drawVillage(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, biomeId } = data;

        const px = centerX * TILE_SIZE;
        const py = centerY * TILE_SIZE;
        const size = (actualSize * 2 + 1) * TILE_SIZE;

        // Village ground (packed earth)
        const ground = new PIXI.Graphics();
        ground.beginFill(0x9ca3af, 0.4);
        ground.drawRect(px - actualSize * TILE_SIZE, py - actualSize * TILE_SIZE, size, size);
        ground.endFill();

        container.addChild(ground);

        // Draw small building hints
        const buildingCount = 2 + actualSize;
        for (let i = 0; i < buildingCount; i++) {
            const bx = px + (simpleHash(i, 0, 200) - 0.5) * size * 0.7;
            const by = py + (simpleHash(i, 1, 201) - 0.5) * size * 0.7;

            const building = new PIXI.Graphics();

            // Building base
            const bWidth = 8 + simpleHash(i, 2, 202) * 6;
            const bHeight = 6 + simpleHash(i, 3, 203) * 4;

            building.beginFill(0x78716c, 0.8);
            building.drawRect(bx - bWidth / 2, by - bHeight / 2, bWidth, bHeight);
            building.endFill();

            // Roof
            const roofColors = [0x92400e, 0x7c2d12, 0x713f12];
            building.beginFill(roofColors[i % roofColors.length], 0.9);
            building.moveTo(bx - bWidth / 2 - 2, by - bHeight / 2);
            building.lineTo(bx, by - bHeight / 2 - 5);
            building.lineTo(bx + bWidth / 2 + 2, by - bHeight / 2);
            building.closePath();
            building.endFill();

            container.addChild(building);
        }

        // Central plaza marker
        const plaza = new PIXI.Graphics();
        plaza.beginFill(0xd4d4d8, 0.5);
        plaza.drawCircle(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 6);
        plaza.endFill();
        container.addChild(plaza);
    }

    private drawThicket(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, biomeId } = data;
        const palette = getBiomePalette(biomeId);

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;

        // Dense foliage mass - individual trees
        const treeCount = 4 + actualSize * 2;
        for (let i = 0; i < treeCount; i++) {
            const angle = simpleHash(i, 0, 300) * Math.PI * 2;
            const dist = simpleHash(i, 1, 301) * actualSize * TILE_SIZE;

            const tx = px + Math.cos(angle) * dist;
            const ty = py + Math.sin(angle) * dist;

            const tree = new PIXI.Graphics();

            // Subtle shadow (reduced alpha)
            tree.beginFill(0x000000, 0.1);
            tree.drawEllipse(tx, ty + 4, 6, 3);
            tree.endFill();

            // Foliage
            const greenVariant = adjustBrightness(palette.grass, 0.7 + simpleHash(i, 2, 302) * 0.4);
            tree.beginFill(rgbToHex(greenVariant), 0.9);
            tree.drawCircle(tx, ty - 4, 6 + simpleHash(i, 3, 303) * 4);
            tree.endFill();

            container.addChild(tree);
        }
        // NOTE: Removed central dense area fill to avoid dark blob rendering
    }

    private drawRockFormation(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, biomeId } = data;
        const palette = getBiomePalette(biomeId);

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;

        const rockCount = 3 + actualSize * 2;
        for (let i = 0; i < rockCount; i++) {
            const angle = simpleHash(i, 0, 400) * Math.PI * 2;
            const dist = simpleHash(i, 1, 401) * actualSize * TILE_SIZE * 0.8;

            const rx = px + Math.cos(angle) * dist;
            const ry = py + Math.sin(angle) * dist;
            const size = 4 + simpleHash(i, 2, 402) * 8;

            const rock = new PIXI.Graphics();

            // Shadow
            rock.beginFill(0x000000, 0.2);
            rock.drawEllipse(rx + 2, ry + size * 0.3, size * 0.8, size * 0.3);
            rock.endFill();

            // Rock body
            const brightness = 0.8 + simpleHash(i, 3, 403) * 0.4;
            rock.beginFill(rgbToHex(adjustBrightness(palette.rock, brightness)));
            rock.moveTo(rx - size * 0.5, ry);
            rock.lineTo(rx - size * 0.3, ry - size * 0.6);
            rock.lineTo(rx + size * 0.3, ry - size * 0.7);
            rock.lineTo(rx + size * 0.5, ry - size * 0.2);
            rock.lineTo(rx + size * 0.4, ry + size * 0.2);
            rock.lineTo(rx - size * 0.4, ry + size * 0.2);
            rock.closePath();
            rock.endFill();

            // Highlight
            rock.beginFill(0xffffff, 0.2);
            rock.moveTo(rx - size * 0.2, ry - size * 0.5);
            rock.lineTo(rx, ry - size * 0.3);
            rock.lineTo(rx + size * 0.1, ry - size * 0.5);
            rock.closePath();
            rock.endFill();

            container.addChild(rock);
        }
    }

    private drawStoneMonument(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;

        // Ground marking
        const ground = new PIXI.Graphics();
        ground.beginFill(0x6b7280, 0.3);
        ground.drawCircle(px, py, actualSize * TILE_SIZE + 8);
        ground.endFill();
        container.addChild(ground);

        // Standing stones
        const stoneCount = data.config.id === 'ancient_stone_circle' ? 5 : 1;
        for (let i = 0; i < stoneCount; i++) {
            const angle = (i / stoneCount) * Math.PI * 2;
            const dist = stoneCount > 1 ? actualSize * TILE_SIZE * 0.6 : 0;

            const sx = px + Math.cos(angle) * dist;
            const sy = py + Math.sin(angle) * dist;

            const stone = new PIXI.Graphics();

            // Shadow
            stone.beginFill(0x000000, 0.3);
            stone.drawEllipse(sx + 2, sy + 8, 6, 3);
            stone.endFill();

            // Stone
            stone.beginFill(0x6b7280);
            stone.moveTo(sx - 5, sy + 6);
            stone.lineTo(sx - 4, sy - 10);
            stone.lineTo(sx, sy - 14);
            stone.lineTo(sx + 4, sy - 10);
            stone.lineTo(sx + 5, sy + 6);
            stone.closePath();
            stone.endFill();

            // Moss/lichen
            stone.beginFill(0x3f6212, 0.5);
            stone.drawCircle(sx - 2, sy - 4, 2);
            stone.drawCircle(sx + 1, sy - 2, 1.5);
            stone.endFill();

            container.addChild(stone);
        }
    }

    private drawSnowPatch(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        const snow = new PIXI.Graphics();

        // Outer edge (thin snow)
        snow.beginFill(0xe2e8f0, 0.5);
        snow.drawEllipse(px, py, radius + 6, radius * 0.7 + 6);
        snow.endFill();

        // Main snow
        snow.beginFill(0xf1f5f9, 0.85);
        snow.drawEllipse(px, py, radius, radius * 0.7);
        snow.endFill();

        // Deep snow center
        snow.beginFill(0xffffff, 0.9);
        snow.drawEllipse(px, py, radius * 0.4, radius * 0.3);
        snow.endFill();

        container.addChild(snow);

        // Sparkles
        for (let i = 0; i < 5; i++) {
            const sx = px + (simpleHash(i, 0, 500) - 0.5) * radius * 1.5;
            const sy = py + (simpleHash(i, 1, 501) - 0.5) * radius;

            const sparkle = new PIXI.Graphics();
            sparkle.beginFill(0xffffff, 0.8);
            sparkle.drawCircle(sx, sy, 1);
            sparkle.endFill();
            container.addChild(sparkle);
        }
    }

    private drawMineralFeature(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, config } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;

        if (config.id === 'geothermal_vent') {
            // Steam vent
            const vent = new PIXI.Graphics();
            vent.beginFill(0x7f1d1d, 0.6);
            vent.drawCircle(px, py, 8);
            vent.endFill();

            vent.beginFill(0xef4444, 0.4);
            vent.drawCircle(px, py, 4);
            vent.endFill();

            container.addChild(vent);

            // Steam particles (static representation)
            for (let i = 0; i < 4; i++) {
                const steam = new PIXI.Graphics();
                const sy = py - 6 - i * 4;
                const sx = px + (simpleHash(i, 0, 600) - 0.5) * 6;
                steam.beginFill(0xffffff, 0.3 - i * 0.06);
                steam.drawCircle(sx, sy, 3 + i);
                steam.endFill();
                container.addChild(steam);
            }
        } else {
            // Mineral vein
            const vein = new PIXI.Graphics();
            vein.beginFill(0x9ca3af, 0.5);
            vein.drawEllipse(px, py, 10, 6);
            vein.endFill();

            // Crystal/ore spots
            const colors = [0xfbbf24, 0x22d3ee, 0xa855f7];
            for (let i = 0; i < 4; i++) {
                const mx = px + (simpleHash(i, 0, 610) - 0.5) * 14;
                const my = py + (simpleHash(i, 1, 611) - 0.5) * 8;

                vein.beginFill(colors[i % colors.length], 0.8);
                vein.drawCircle(mx, my, 2 + simpleHash(i, 2, 612) * 2);
                vein.endFill();
            }

            container.addChild(vein);
        }
    }

    private drawFlowerPatch(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        // Flower bed ground
        const ground = new PIXI.Graphics();
        ground.beginFill(0x84cc16, 0.3);
        ground.drawEllipse(px, py, radius, radius * 0.7);
        ground.endFill();
        container.addChild(ground);

        // Flowers
        const flowerColors = [0xf472b6, 0xfbbf24, 0x60a5fa, 0xf87171, 0xa78bfa];
        const flowerCount = 8 + actualSize * 4;

        for (let i = 0; i < flowerCount; i++) {
            const angle = simpleHash(i, 0, 700) * Math.PI * 2;
            const dist = simpleHash(i, 1, 701) * radius * 0.9;

            const fx = px + Math.cos(angle) * dist;
            const fy = py + Math.sin(angle) * dist * 0.7;

            const flower = new PIXI.Graphics();
            flower.beginFill(flowerColors[i % flowerColors.length], 0.9);
            flower.drawCircle(fx, fy, 2 + simpleHash(i, 2, 702));
            flower.endFill();

            container.addChild(flower);
        }
    }

    private drawReedBed(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, biomeId } = data;
        const palette = getBiomePalette(biomeId);

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        // Muddy base
        const mud = new PIXI.Graphics();
        mud.beginFill(rgbToHex(adjustBrightness(palette.dirt, 0.6)), 0.5);
        mud.drawEllipse(px, py, radius, radius * 0.6);
        mud.endFill();
        container.addChild(mud);

        // Reeds
        const reedCount = 10 + actualSize * 5;
        for (let i = 0; i < reedCount; i++) {
            const angle = simpleHash(i, 0, 800) * Math.PI * 2;
            const dist = simpleHash(i, 1, 801) * radius * 0.8;

            const rx = px + Math.cos(angle) * dist;
            const ry = py + Math.sin(angle) * dist * 0.6;
            const height = 8 + simpleHash(i, 2, 802) * 8;

            const reed = new PIXI.Graphics();
            reed.lineStyle(1.5, 0x365314);
            reed.moveTo(rx, ry);
            reed.lineTo(rx + (simpleHash(i, 3, 803) - 0.5) * 3, ry - height);

            // Seed head
            reed.beginFill(0x713f12);
            reed.drawEllipse(rx + (simpleHash(i, 3, 803) - 0.5) * 3, ry - height - 2, 1.5, 3);
            reed.endFill();

            container.addChild(reed);
        }
    }

    private drawRuins(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, config } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;

        // Debris field
        const debris = new PIXI.Graphics();
        debris.beginFill(0x78716c, 0.4);
        debris.drawEllipse(px, py, 12, 8);
        debris.endFill();
        container.addChild(debris);

        // Ruined structures
        const pieceCount = 3 + actualSize;
        for (let i = 0; i < pieceCount; i++) {
            const sx = px + (simpleHash(i, 0, 900) - 0.5) * 20;
            const sy = py + (simpleHash(i, 1, 901) - 0.5) * 12;

            const piece = new PIXI.Graphics();

            if (i % 2 === 0) {
                // Standing wall fragment
                piece.beginFill(0x6b7280, 0.8);
                piece.drawRect(sx - 3, sy - 8, 6, 10);
                piece.endFill();
            } else {
                // Fallen block
                piece.beginFill(0x9ca3af, 0.7);
                piece.drawRect(sx - 4, sy - 2, 8, 4);
                piece.endFill();
            }

            container.addChild(piece);
        }
    }

    private drawIsland(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        // Beach ring
        const beach = new PIXI.Graphics();
        beach.beginFill(0xfde68a, 0.8);
        beach.drawEllipse(px, py, radius + 4, radius * 0.7 + 4);
        beach.endFill();
        container.addChild(beach);

        // Grass interior
        const grass = new PIXI.Graphics();
        grass.beginFill(0x22c55e, 0.8);
        grass.drawEllipse(px, py, radius - 2, radius * 0.6 - 2);
        grass.endFill();
        container.addChild(grass);

        // Palm trees
        for (let i = 0; i < 2; i++) {
            const tx = px + (i === 0 ? -4 : 4);
            const ty = py - 2;

            const palm = new PIXI.Graphics();

            // Trunk
            palm.lineStyle(3, 0xa16207);
            palm.moveTo(tx, ty + 6);
            palm.quadraticCurveTo(tx + 2, ty, tx - 1, ty - 8);

            // Fronds
            palm.lineStyle(2, 0x15803d);
            for (let j = 0; j < 4; j++) {
                const fAngle = -Math.PI / 2 + (j - 1.5) * 0.5;
                palm.moveTo(tx - 1, ty - 8);
                palm.lineTo(tx - 1 + Math.cos(fAngle) * 8, ty - 8 + Math.sin(fAngle) * 8);
            }

            container.addChild(palm);
        }
    }

    private drawUnderwaterFeature(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, config } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        if (config.id === 'coral_reef') {
            // Coral formations
            const coralColors = [0xf472b6, 0xfb923c, 0xa855f7, 0x22d3ee];
            for (let i = 0; i < 6 + actualSize * 2; i++) {
                const angle = simpleHash(i, 0, 1000) * Math.PI * 2;
                const dist = simpleHash(i, 1, 1001) * radius * 0.8;

                const cx = px + Math.cos(angle) * dist;
                const cy = py + Math.sin(angle) * dist * 0.7;

                const coral = new PIXI.Graphics();
                coral.beginFill(coralColors[i % coralColors.length], 0.7);
                coral.drawCircle(cx, cy, 3 + simpleHash(i, 2, 1002) * 3);
                coral.endFill();

                container.addChild(coral);
            }
        } else {
            // Kelp forest
            for (let i = 0; i < 5 + actualSize * 2; i++) {
                const kx = px + (simpleHash(i, 0, 1010) - 0.5) * radius * 1.5;
                const ky = py + (simpleHash(i, 1, 1011) - 0.5) * radius;

                const kelp = new PIXI.Graphics();
                kelp.lineStyle(2, 0x166534, 0.7);
                kelp.moveTo(kx, ky + 8);

                // Wavy kelp strand
                const height = 12 + simpleHash(i, 2, 1012) * 8;
                for (let j = 0; j < 4; j++) {
                    const wave = Math.sin(j * 1.5) * 3;
                    kelp.lineTo(kx + wave, ky + 8 - (j + 1) * (height / 4));
                }

                container.addChild(kelp);
            }
        }
    }

    private drawDesertFeature(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, config } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        if (config.id === 'rocky_mesa') {
            // Mesa formation
            const mesa = new PIXI.Graphics();

            // Base shadow
            mesa.beginFill(0x000000, 0.2);
            mesa.drawEllipse(px + 4, py + radius * 0.4 + 4, radius, radius * 0.4);
            mesa.endFill();

            // Mesa body
            mesa.beginFill(0xc08457, 0.9);
            mesa.moveTo(px - radius, py + radius * 0.3);
            mesa.lineTo(px - radius * 0.8, py - radius * 0.5);
            mesa.lineTo(px + radius * 0.8, py - radius * 0.5);
            mesa.lineTo(px + radius, py + radius * 0.3);
            mesa.closePath();
            mesa.endFill();

            // Top plateau
            mesa.beginFill(0xd97706, 0.8);
            mesa.drawEllipse(px, py - radius * 0.5, radius * 0.7, radius * 0.2);
            mesa.endFill();

            container.addChild(mesa);
        } else {
            // Sand dunes
            const dune = new PIXI.Graphics();

            for (let i = 0; i < 3; i++) {
                const dx = px + (i - 1) * radius * 0.6;
                const dy = py + (i % 2) * 4;
                const dRadius = radius * (0.6 + i * 0.15);

                dune.beginFill(0xfde68a, 0.6 - i * 0.1);
                dune.moveTo(dx - dRadius, dy);
                dune.quadraticCurveTo(dx, dy - dRadius * 0.4, dx + dRadius, dy);
                dune.closePath();
                dune.endFill();
            }

            container.addChild(dune);
        }
    }

    private drawMysticalFeature(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, config } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        if (config.id === 'glowing_mushroom_grove') {
            // Mystical ground glow
            const glow = new PIXI.Graphics();
            glow.beginFill(0xa855f7, 0.2);
            glow.drawCircle(px, py, radius + 8);
            glow.endFill();
            container.addChild(glow);

            // Glowing mushrooms
            for (let i = 0; i < 5 + actualSize * 2; i++) {
                const angle = simpleHash(i, 0, 1100) * Math.PI * 2;
                const dist = simpleHash(i, 1, 1101) * radius * 0.8;

                const mx = px + Math.cos(angle) * dist;
                const my = py + Math.sin(angle) * dist * 0.7;

                const mushroom = new PIXI.Graphics();

                // Stalk
                mushroom.beginFill(0xe5e5e5, 0.9);
                mushroom.drawRect(mx - 1.5, my - 4, 3, 6);
                mushroom.endFill();

                // Cap with glow
                mushroom.beginFill(0xc084fc, 0.8);
                mushroom.drawCircle(mx, my - 6, 4);
                mushroom.endFill();

                // Glow effect
                mushroom.beginFill(0xd8b4fe, 0.3);
                mushroom.drawCircle(mx, my - 6, 6);
                mushroom.endFill();

                container.addChild(mushroom);
            }
        } else {
            // Burial mound
            const mound = new PIXI.Graphics();

            // Mound shape
            mound.beginFill(0x65a30d, 0.7);
            mound.moveTo(px - radius, py);
            mound.quadraticCurveTo(px, py - radius * 0.6, px + radius, py);
            mound.closePath();
            mound.endFill();

            // Standing stone
            mound.beginFill(0x6b7280, 0.9);
            mound.moveTo(px - 3, py - radius * 0.3);
            mound.lineTo(px - 2, py - radius * 0.3 - 10);
            mound.lineTo(px + 2, py - radius * 0.3 - 10);
            mound.lineTo(px + 3, py - radius * 0.3);
            mound.closePath();
            mound.endFill();

            container.addChild(mound);
        }
    }

    private drawGenericFeature(container: PIXI.Container, data: FeatureRenderData): void {
        const { centerX, centerY, actualSize, config } = data;

        const px = centerX * TILE_SIZE + TILE_SIZE / 2;
        const py = centerY * TILE_SIZE + TILE_SIZE / 2;
        const radius = (actualSize + 0.5) * TILE_SIZE;

        // Generic circular highlight
        const highlight = new PIXI.Graphics();
        highlight.lineStyle(2, 0xfbbf24, 0.6);

        if (config.shapeType === 'rectangular') {
            highlight.drawRect(
                px - radius,
                py - radius,
                radius * 2,
                radius * 2
            );
        } else {
            highlight.drawCircle(px, py, radius);
        }

        container.addChild(highlight);

        // Center marker
        const center = new PIXI.Graphics();
        center.beginFill(0xfbbf24, 0.5);
        center.drawCircle(px, py, 4);
        center.endFill();
        container.addChild(center);
    }
}
