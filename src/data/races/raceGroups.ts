/**
 * @file raceGroups.ts
 * Defines parent race group metadata for accordion-style race selection.
 * Each group contains a generic description and optional comparison table config.
 */

export interface RaceGroupMeta {
    /** Unique identifier for the race group (e.g., 'dwarf', 'elf') */
    id: string;
    /** Display name for the group header */
    name: string;
    /** Generic description shown when the group is expanded (not a specific variant) */
    description: string;
    /** Traits to highlight in the comparison table */
    comparisonTraits?: string[];
}

/**
 * Metadata for parent race groups.
 * Used by RaceSelection to render accordion headers and generic descriptions.
 */
export const RACE_GROUPS: RaceGroupMeta[] = [
    {
        id: 'aasimar',
        name: 'Aasimar',
        description:
            'Aasimar are mortals infused with celestial power, bearing the divine spark of the Upper Planes. They possess transformative revelations that manifest their celestial nature.',
        comparisonTraits: ['Darkvision', 'Celestial Resistance', 'Healing Hands', 'Light Bearer', 'Radiant Soul', 'Radiant Consumption', 'Necrotic Shroud'],
    },
    {
        id: 'beastfolk',
        name: 'Beastfolk',
        description:
            'Beastfolk are humanoids with animalistic features, ranging from avian to reptilian to mammalian traits. Each possesses unique abilities tied to their animal nature.',
        comparisonTraits: ['Speed', 'Size', 'Natural Abilities', 'Special Movement', 'Key Traits'],
    },
    {
        id: 'draconic_kin',
        name: 'Draconic Kin',
        description:
            'Draconic Kin are humanoids touched by dragon blood. From the proud dragonborn to the cunning kobolds, they share a connection to dragonkind that grants them breath weapons, elemental resistance, or draconic cunning.',
        comparisonTraits: ['Damage Type', 'Breath Weapon', 'Damage Resistance', 'Draconic Ancestry', 'Kobold Legacy'],
    },
    {
        id: 'dwarf',
        name: 'Dwarf',
        description:
            'Dwarves are stout, resilient folk known for their craftsmanship, endurance, and deep connection to stone and earth. They excel as warriors, smiths, and artisans.',
        comparisonTraits: ['Speed', 'Darkvision', 'Poison Resistance', 'Stonecunning', 'Special Traits'],
    },
    {
        id: 'eladrin',
        name: 'Eladrin',
        description:
            'Eladrin are elves native to the Feywild who embody the seasons. Their emotions and abilities shift with the seasons, from joyful spring to melancholy winter.',
        comparisonTraits: ['Season', 'Fey Step Effect', 'Seasonal Ability', 'Emotional Aspect'],
    },
    {
        id: 'elf',
        name: 'Elf',
        description:
            'Elves are magical people of otherworldly grace, known for their keen senses, connection to the Feywild, and mastery of magic and nature. Each elven lineage reflects different aspects of elven culture.',
        comparisonTraits: ['Speed', 'Darkvision', 'Trance', 'Lineage Ability', 'Special Traits'],
    },
    {
        id: 'genasi',
        name: 'Genasi',
        description:
            'Genasi trace their ancestry to the genies of the Elemental Planes. Each genasi manifests the power of their elemental heritage through innate magic and resistance.',
        comparisonTraits: ['Element', 'Damage Resistance', 'Innate Magic', 'Special Movement'],
    },
    {
        id: 'gith',
        name: 'Gith',
        description:
            'The gith are psionic peoples who escaped mind flayer enslavement millennia ago. Now split into two cultures—the warlike githyanki and the contemplative githzerai.',
        comparisonTraits: ['Psionic Ability', 'Special Movement', 'Mental Discipline', 'Key Traits'],
    },
    {
        id: 'gnome',
        name: 'Gnome',
        description:
            'Gnomes are magical folk known for their cleverness, curiosity, and mastery of illusion magic. Each gnome subrace reflects different aspects of gnomish ingenuity.',
        comparisonTraits: ['Speed', 'Darkvision', 'Gnome Cunning', 'Subrace Ability', 'Special Traits'],
    },
    {
        id: 'goliath',
        name: 'Goliath',
        description:
            'Goliaths are towering humanoids descended from giants, inheriting supernatural strength and resilience. Each goliath embodies the legacy of their giant ancestor.',
        comparisonTraits: ['Giant Ancestry', 'Strike Ability', 'Ancestry Benefit', 'Size'],
    },
    {
        id: 'half_elf',
        name: 'Half-Elf',
        description:
            'Half-elves combine human versatility with elven grace. Those with specific elven heritage may inherit additional traits from their elven parent.',
        comparisonTraits: ['Speed', 'Darkvision', 'Fey Ancestry', 'Heritage Ability', 'Versatility'],
    },
    {
        id: 'greenskins',
        name: 'Greenskins',
        description:
            'Greenskins are a diverse group of humanoids united by their orcish or goblinoid heritage. From the cunning goblins to the mighty orcs and half-orcs, they share a resilient nature and adaptability.',
        comparisonTraits: ['Darkvision', 'Special Abilities', 'Fury of the Small', 'Relentless Endurance', 'Key Traits'],
    },
    {
        id: 'halfling',
        name: 'Halfling',
        description:
            'Halflings are small, cheerful folk known for their remarkable luck, bravery, and nimbleness. Each halfling subrace has adapted to different environments.',
        comparisonTraits: ['Speed', 'Lucky', 'Brave', 'Subrace Ability', 'Nimbleness'],
    },
    {
        id: 'human',
        name: 'Human',
        description:
            'Humans are the most adaptable and ambitious people, known for their resourcefulness and determination. Some humans bear dragonmarks that grant mystical powers.',
        comparisonTraits: ['Versatility', 'Skills', 'Special Abilities', 'Dragonmark Powers'],
    },
    {
        id: 'shapeshifters',
        name: 'Shapeshifters',
        description:
            'Shapeshifters are beings with the innate ability to alter their physical form. From the weretouched shifters to the amorphous plasmoids and identity-fluid changelings, they share a mutable nature that defies fixed shape.',
        comparisonTraits: ['Shapechanger', 'Form Ability', 'Darkvision', 'Special Movement', 'Key Traits'],
    },
    {
        id: 'tiefling',
        name: 'Tiefling',
        description:
            'Tieflings carry the blood of the Lower Planes, manifesting fiendish traits. Each legacy reflects a different fiendish origin and grants unique magical abilities.',
        comparisonTraits: ['Legacy', 'Damage Resistance', 'Innate Spells', 'Fiendish Power'],
    },
    {
        id: 'feyfolk',
        name: 'Feyfolk',
        description:
            'Feyfolk are creatures with deep ties to the Feywild or fey nature. From tiny fairies to towering firbolgs, they share an innate connection to wild magic and the natural world.',
        comparisonTraits: ['Size', 'Fey Ancestry', 'Special Movement', 'Nature Magic', 'Key Traits'],
    },
    {
        id: 'constructed',
        name: 'Constructed',
        description:
            'Constructed beings are sentient creatures built rather than born. Whether forged for war or crafted by gnomish ingenuity, they possess mechanical bodies animated by magic or the spark of life.',
        comparisonTraits: ['Creature Type', 'Constructed Resilience', 'Rest Requirements', 'Key Traits'],
    },
    {
        id: 'planar_travelers',
        name: 'Planar Travelers',
        description:
            'Planar Travelers are beings with origins beyond the Material Plane or who possess unusual connections to other realms. They bring exotic abilities and unique perspectives.',
        comparisonTraits: ['Origin Plane', 'Special Abilities', 'Amphibious', 'Psionic Powers', 'Key Traits'],
    },
];

/**
 * Lookup a race group by its ID.
 */
export const getRaceGroupById = (id: string): RaceGroupMeta | undefined => {
    return RACE_GROUPS.find((g) => g.id === id);
};
