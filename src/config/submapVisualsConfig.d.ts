/**
 * @file src/config/submapVisualsConfig.ts
 * Centralizes the configuration for procedural submap visuals.
 */
import { BiomeVisuals } from '../types';
export declare const biomeVisualsConfig: Record<string, BiomeVisuals>;
export declare const defaultBiomeVisuals: BiomeVisuals;
/**
 * Visual definitions for the village canvas system. Each entry bundles a
 * palette and optional texture hints so the renderer can pick deterministic
 * variety without hard-coding colors into the drawing logic.
 */
export declare const villageBuildingVisuals: Record<string, {
    colors: string[];
    accent: string;
    pattern?: 'stripe' | 'check' | 'dot';
}>;
