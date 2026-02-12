// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 11/02/2026, 16:30:44
 * Dependents: Minimap.tsx, SubmapPane.tsx, useSubmapGrid.ts
 * Imports: 3 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file submapVisuals.ts
 * Contains helper functions and logic for rendering submap tiles and handling visuals
 * for SubmapPane.
 */
import React from 'react';
import { SeededFeatureConfig, BiomeVisuals } from '../../types';
import { PathDetails } from '../../hooks/useSubmapProceduralData';
// TODO(lint-intent): 'CaTileType' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { CaTileType as _CaTileType } from '../../services/cellularAutomataService';

// Utility: normalize CSS color strings (hex or rgb/rgba) into Pixi-friendly hex numbers so palettes stay consistent.
export const cssColorToHex = (color: string | undefined | null): number | null => {
    if (!color) return null;
    const trimmed = color.trim();
    if (trimmed.startsWith('#')) {
        const hex = trimmed.slice(1);
        if (hex.length === 3) {
            const expanded = hex.split('').map((c) => c + c).join('');
            return Number.parseInt(expanded, 16);
        }
        if (hex.length >= 6) {
            return Number.parseInt(hex.slice(0, 6), 16);
        }
    }

    const rgbaMatch = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i);
    if (rgbaMatch) {
        const [, r, g, b] = rgbaMatch;
        return (Number.parseInt(r, 10) << 16) + (Number.parseInt(g, 10) << 8) + Number.parseInt(b, 10);
    }

    return null;
};

// --- Visual Layer Functions ---
export interface VisualLayerOutput {
    style: React.CSSProperties;
    content: React.ReactNode;
    animationClass: string;
    isResource: boolean;
    effectiveTerrainType: string;
    zIndex: number;
    activeSeededFeatureConfigForTile: SeededFeatureConfig | null;
    // TODO: isSeedTile is currently only used for seeded features. If paths or CA tiles need
    // center identification, consider generalizing to `centerTileOf?: string`.
    isSeedTile: boolean;
}

export const getAnimationClass = (icon: string | null | undefined): string => {
    if (!icon) return '';
    if (['💧', '🌊', '🐟', '🐙', '🐡', '🐬'].includes(icon)) return 'animate-shimmer';
    if (['🌲', '🌳', '🌿', '🌴'].includes(icon)) return 'animate-sway';
    if (['✨', '🍄', '💎', '♨️', '⭐', '🕯️'].includes(icon)) return 'animate-subtle-pulse';
    return '';
};

export const getIsResource = (icon: string | null | undefined): boolean => {
    if (!icon) return false;
    return ['🌲', '🌳', '🪨', '💎', '🍄', '🌿'].includes(icon);
};

export function getBaseVisuals(
    rowIndex: number,
    colIndex: number,
    tileHash: number,
    visualsConfig: BiomeVisuals
): VisualLayerOutput {
    return {
        style: {
            backgroundColor: visualsConfig.baseColors[tileHash % visualsConfig.baseColors.length],
        },
        content: null,
        animationClass: '',
        isResource: false,
        effectiveTerrainType: 'default',
        zIndex: 0,
        activeSeededFeatureConfigForTile: null,
        isSeedTile: false,
    };
}

export function applyPathVisuals(
    currentVisuals: VisualLayerOutput,
    rowIndex: number,
    colIndex: number,
    pathDetails: PathDetails,
    visualsConfig: BiomeVisuals,
    tileHash: number
): VisualLayerOutput {
    const newVisuals = { ...currentVisuals };
    const currentTileCoordString = `${colIndex},${rowIndex}`;
    const riverCoords = pathDetails.riverCoords ?? new Set<string>();
    const riverBankCoords = pathDetails.riverBankCoords ?? new Set<string>();
    const cliffCoords = pathDetails.cliffCoords ?? new Set<string>();
    const cliffAdjacencyCoords = pathDetails.cliffAdjacencyCoords ?? new Set<string>();

    if (riverCoords.has(currentTileCoordString)) {
        const riverZ = 0.8;
        if (newVisuals.zIndex < riverZ) {
            const waterColor = visualsConfig.seededFeatures?.find(
                (feature) => feature.generatesEffectiveTerrainType === 'water'
            )?.color ?? 'rgba(33, 105, 170, 0.85)';
            newVisuals.style.backgroundColor = waterColor;
            newVisuals.content = tileHash % 5 === 0
                ? React.createElement("span", { role: "img", "aria-label": "river current" }, "💧")
                : null;
            newVisuals.zIndex = riverZ;
            newVisuals.effectiveTerrainType = 'water';
        }
    } else if (riverBankCoords.has(currentTileCoordString)) {
        const riverBankZ = 0.45;
        if (newVisuals.zIndex < riverBankZ) {
            const bankColor = 'rgba(83, 126, 96, 0.7)';
            newVisuals.style.backgroundColor = bankColor;
            newVisuals.zIndex = riverBankZ;
            if (newVisuals.effectiveTerrainType === 'default') {
                newVisuals.effectiveTerrainType = 'river_bank';
            }
        }
    }

    if (cliffCoords.has(currentTileCoordString)) {
        const cliffZ = 1.2;
        if (newVisuals.zIndex < cliffZ) {
            const cliffColor = visualsConfig.caTileVisuals?.wall?.color ?? '#4b5563';
            newVisuals.style.backgroundColor = cliffColor;
            newVisuals.content = tileHash % 6 === 0
                ? React.createElement("span", { role: "img", "aria-label": "cliff face" }, "⛰️")
                : null;
            newVisuals.zIndex = cliffZ;
            newVisuals.effectiveTerrainType = 'wall';
        }
    } else if (cliffAdjacencyCoords.has(currentTileCoordString)) {
        const cliffAdjZ = 0.52;
        if (newVisuals.zIndex < cliffAdjZ) {
            const cliffAdjColor = 'rgba(120, 122, 127, 0.68)';
            newVisuals.style.backgroundColor = cliffAdjColor;
            newVisuals.zIndex = cliffAdjZ;
            if (newVisuals.effectiveTerrainType === 'default') {
                newVisuals.effectiveTerrainType = 'rock';
            }
        }
    }

    if (pathDetails.mainPathCoords.has(currentTileCoordString)) {
        const pathZ = 1;
        if (newVisuals.zIndex < pathZ) {
            newVisuals.style.backgroundColor = visualsConfig.pathColor;
            newVisuals.content = visualsConfig.pathIcon && tileHash % 3 === 0
                ? React.createElement("span", { role: "img", "aria-label": "path detail" }, visualsConfig.pathIcon)
                : null;
            newVisuals.zIndex = pathZ;
            newVisuals.effectiveTerrainType = 'path';
        }
    } else if (pathDetails.pathAdjacencyCoords.has(currentTileCoordString)) {
        const pathAdjZ = 0.5;
        if (newVisuals.zIndex < pathAdjZ) {
            if (visualsConfig.pathAdjacency?.color) {
                const currentBgMatch = newVisuals.style.backgroundColor?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                const adjBgMatch = visualsConfig.pathAdjacency.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (currentBgMatch && adjBgMatch) {
                    const r = Math.floor((parseInt(currentBgMatch[1]) * 0.7 + parseInt(adjBgMatch[1]) * 0.3));
                    const g = Math.floor((parseInt(currentBgMatch[2]) * 0.7 + parseInt(adjBgMatch[2]) * 0.3));
                    const b = Math.floor((parseInt(currentBgMatch[3]) * 0.7 + parseInt(adjBgMatch[3]) * 0.3));
                    const aC = parseFloat(currentBgMatch[4] || '1');
                    const aA = parseFloat(adjBgMatch[4] || '1');
                    const a = Math.max(aC, aA);
                    newVisuals.style.backgroundColor = `rgba(${r},${g},${b},${a.toFixed(2)})`;
                } else {
                    newVisuals.style.backgroundColor = visualsConfig.pathAdjacency.color;
                }
            }
            if (visualsConfig.pathAdjacency?.scatter && !newVisuals.content) {
                const scatterRollAdj = (tileHash % 100) / 100;
                let cumulativeDensityAdj = 0;
                for (const scatter of visualsConfig.pathAdjacency.scatter) {
                    cumulativeDensityAdj += scatter.density;
                    if (scatterRollAdj < cumulativeDensityAdj) {
                        const iconOpacity = 0.7 + (tileHash % 31) / 100;
                        // newVisuals.content = <span style={{ opacity: iconOpacity }} role="img" aria-label="pathside detail">{scatter.icon}</span>;
                        newVisuals.content = React.createElement("span", { style: { opacity: iconOpacity }, role: "img", "aria-label": "pathside detail" }, scatter.icon);
                        if (scatter.color) newVisuals.style.backgroundColor = scatter.color;
                        break;
                    }
                }
            }
            newVisuals.zIndex = Math.max(newVisuals.zIndex, pathAdjZ);
            newVisuals.effectiveTerrainType = 'path_adj';
        }
    }
    return newVisuals;
}

export function applyWfcVisuals(
    currentVisuals: VisualLayerOutput,
    tileType: string,
    visualsConfig: BiomeVisuals,
    tileHash: number,
): VisualLayerOutput {
    // WFC tiles should directly inform the base terrain the rest of the UI reasons over.
    const newVisuals = { ...currentVisuals };
    // Keep DOM visuals aligned with the Pixi palette by sourcing all colors from the centralized visualsConfig.
    const waterColor = visualsConfig.seededFeatures?.find(
        (feature) => feature.generatesEffectiveTerrainType === 'water'
    )?.color || 'rgba(33, 105, 170, 0.85)';
    const wallColor = visualsConfig.caTileVisuals?.wall?.color || '#4b5563';
    const floorColor = visualsConfig.caTileVisuals?.floor?.color || '#9ca3af';

    switch (tileType) {
        case 'grass': {
            newVisuals.style.backgroundColor = visualsConfig.baseColors[tileHash % visualsConfig.baseColors.length];
            newVisuals.effectiveTerrainType = 'grass';
            break;
        }
        case 'path': {
            newVisuals.style.backgroundColor = visualsConfig.pathColor;
            // newVisuals.content = visualsConfig.pathIcon && tileHash % 2 === 0
            //   ? <span role="img" aria-label="path">{visualsConfig.pathIcon}</span>
            //   : null;
            newVisuals.content = visualsConfig.pathIcon && tileHash % 2 === 0
                ? React.createElement("span", { role: "img", "aria-label": "path" }, visualsConfig.pathIcon)
                : null;
            newVisuals.effectiveTerrainType = 'path';
            newVisuals.zIndex = Math.max(newVisuals.zIndex, 1);
            break;
        }
        case 'water': {
            newVisuals.style.backgroundColor = waterColor;
            newVisuals.content = React.createElement("span", { role: "img", "aria-label": "water" }, "🌊");
            newVisuals.effectiveTerrainType = 'water';
            break;
        }
        case 'rock': {
            newVisuals.style.backgroundColor = wallColor;
            newVisuals.content = React.createElement("span", { role: "img", "aria-label": "rock" }, "🪨");
            newVisuals.effectiveTerrainType = 'wall';
            break;
        }
        case 'wall': {
            newVisuals.style.backgroundColor = wallColor;
            newVisuals.effectiveTerrainType = 'wall';
            break;
        }
        case 'floor': {
            newVisuals.style.backgroundColor = floorColor;
            newVisuals.effectiveTerrainType = 'floor';
            break;
        }
        case 'ore': {
            newVisuals.style.backgroundColor = wallColor;
            newVisuals.content = React.createElement("span", { role: "img", "aria-label": "ore" }, "💎");
            newVisuals.effectiveTerrainType = 'wall';
            newVisuals.isResource = true;
            break;
        }
        default:
            break;
    }

    return newVisuals;
}

export function applySeededFeatureVisuals(
    currentVisuals: VisualLayerOutput,
    rowIndex: number,
    colIndex: number,
    activeSeededFeatures: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }>
): VisualLayerOutput {
    const newVisuals = { ...currentVisuals };
    let dominantFeatureForTile: SeededFeatureConfig | null = null;

    for (const seeded of activeSeededFeatures) {
        let isWithinFeature = false;
        const dx = Math.abs(colIndex - seeded.x);
        const dy = Math.abs(rowIndex - seeded.y);
        const isSeedTile = colIndex === seeded.x && rowIndex === seeded.y;

        if (seeded.config.shapeType === 'rectangular') {
            isWithinFeature = dx <= seeded.actualSize && dy <= seeded.actualSize;
        } else { // Default to circular
            const distance = Math.sqrt(Math.pow(colIndex - seeded.x, 2) + Math.pow(rowIndex - seeded.y, 2));
            isWithinFeature = distance <= seeded.actualSize;
        }

        if (isWithinFeature) {
            const featureZ = seeded.config.zOffset || 0.1;
            if (featureZ > newVisuals.zIndex) {
                newVisuals.zIndex = featureZ;
                newVisuals.style.backgroundColor = seeded.config.color;
                // Clear any existing content for non-seed tiles in the feature area
                newVisuals.content = null;
                newVisuals.effectiveTerrainType = seeded.config.generatesEffectiveTerrainType || seeded.config.id;
                dominantFeatureForTile = seeded.config;
            }
            // Always show the icon on the seed tile, regardless of zIndex conflicts
            if (isSeedTile) {
                newVisuals.content = React.createElement("span", { role: "img", "aria-label": seeded.config.name || seeded.config.id }, seeded.config.icon);
                newVisuals.zIndex = Math.max(newVisuals.zIndex, featureZ);
                newVisuals.effectiveTerrainType = seeded.config.generatesEffectiveTerrainType || seeded.config.id;
                dominantFeatureForTile = seeded.config;
                newVisuals.isSeedTile = true;
            }
        } else if (seeded.config.adjacency) {
            let isAdjacent = false;
            if (seeded.config.shapeType === 'rectangular') {
                isAdjacent = (dx <= seeded.actualSize + 1 && dy <= seeded.actualSize + 1) && !(dx <= seeded.actualSize && dy <= seeded.actualSize);
            } else {
                const distance = Math.sqrt(Math.pow(colIndex - seeded.x, 2) + Math.pow(rowIndex - seeded.y, 2));
                isAdjacent = distance <= seeded.actualSize + 1 && distance > seeded.actualSize;
            }

            if (isAdjacent) {
                const adjZ = (seeded.config.zOffset || 0.1) - 0.05;
                if (adjZ > newVisuals.zIndex) {
                    newVisuals.zIndex = adjZ;
                    if (seeded.config.adjacency.color) newVisuals.style.backgroundColor = seeded.config.adjacency.color;
                    // if (seeded.config.adjacency.icon) newVisuals.content = <span role="img" aria-label={`${seeded.config.name || seeded.config.id} adjacency`}>{seeded.config.adjacency.icon}</span>;
                    if (seeded.config.adjacency.icon) newVisuals.content = React.createElement("span", { role: "img", "aria-label": `${seeded.config.name || seeded.config.id} adjacency` }, seeded.config.adjacency.icon);

                    if (!dominantFeatureForTile) {
                        newVisuals.effectiveTerrainType = `${seeded.config.generatesEffectiveTerrainType || seeded.config.id}_adj`;
                    }
                }
            }
        }
    }
    newVisuals.activeSeededFeatureConfigForTile = dominantFeatureForTile;
    return newVisuals;
}

export function applyScatterVisuals(
    currentVisuals: VisualLayerOutput,
    tileHash: number,
    visualsConfig: BiomeVisuals
): VisualLayerOutput {
    const newVisuals = { ...currentVisuals };
    const scatterFeaturesToUse = newVisuals.activeSeededFeatureConfigForTile?.scatterOverride || visualsConfig.scatterFeatures;
    const allowedTerrain = newVisuals.activeSeededFeatureConfigForTile?.scatterOverride
        ? newVisuals.effectiveTerrainType // If override exists, scatter is specific to the feature's terrain type
        : currentVisuals.effectiveTerrainType; // Use the current effective terrain type (could be 'floor' or 'default')

    if (newVisuals.content === null || newVisuals.zIndex < 0.1) {
        const scatterRoll = (tileHash % 1000) / 1000;
        let cumulativeDensity = 0;
        for (const scatter of scatterFeaturesToUse) {
            cumulativeDensity += scatter.density;
            if (scatterRoll < cumulativeDensity) {
                // Logic to check 'allowedOn'. If allowedOn is present, the current terrain MUST match.
                if (scatter.allowedOn && allowedTerrain) {
                    if (!scatter.allowedOn.includes(allowedTerrain) && !scatter.allowedOn.includes('default')) {
                        continue; // Skip if not allowed
                    }
                }

                const scatterZ = 0.01;
                if (scatterZ > newVisuals.zIndex) {
                    newVisuals.zIndex = scatterZ; // Keep zIndex low for scatter unless it's meant to be prominent
                }
                const iconOpacity = 0.5 + (tileHash % 51) / 100;
                // const iconNode = scatter.icon ? <span style={{ opacity: iconOpacity }} role="img" aria-label="scatter detail">{scatter.icon}</span> : null;
                const iconNode = scatter.icon ? React.createElement("span", { style: { opacity: iconOpacity }, role: "img", "aria-label": "scatter detail" }, scatter.icon) : null;
                if (iconNode) {
                    newVisuals.content = iconNode;
                    newVisuals.animationClass = getAnimationClass(scatter.icon);
                    newVisuals.isResource = getIsResource(scatter.icon);
                }
                if (scatter.color) newVisuals.style.backgroundColor = scatter.color;
                break;
            }
        }
    }
    return newVisuals;
}
