/**
 * @file src/hooks/useUnderdarkLighting.ts
 * Hook to calculate current light levels based on inventory and environment.
 */
import { Item } from '../types';
import { LightSource } from '../types/underdark';
export declare const useUnderdarkLighting: (inventory: Item[]) => {
    activeSources: LightSource[];
    currentLightLevel: "darkness" | "bright" | "dim";
    isInDarkness: boolean;
};
