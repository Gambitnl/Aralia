/**
 * @file src/hooks/useUnderdarkLighting.ts
 * Hook to calculate current light levels based on inventory and environment.
 */
import { Item } from '../types';
import { LightSource } from '../types/underdark';

export const useUnderdarkLighting = (inventory: Item[]) => {

    const getActiveLightSources = (): LightSource[] => {
        const sources: LightSource[] = [];

        // Check for Torches
        const torches = inventory.filter(i => i.id === 'torch');
        if (torches.length > 0) {
            sources.push({
                id: 'active_torch',
                type: 'torch',
                name: 'Torch',
                radius: 40, // 20 bright + 20 dim
                durationRemaining: 60, // Simplified: assuming fresh torch
                isActive: true
            });
        }

        // Check for Lanterns
        const lanterns = inventory.filter(i => i.id === 'hooded_lantern');
        const oil = inventory.filter(i => i.id === 'oil_flask');
        if (lanterns.length > 0 && oil.length > 0) {
             sources.push({
                id: 'active_lantern',
                type: 'lantern',
                name: 'Hooded Lantern',
                radius: 60, // 30 bright + 30 dim
                durationRemaining: 360,
                isActive: true
            });
        }

        // Check for Spells (Placeholder - would need spell list)
        // Check for Bioluminescence (Placeholder - would need environment state)

        return sources;
    };

    const calculateLightLevel = (sources: LightSource[]): 'bright' | 'dim' | 'darkness' => {
        if (sources.length === 0) return 'darkness';

        // If any source provides bright light (implied by existence in this simplified model)
        // Real logic would check distance, but for "inventory check" it's binary
        return 'bright';
    };

    const activeSources = getActiveLightSources();
    const currentLightLevel = calculateLightLevel(activeSources);

    return {
        activeSources,
        currentLightLevel,
        isInDarkness: currentLightLevel === 'darkness'
    };
};
