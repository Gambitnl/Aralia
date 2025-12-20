/**
 * @file src/data/underdark/biomes.ts
 * Definitions for alien Underdark environments.
 */

import { UnderdarkBiome } from '../../types/underdark';

export const UNDERDARK_BIOMES: Record<string, UnderdarkBiome> = {
    'cavern_standard': {
        id: 'cavern_standard',
        name: 'Limestone Caverns',
        description: 'Twisting tunnels of wet stone. The silence is broken only by dripping water.',
        nativeDepthLayers: ['upper', 'middle'],
        baseLightLevel: 'darkness',
        sanityModifier: 1.0, // Standard decay
        hazards: ['Pitfall', 'Slippery Floor'],
        resources: ['Limestone', 'Water'],
        soundscape: 'quiet'
    },
    'fungal_forest': {
        id: 'fungal_forest',
        name: 'Phosphorescent Fungal Forest',
        description: 'Towering Zurkhwood mushrooms glow with soft violet and blue hues. Spores drift like snow.',
        nativeDepthLayers: ['upper', 'middle'],
        baseLightLevel: 'dim', // Bioluminescence!
        sanityModifier: 0.5, // The beauty soothes the mind
        hazards: ['Toxic Spores', 'Violet Fungus'],
        resources: ['Zurkhwood', 'Edible Fungi', 'Water'],
        soundscape: 'quiet'
    },
    'darklake': {
        id: 'darklake',
        name: 'Darklake',
        description: 'A vast, motionless underground sea. Something ripples beneath the surface.',
        nativeDepthLayers: ['upper', 'middle'],
        baseLightLevel: 'darkness',
        sanityModifier: 1.2, // The unknown depths are unsettling
        hazards: ['Drowning', 'Aboleth Slime', 'Keel-crushing Waves'],
        resources: ['Blind Fish', 'Fresh Water'],
        soundscape: 'echoing'
    },
    'crystal_cavern': {
        id: 'crystal_cavern',
        name: 'Resonant Crystal Cavern',
        description: 'Sharp, angular crystals jut from every surface. They hum faintly when struck.',
        nativeDepthLayers: ['middle', 'lower'],
        baseLightLevel: 'darkness', // Crystals reflect, they don't emit (usually)
        sanityModifier: 0.8, // Organized structures are calming
        hazards: ['Razor Rocks', 'Sonic Burst'],
        resources: ['Gems', 'Spell Components'],
        soundscape: 'echoing' // Sounds are amplified
    },
    'bone_orchard': {
        id: 'bone_orchard',
        name: 'Bone Orchard',
        description: 'A cavern floor carpeted in ancient calcified bones. Some seem to be moving.',
        nativeDepthLayers: ['middle', 'lower'],
        baseLightLevel: 'darkness',
        sanityModifier: 2.0, // Horrifying
        hazards: ['Undead', 'Bone Spikes', 'Disease'],
        resources: ['Necrotic Essence'],
        soundscape: 'loud' // Crunching bones underfoot
    },
    'faerzress_pocket': {
        id: 'faerzress_pocket',
        name: 'Faerzress Nexus',
        description: 'The air hums with magical radiation. Strange lights dance without sources.',
        nativeDepthLayers: ['middle', 'lower', 'abyss'],
        baseLightLevel: 'dim', // Glowing magic
        sanityModifier: 1.5, // Alien energies
        hazards: ['Wild Magic Surge', 'Gravity Reversal'],
        resources: ['Residuum', 'Flux Stone'],
        soundscape: 'deafening' // Magical hum
    },
    'shadowfell_rift': {
        id: 'shadowfell_rift',
        name: 'Shadowfell Rift',
        description: 'A tear in reality where the Plane of Shadow bleeds through. Colors are drained to grey.',
        nativeDepthLayers: ['lower', 'abyss'],
        baseLightLevel: 'magical_darkness', // Even torches are dim
        sanityModifier: 3.0, // Soul-crushing despair
        hazards: ['Life Drain', 'Shadow Monsters', 'Memory Loss'],
        resources: ['Shadowstuff'],
        soundscape: 'silent' // Unnatural silence
    },
    'magma_tube': {
        id: 'magma_tube',
        name: 'Magma Tube',
        description: 'River of flowing lava illuminating the cavern in harsh reds and oranges.',
        nativeDepthLayers: ['lower', 'abyss'],
        baseLightLevel: 'bright',
        sanityModifier: 1.0,
        hazards: ['Extreme Heat', 'Lava Flow', 'Toxic Gas'],
        resources: ['Obsidian', 'Rare Ores'],
        soundscape: 'loud' // Roaring fire
    }
};
