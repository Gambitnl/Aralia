/**
 * @file backgrounds.ts
 * 2024 Player's Handbook backgrounds for Aralia RPG
 */

export interface Background {
  id: string;
  name: string;
  description: string;
  skillProficiencies: string[]; // Skill IDs
  toolProficiencies?: string[]; // Tool IDs
  languages?: string[]; // Language names
  equipment: string[]; // Equipment item IDs
  originFeatId: string; // 2024 PHB Origin Feat
  feature: {
    name: string;
    description: string;
  };
  ageAppropriate: 'any' | 'adult' | 'child' | 'young'; // Age restrictions
  suggestedCharacteristics?: {
    personalityTraits: string[];
    ideals: string[];
    bonds: string[];
    flaws: string[];
  };
}

// 2024 PHB Backgrounds
export const BACKGROUNDS: Record<string, Background> = {
  acolyte: {
    id: 'acolyte',
    name: 'Acolyte',
    description: 'You have spent your life in service to a temple, learning sacred rites and providing spiritual guidance.',
    skillProficiencies: ['insight', 'religion'],
    languages: ['Two additional languages of your choice'],
    equipment: ['holy_symbol', 'prayer_book', '5_candles', 'tinderbox', 'common_clothes', '15_gp'],
    originFeatId: 'magic_initiate',
    feature: {
      name: 'Shelter of the Faithful',
      description: 'You command the respect of those who share your faith, and you can perform religious ceremonies.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I idolize a hero of my faith', 'I see omens in death', 'I am suspicious of strangers', 'I am tolerant of others'],
      ideals: ['Faith is my shield', 'I owe my life to the priest who took me in', 'I will do anything to protect the temple'],
      bonds: ['My deity', 'My temple', 'My sacred text'],
      flaws: ['I am suspicious of strangers', 'I am greedy', 'I am jealous of anyone who has more than me']
    }
  },

  criminal: {
    id: 'criminal',
    name: 'Criminal',
    description: 'You have a history of breaking the law, whether as a thief, smuggler, or something worse.',
    skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ['one_gaming_set', 'thieves_tools'],
    equipment: ['crowbar', 'dark_common_clothes', '15_gp'],
    originFeatId: 'alert',
    feature: {
      name: 'Criminal Contact',
      description: 'You have a contact in the criminal underworld who can help you with information or favors.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am always calm, no matter the situation', 'I never raise my voice', 'I don\'t trust anyone'],
      ideals: ['Freedom is everything', 'Money talks', 'I never harm innocents'],
      bonds: ['My criminal contact', 'My loot', 'My freedom'],
      flaws: ['I am greedy', 'I am violent when cornered', 'I am suspicious of everyone']
    }
  },

  entertainer: {
    id: 'entertainer',
    name: 'Entertainer',
    description: 'You are a performer, delighting audiences with music, dance, or other arts.',
    skillProficiencies: ['acrobatics', 'performance'],
    toolProficiencies: ['one_musical_instrument'],
    equipment: ['musical_instrument', 'costume', '15_gp'],
    originFeatId: 'musician',
    feature: {
      name: 'By Popular Demand',
      description: 'You can find work performing in most settlements, and you have advantage on Charisma checks to influence fans.'
    },
    ageAppropriate: 'any',
    suggestedCharacteristics: {
      personalityTraits: ['I know a story for every occasion', 'I am always the center of attention', 'I am generous with my fans'],
      ideals: ['Art is the highest calling', 'I will make the world a better place through my art', 'Fame is my destiny'],
      bonds: ['My instrument', 'My most prized possession', 'My fans'],
      flaws: ['I am vain', 'I am addicted to applause', 'I am jealous of other performers']
    }
  },

  farmer: {
    id: 'farmer',
    name: 'Farmer',
    description: 'You grew up on a farm, learning the value of hard work and the rhythms of the seasons.',
    skillProficiencies: ['animal_handling', 'nature'],
    toolProficiencies: ['one_artisan_tool'],
    equipment: ['sickle', 'wooden_pitchfork', 'iron_pot', 'common_clothes', '10_gp'],
    originFeatId: 'tough',
    feature: {
      name: 'Rustic Hospitality',
      description: 'You can find shelter and aid from common folk in rural areas.'
    },
    ageAppropriate: 'any'
  },

  guide: {
    id: 'guide',
    name: 'Guide',
    description: 'You spent your life in the wilderness, leading travelers through dangerous terrain.',
    skillProficiencies: ['stealth', 'survival'],
    toolProficiencies: ['cartographers_tools'],
    languages: ['One additional language of your choice'],
    equipment: ['staff', 'hunting_trap', 'travelers_clothes', '10_gp'],
    originFeatId: 'magic_initiate',
    feature: {
      name: 'Wanderer',
      description: 'You have an excellent memory for maps and geography.'
    },
    ageAppropriate: 'adult'
  },

  hermit: {
    id: 'hermit',
    name: 'Hermit',
    description: 'You lived in seclusion, either by choice or necessity, developing a deep connection with nature or the divine.',
    skillProficiencies: ['medicine', 'religion'],
    toolProficiencies: ['herbalism_kit'],
    languages: ['One additional language of your choice'],
    equipment: ['scroll_case_of_notes', 'winter_blanket', 'common_clothes', 'herbalism_kit', '5_gp'],
    originFeatId: 'healer',
    feature: {
      name: 'Discovery',
      description: 'You have made a profound discovery during your seclusion that grants you unique insights or abilities.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am introspective and thoughtful', 'I am uncomfortable in crowds', 'I am connected to nature'],
      ideals: ['Solitude brings enlightenment', 'The natural world is sacred', 'I seek truth above all'],
      bonds: ['My hermitage', 'My discovery', 'The person who helped me leave seclusion'],
      flaws: ['I am socially awkward', 'I am suspicious of strangers', 'I am prone to visions or madness']
    }
  },

  noble: {
    id: 'noble',
    name: 'Noble',
    description: 'You are a member of the nobility, born into privilege and responsibility.',
    skillProficiencies: ['history', 'persuasion'],
    toolProficiencies: ['one_gaming_set'],
    languages: ['One additional language of your choice'],
    equipment: ['signet_ring', 'scroll_of_pedigree', 'fine_clothes', '25_gp'],
    originFeatId: 'skilled',
    feature: {
      name: 'Position of Privilege',
      description: 'You are welcome in high society and can secure audiences with local nobility.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am used to getting what I want', 'I am polite and cultured', 'I am arrogant'],
      ideals: ['Nobility obligates me to protect others', 'Power is my birthright', 'I will restore my family\'s honor'],
      bonds: ['My family', 'My title', 'My lands'],
      flaws: ['I am spoiled', 'I am entitled', 'I am prejudiced against commoners']
    }
  },

  sage: {
    id: 'sage',
    name: 'Sage',
    description: 'You have spent years studying ancient lore, pursuing knowledge and understanding.',
    skillProficiencies: ['arcana', 'history'],
    languages: ['Two additional languages of your choice'],
    equipment: ['bottle_of_ink', 'quill', 'small_knife', 'letter_from_a_colleague', 'common_clothes', '10_gp'],
    originFeatId: 'magic_initiate',
    feature: {
      name: 'Researcher',
      description: 'You can find information in libraries and archives, and you have contacts among scholars and researchers.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am curious about everything', 'I am absent-minded', 'I am obsessed with knowledge'],
      ideals: ['Knowledge is the key to everything', 'I will uncover ancient secrets', 'The pursuit of knowledge is more important than anything else'],
      bonds: ['My library', 'My mentor', 'A particular subject of study'],
      flaws: ['I am absent-minded', 'I am arrogant about my knowledge', 'I am reckless in pursuit of knowledge']
    }
  },

  sailor: {
    id: 'sailor',
    name: 'Sailor',
    description: 'You spent your youth at sea, learning the ways of ships and sailors.',
    skillProficiencies: ['athletics', 'perception'],
    toolProficiencies: ['navigators_tools', 'water_vehicles'],
    equipment: ['sailors_knife', 'friendship_tattoo', 'playing_cards', 'common_clothes', '10_gp'],
    originFeatId: 'tavern_brawler',
    feature: {
      name: 'Bad Reputation',
      description: 'You have a reputation among sailors and can gather information in port cities.'
    },
    ageAppropriate: 'young',
    suggestedCharacteristics: {
      personalityTraits: ['I am always ready for adventure', 'I am superstitious about the sea', 'I am loyal to my shipmates'],
      ideals: ['The sea is freedom', 'Ships are my home', 'I will explore every shore'],
      bonds: ['My ship', 'My captain', 'My shipmates'],
      flaws: ['I am reckless and impulsive', 'I am superstitious', 'I drink too much']
    }
  },

  soldier: {
    id: 'soldier',
    name: 'Soldier',
    description: 'You have served in a military, learning discipline and combat skills.',
    skillProficiencies: ['athletics', 'intimidation'],
    toolProficiencies: ['one_gaming_set', 'land_vehicles'],
    equipment: ['rank_insignia', 'trophy_from_battle', 'common_clothes', '10_gp'],
    originFeatId: 'savage_attacker',
    feature: {
      name: 'Military Rank',
      description: 'You have a military rank that grants you respect from soldiers and access to military resources.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am disciplined', 'I am brave', 'I am loyal to my comrades'],
      ideals: ['Honor is everything', 'I will protect my comrades', 'The chain of command must be respected'],
      bonds: ['My unit', 'My comrades', 'My military honor'],
      flaws: ['I follow orders without question', 'I am violent when provoked', 'I am prejudiced against civilians']
    }
  },

  urchin: {
    id: 'urchin',
    name: 'Urchin',
    description: 'You grew up on the streets, learning to survive through cunning and stealth.',
    skillProficiencies: ['sleight_of_hand', 'stealth'],
    toolProficiencies: ['disguise_kit', 'thieves_tools'],
    equipment: ['small_knife', 'map_of_your_home_city', 'pet_mouse', 'token_of_remembrance', 'common_clothes', '10_gp'],
    originFeatId: 'lucky',
    feature: {
      name: 'City Secrets',
      description: 'You know the hidden paths and secret places of your home city, and can move through urban environments unseen.'
    },
    ageAppropriate: 'child',
    suggestedCharacteristics: {
      personalityTraits: ['I am street-smart', 'I am always hungry', 'I am suspicious of strangers', 'I am loyal to my friends'],
      ideals: ['Survival first', 'The streets are my home', 'I will protect my territory'],
      bonds: ['My street gang', 'My favorite hiding spot', 'The person who taught me to survive'],
      flaws: ['I steal from anyone', 'I am paranoid', 'I am reckless']
    }
  },

  'faction-agent': {
    id: 'faction-agent',
    name: 'Faction Agent',
    description: 'You are a member of a larger organization, working toward its goals.',
    skillProficiencies: ['insight', 'investigation'],
    languages: ['One additional language of your choice'],
    equipment: ['badge_of_faction', 'letter_of_introduction', 'common_clothes', '15_gp'],
    originFeatId: 'alert',
    feature: {
      name: 'Faction Connection',
      description: 'You have connections within your faction that can provide you with information, resources, or safe passage.'
    },
    ageAppropriate: 'adult'
  }
};

export const AGE_APPROPRIATE_BACKGROUNDS = {
  child: ['urchin', 'farmer', 'acolyte', 'entertainer', 'noble', 'sage', 'hermit'],
  young: ['acolyte', 'entertainer', 'farmer', 'noble', 'sage', 'sailor', 'urchin'],
  adult: ['acolyte', 'criminal', 'entertainer', 'farmer', 'guide', 'hermit', 'noble', 'sage', 'soldier', 'sailor', 'urchin', 'faction-agent']
} as const;
