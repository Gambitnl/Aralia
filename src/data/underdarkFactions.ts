/**
 * @file src/data/underdarkFactions.ts
 * Canonical data for major Underdark factions.
 */

import { UnderdarkFaction } from '../types/underdark';

export const UNDERDARK_FACTIONS: UnderdarkFaction[] = [
    {
        id: 'drow_menzoberranzan',
        name: 'House Baenre of Menzoberranzan',
        description: 'The premier Drow city, ruled by Matron Mothers under the gaze of Lolth. A society of cutthroat politics and spider worship.',
        territoryDepth: 'upper',
        baseHostility: 90, // Nearly always hostile to surface dwellers
        tradePossible: true, // Only if you have something they desperately want (or are Drow)
        languages: ['Elvish', 'Undercommon'],
        specialMechanics: [
            {
                type: 'lolth_surveillance',
                description: 'The Spider Queen watches. Stealth checks are made with Disadvantage. Natural 1s on stealth summon spiders.',
                intensity: 5
            }
        ]
    },
    {
        id: 'duergar_gracklstugh',
        name: 'The Deepking\'s Guard (Gracklstugh)',
        description: 'The City of Blades. Duergar are dour, hardworking slavers who hate the Drow and Mind Flayers alike.',
        territoryDepth: 'middle',
        baseHostility: 60, // Suspicious but pragmatic
        tradePossible: true, // Excellent armor and weapons, if you have coin or slaves
        languages: ['Dwarvish', 'Undercommon'],
        specialMechanics: [
            {
                type: 'antimagic_zones',
                description: 'Industrial smog and psionic dampeners interfere with magic. 20% chance of spell failure.',
                intensity: 3
            }
        ]
    },
    {
        id: 'svirfneblin_blingdenstone',
        name: 'Diggermattocks of Blingdenstone',
        description: 'Deep Gnomes who have survived by hiding and illusion. They are the most likely allies for surface dwellers.',
        territoryDepth: 'middle',
        baseHostility: 20, // Cautious but generally good-aligned
        tradePossible: true, // Gems and information
        languages: ['Gnomish', 'Undercommon'],
        specialMechanics: [] // Their territory is generally safe, just hard to find
    },
    {
        id: 'illithid_colony',
        name: 'The Sept of the Elder Brain',
        description: 'A hive mind of Mind Flayers seeking to enslave all intelligent life. They dwell in the deepest dark.',
        territoryDepth: 'lower',
        baseHostility: 100, // Eat brains on sight
        tradePossible: false, // You are food or a thrall
        languages: ['Deep Speech', 'Telepathy'],
        specialMechanics: [
            {
                type: 'psionic_static',
                description: 'The Elder Brain\'s presence claws at the mind. Passive Sanity drain is doubled.',
                intensity: 8
            }
        ]
    },
    {
        id: 'myconid_spore_circle',
        name: 'Circle of Araumycos',
        description: 'Peaceful fungal collective. They share a group consciousness through spores.',
        territoryDepth: 'upper',
        baseHostility: 10, // Very peaceful unless threatened
        tradePossible: true, // Potions and weird organic items
        languages: ['Telepathy'],
        specialMechanics: [
            {
                type: 'spore_infestation',
                description: 'Breathing the air allows telepathic communication but risks fungal bonding (Constitution save daily).',
                intensity: 2
            }
        ]
    },
    {
        id: 'beholder_xanathar',
        name: 'The Eye Tyrant\'s Lair',
        description: 'A vertical maze controlled by a paranoid Beholder. Traps and disintegration rays abound.',
        territoryDepth: 'middle',
        baseHostility: 80, // Paranoid and aggressive
        tradePossible: true, // If you flatter it enough
        languages: ['Deep Speech', 'Undercommon'],
        specialMechanics: [
            {
                type: 'paranoid_watchers',
                description: 'You feel constantly watched. The Beholder knows your position if you fail a WIS save.',
                intensity: 7
            }
        ]
    }
];
