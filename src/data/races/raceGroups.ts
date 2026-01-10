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
        id: 'dragonborn',
        name: 'Dragonborn',
        description:
            'Dragonborn are proud dragon-blooded humanoids who walk in two worlds. Their draconic ancestry grants them powerful breath weapons and resistance to elemental damage.',
        comparisonTraits: ['Damage Type', 'Breath Weapon', 'Damage Resistance', 'Draconic Ancestry'],
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
        id: 'half_orc',
        name: 'Half-Orc',
        description:
            'Half-orcs combine orcish power and resilience with human adaptability. They possess remarkable endurance and strength.',
        comparisonTraits: ['Darkvision', 'Relentless Endurance', 'Special Abilities', 'Key Traits'],
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
        id: 'shifter',
        name: 'Shifter',
        description:
            'Shifters are weretouched humanoids who can temporarily enhance their animalistic features. Each shifter variant manifests different bestial traits from their lycanthropic heritage.',
        comparisonTraits: ['Darkvision', 'Shifting Ability', 'Shifting Benefit', 'Bestial Nature'],
    },
    {
        id: 'tiefling',
        name: 'Tiefling',
        description:
            'Tieflings carry the blood of the Lower Planes, manifesting fiendish traits. Each legacy reflects a different fiendish origin and grants unique magical abilities.',
        comparisonTraits: ['Legacy', 'Damage Resistance', 'Innate Spells', 'Fiendish Power'],
    },
    // Standalone races (single-variant accordions for consistency)
    {
        id: 'autognome',
        name: 'Autognome',
        description:
            'Autognomes are mechanical beings created by rock gnome inventors, imbued with sentience through a spark of the Positive Plane. They are Constructs with remarkable durability.',
        comparisonTraits: ['Creature Type', 'Armored Casing', 'Built for Success', 'Mechanical Nature'],
    },
    {
        id: 'bugbear',
        name: 'Bugbear',
        description:
            'Bugbears are hulking cousins of goblins, combining great strength with a fey gift for stealth. They excel at ambush tactics and surprise attacks.',
        comparisonTraits: ['Long-Limbed', 'Powerful Build', 'Sneaky', 'Surprise Attack'],
    },
    {
        id: 'centaur',
        name: 'Centaur',
        description:
            'Centaurs are fey creatures with the upper body of a humanoid and the lower body of a horse. They are swift, strong, and deeply connected to nature.',
        comparisonTraits: ['Speed', 'Charge', 'Hooves', 'Natural Affinity'],
    },
    {
        id: 'changeling',
        name: 'Changeling',
        description:
            'Changelings are shapeshifters descended from doppelgangers. They can alter their appearance at will, adapting to any situation with supernatural ease.',
        comparisonTraits: ['Shapechanger', 'Change Appearance', 'Instincts', 'Divergent Persona'],
    },
    {
        id: 'fairy',
        name: 'Fairy',
        description:
            'Fairies are Small fey creatures infused with the magic of the Feywild. Despite their size, they possess flight and innate spellcasting.',
        comparisonTraits: ['Size', 'Flight', 'Fairy Magic', 'Fey Passage'],
    },
    {
        id: 'firbolg',
        name: 'Firbolg',
        description:
            'Firbolgs are gentle forest-dwelling giants with druidic magic and a deep connection to nature. They value community and harmony with the natural world.',
        comparisonTraits: ['Powerful Build', 'Firbolg Magic', 'Hidden Step', 'Speech of Beast and Leaf'],
    },
    {
        id: 'goblin',
        name: 'Goblin',
        description:
            'Goblins are small, scrappy survivors with fey origins. Quick and cunning, they excel at hit-and-run tactics and evading danger.',
        comparisonTraits: ['Size', 'Fury of the Small', 'Nimble Escape', 'Darkvision'],
    },
    {
        id: 'hobgoblin',
        name: 'Hobgoblin',
        description:
            'Hobgoblins are disciplined warriors with fey heritage, known for their tactical acumen and martial prowess. They excel in organized combat.',
        comparisonTraits: ['Darkvision', 'Fey Gift', 'Fortune from the Many', 'Martial Training'],
    },
    {
        id: 'kalashtar',
        name: 'Kalashtar',
        description:
            'Kalashtar are humanoids bound to spirits from the plane of dreams. This union grants them psionic abilities and resistance to psychic intrusion.',
        comparisonTraits: ['Dual Mind', 'Mental Discipline', 'Mind Link', 'Psychic Resistance'],
    },
    {
        id: 'kender',
        name: 'Kender',
        description:
            'Kender are fearless, curious Small folk from the world of Krynn. Their insatiable curiosity and complete lack of fear make them uniquely bold.',
        comparisonTraits: ['Size', 'Fearless', 'Taunt', 'Kender Skill Versatility'],
    },
    {
        id: 'kobold',
        name: 'Kobold',
        description:
            'Kobolds are Small draconic humanoids who thrive in groups. Though individually weak, they are clever trap-makers and loyal to their dragon kin.',
        comparisonTraits: ['Size', 'Darkvision', 'Draconic Cry', 'Kobold Legacy'],
    },
    {
        id: 'orc',
        name: 'Orc',
        description:
            'Orcs are powerful warriors blessed by the god Gruumsh with remarkable endurance. They can push through pain and fight beyond normal limits.',
        comparisonTraits: ['Darkvision', 'Adrenaline Rush', 'Relentless Endurance', 'Powerful Build'],
    },
    {
        id: 'plasmoid',
        name: 'Plasmoid',
        description:
            'Plasmoids are amorphous ooze-like beings who can shape their bodies at will. They can squeeze through tiny spaces and reshape their forms.',
        comparisonTraits: ['Amorphous', 'Darkvision', 'Hold Breath', 'Shape Self'],
    },
    {
        id: 'satyr',
        name: 'Satyr',
        description:
            'Satyrs are fey creatures known for their love of revelry and music. Their magical resistance and natural charisma make them captivating companions.',
        comparisonTraits: ['Fey', 'Ram', 'Magic Resistance', 'Mirthful Leaps'],
    },
    {
        id: 'simic_hybrid',
        name: 'Simic Hybrid',
        description:
            'Simic Hybrids are magically enhanced beings created by the Simic Combine. They possess animal enhancements that grant unique physical abilities.',
        comparisonTraits: ['Animal Enhancement', 'Darkvision', 'Enhancement Options', 'Adaptive Nature'],
    },
    {
        id: 'triton',
        name: 'Triton',
        description:
            'Tritons are aquatic guardians from the Elemental Plane of Water. They possess innate magic and the ability to breathe both air and water.',
        comparisonTraits: ['Amphibious', 'Control Air and Water', 'Darkvision', 'Guardian of the Depths'],
    },
    {
        id: 'vedalken',
        name: 'Vedalken',
        description:
            'Vedalken are blue-skinned perfectionists who strive for constant improvement. Their logical minds and tireless dedication make them exceptional scholars.',
        comparisonTraits: ['Vedalken Dispassion', 'Tireless Precision', 'Partially Amphibious', 'Intellect'],
    },
    {
        id: 'verdan',
        name: 'Verdan',
        description:
            'Verdans are goblinoids transformed by wild magic. They continue to grow and change throughout their lives, adapting to new circumstances.',
        comparisonTraits: ['Black Blood Healing', 'Limited Telepathy', 'Persuasive', 'Telepathic Insight'],
    },
    {
        id: 'warforged',
        name: 'Warforged',
        description:
            'Warforged are living constructs created for war. Though built as soldiers, they possess free will and seek purpose beyond battle.',
        comparisonTraits: ['Constructed Resilience', 'Sentry\'s Rest', 'Integrated Protection', 'Specialized Design'],
    },
];

/**
 * Lookup a race group by its ID.
 */
export const getRaceGroupById = (id: string): RaceGroupMeta | undefined => {
    return RACE_GROUPS.find((g) => g.id === id);
};
