/**
 * @file src/types/underdark.ts
 * Type definitions for Underdark-specific mechanics, primarily focusing on Light as a Resource.
 */

export type LightSourceType = 'torch' | 'lantern' | 'spell' | 'bioluminescence';

export interface LightSource {
    id: string;
    type: LightSourceType;
    name: string;
    radius: number; // In feet
    durationRemaining: number; // In minutes
    isActive: boolean;
}

export interface UnderdarkState {
    currentDepth: number; // Depth in feet below surface
    lightLevel: 'bright' | 'dim' | 'darkness' | 'magical_darkness';
    activeLightSources: LightSource[];
    sanity: {
        current: number;
        max: number;
        madnessLevel: number; // 0-3
    };
}
