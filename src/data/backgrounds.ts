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

  apprentice: {
    id: 'apprentice',
    name: 'Apprentice',
    description: 'You spent your formative years learning a trade or craft under a master.',
    skillProficiencies: ['investigation', 'persuasion'],
    toolProficiencies: ['One type of artisan\'s tools'],
    languages: ['One additional language of your choice'],
    equipment: ['letter_of_introduction', 'common_clothes', '10_gp'],
    feature: {
      name: 'Busywork',
      description: 'You can find work to support yourself in most settlements, and you have contacts in your trade.'
    },
    ageAppropriate: 'young', // Good for younger characters learning a trade
    suggestedCharacteristics: {
      personalityTraits: ['I am always polite and respectful', 'I am curious about the world', 'I am obsessed with my craft'],
      ideals: ['Knowledge is power', 'Hard work pays off', 'I will master my craft'],
      bonds: ['My master', 'My craft', 'The guild I belong to'],
      flaws: ['I am arrogant about my skills', 'I am envious of those better than me', 'I am reckless with money']
    }
  },

  'child-of-the-streets': {
    id: 'child-of-the-streets',
    name: 'Child of the Streets',
    description: 'You grew up on the streets, surviving through wits and willpower.',
    skillProficiencies: ['sleight_of_hand', 'stealth'],
    toolProficiencies: ['thieves_tools', 'one_gaming_set'],
    equipment: ['small_knife', 'map_of_your_home_city', 'pet_mouse', 'token_of_remembrance', 'common_clothes', '10_gp'],
    feature: {
      name: 'Streetwise',
      description: 'You know the streets of your home city like the back of your hand, and can find safe places to rest.'
    },
    ageAppropriate: 'child', // Specifically for child characters
    suggestedCharacteristics: {
      personalityTraits: ['I am always hungry', 'I am street-smart', 'I am suspicious of authority', 'I am loyal to my friends'],
      ideals: ['Survival first', 'The streets are my home', 'I protect the weak'],
      bonds: ['My street gang', 'My favorite hiding spot', 'The person who taught me to survive'],
      flaws: ['I steal from the rich', 'I am paranoid', 'I am reckless']
    }
  },

  criminal: {
    id: 'criminal',
    name: 'Criminal',
    description: 'You have a history of breaking the law, whether as a thief, smuggler, or something worse.',
    skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ['one_gaming_set', 'thieves_tools'],
    equipment: ['crowbar', 'dark_common_clothes', '15_gp'],
    feature: {
      name: 'Criminal Contact',
      description: 'You have a contact in the criminal underworld who can help you with information or favors.'
    },
    ageAppropriate: 'adult', // Criminal activities typically start in adulthood
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

  'faction-agent': {
    id: 'faction-agent',
    name: 'Faction Agent',
    description: 'You are a member of a larger organization, working toward its goals.',
    skillProficiencies: ['insight', 'investigation'],
    languages: ['One additional language of your choice'],
    equipment: ['badge_of_faction', 'letter_of_introduction', 'common_clothes', '15_gp'],
    feature: {
      name: 'Faction Connection',
      description: 'You have connections within your faction that can provide you with information, resources, or safe passage.'
    },
    ageAppropriate: 'adult', // Factions typically recruit adults
    suggestedCharacteristics: {
      personalityTraits: ['I am loyal to my faction above all else', 'I am secretive about my faction\'s activities', 'I am ambitious'],
      ideals: ['My faction is the best hope for the world', 'I will rise through the ranks', 'Power corrupts, but I can wield it wisely'],
      bonds: ['My faction', 'My faction contact', 'The faction\'s goals'],
      flaws: ['I am suspicious of outsiders', 'I am arrogant about my faction\'s superiority', 'I obey orders without question']
    }
  },

  'far-traveler': {
    id: 'far-traveler',
    name: 'Far Traveler',
    description: 'You have traveled extensively, visiting distant lands and encountering strange cultures.',
    skillProficiencies: ['insight', 'perception'],
    toolProficiencies: ['one_artisan_tool'],
    languages: ['One additional language of your choice'],
    equipment: ['staff', 'travelers_clothes', 'poor_journal', 'bottle_of_ink', 'quill', '10_gp'],
    feature: {
      name: 'All Eyes on You',
      description: 'Your unusual clothing and mannerisms draw attention, but you can use this to your advantage in social situations.'
    },
    ageAppropriate: 'adult', // Extensive travel suggests adulthood
    suggestedCharacteristics: {
      personalityTraits: ['I am curious about everything', 'I am observant', 'I am always polite to strangers'],
      ideals: ['Knowledge is the greatest treasure', 'Experience is the best teacher', 'I will explore every corner of the world'],
      bonds: ['My homeland', 'My family', 'The place I consider home'],
      flaws: ['I am homesick', 'I am xenophobic', 'I am reckless in pursuit of knowledge']
    }
  },

  'folk-hero': {
    id: 'folk-hero',
    name: 'Folk Hero',
    description: 'You are a champion of the common people, standing up for the downtrodden and defending your community.',
    skillProficiencies: ['animal_handling', 'survival'],
    toolProficiencies: ['one_artisan_tool', 'land_vehicles'],
    equipment: ['shovel', 'iron_pot', 'common_clothes', '10_gp'],
    feature: {
      name: 'Rustic Hospitality',
      description: 'You can find shelter and aid from common folk in rural areas, and they will share information with you.'
    },
    ageAppropriate: 'adult', // Folk heroes typically earn their reputation as adults
    suggestedCharacteristics: {
      personalityTraits: ['I am honest to a fault', 'I am suspicious of nobles', 'I am generous with those in need'],
      ideals: ['The common folk must be protected', 'I will stand up for justice', 'Power must serve the people'],
      bonds: ['My village', 'My family', 'The common folk'],
      flaws: ['I am prejudiced against nobles', 'I am stubborn', 'I am reckless when defending others']
    }
  },

  'guild-artisan': {
    id: 'guild-artisan',
    name: 'Guild Artisan',
    description: 'You are a member of a guild, skilled in a particular trade and part of a larger organization.',
    skillProficiencies: ['insight', 'persuasion'],
    toolProficiencies: ['one_artisan_tool'],
    languages: ['One additional language of your choice'],
    equipment: ['guild_letter', 'travelers_clothes', '10_gp'],
    feature: {
      name: 'Guild Membership',
      description: 'You have access to guild resources and can call on guild members for aid in your trade-related activities.'
    },
    ageAppropriate: 'adult', // Guild membership typically comes with adulthood
    suggestedCharacteristics: {
      personalityTraits: ['I am proud of my work', 'I am always willing to help fellow guild members', 'I am suspicious of non-guild artisans'],
      ideals: ['Quality over quantity', 'My guild is the best', 'I will advance my guild\'s interests'],
      bonds: ['My guild', 'My guild master', 'My fellow guild members'],
      flaws: ['I am jealous of other guilds', 'I am arrogant about my skills', 'I am greedy']
    }
  },

  'noble': {
    id: 'noble',
    name: 'Noble',
    description: 'You are a member of the nobility, born into privilege and responsibility.',
    skillProficiencies: ['history', 'persuasion'],
    toolProficiencies: ['one_gaming_set'],
    languages: ['One additional language of your choice'],
    equipment: ['signet_ring', 'scroll_of_pedigree', 'fine_clothes', '25_gp'],
    feature: {
      name: 'Position of Privilege',
      description: 'You are welcome in high society and can secure audiences with local nobility.'
    },
    ageAppropriate: 'adult', // Nobility involves adult responsibilities
    suggestedCharacteristics: {
      personalityTraits: ['I am used to getting what I want', 'I am polite and cultured', 'I am arrogant'],
      ideals: ['Nobility obligates me to protect others', 'Power is my birthright', 'I will restore my family\'s honor'],
      bonds: ['My family', 'My title', 'My lands'],
      flaws: ['I am spoiled', 'I am entitled', 'I am prejudiced against commoners']
    }
  },

  'sage': {
    id: 'sage',
    name: 'Sage',
    description: 'You have spent years studying ancient lore, pursuing knowledge and understanding.',
    skillProficiencies: ['arcana', 'history'],
    languages: ['Two additional languages of your choice'],
    equipment: ['bottle_of_ink', 'quill', 'small_knife', 'letter_from_a_colleague', 'common_clothes', '10_gp'],
    feature: {
      name: 'Researcher',
      description: 'You can find information in libraries and archives, and you have contacts among scholars and researchers.'
    },
    ageAppropriate: 'adult', // Scholarly pursuits typically start in adulthood
    suggestedCharacteristics: {
      personalityTraits: ['I am curious about everything', 'I am absent-minded', 'I am obsessed with knowledge'],
      ideals: ['Knowledge is the key to everything', 'I will uncover ancient secrets', 'The pursuit of knowledge is more important than anything else'],
      bonds: ['My library', 'My mentor', 'A particular subject of study'],
      flaws: ['I am absent-minded', 'I am arrogant about my knowledge', 'I am reckless in pursuit of knowledge']
    }
  },

  'soldier': {
    id: 'soldier',
    name: 'Soldier',
    description: 'You have served in a military, learning discipline and combat skills.',
    skillProficiencies: ['athletics', 'intimidation'],
    toolProficiencies: ['one_gaming_set', 'land_vehicles'],
    equipment: ['rank_insignia', 'trophy_from_battle', 'common_clothes', '10_gp'],
    feature: {
      name: 'Military Rank',
      description: 'You have a military rank that grants you respect from soldiers and access to military resources.'
    },
    ageAppropriate: 'adult', // Military service typically starts in adulthood
    suggestedCharacteristics: {
      personalityTraits: ['I am disciplined', 'I am brave', 'I am loyal to my comrades'],
      ideals: ['Honor is everything', 'I will protect my comrades', 'The chain of command must be respected'],
      bonds: ['My unit', 'My comrades', 'My military honor'],
      flaws: ['I follow orders without question', 'I am violent when provoked', 'I am prejudiced against civilians']
    }
  },

  'urchin': {
    id: 'urchin',
    name: 'Urchin',
    description: 'You grew up on the streets, learning to survive through cunning and stealth.',
    skillProficiencies: ['sleight_of_hand', 'stealth'],
    toolProficiencies: ['disguise_kit', 'thieves_tools'],
    equipment: ['small_knife', 'map_of_your_home_city', 'pet_mouse', 'token_of_remembrance', 'common_clothes', '10_gp'],
    feature: {
      name: 'City Secrets',
      description: 'You know the hidden paths and secret places of your home city, and can move through urban environments unseen.'
    },
    ageAppropriate: 'child', // Urchin background fits children perfectly
    suggestedCharacteristics: {
      personalityTraits: ['I am street-smart', 'I am always hungry', 'I am suspicious of strangers', 'I am loyal to my friends'],
      ideals: ['Survival first', 'The streets are my home', 'I will protect my territory'],
      bonds: ['My street gang', 'My favorite hiding spot', 'The person who taught me to survive'],
      flaws: ['I steal from anyone', 'I am paranoid', 'I am reckless']
    }
  },

  // Additional backgrounds from previous editions and popular sources
  archaeologist: {
    id: 'archaeologist',
    name: 'Archaeologist',
    description: 'You are an archaeologist dedicated to exploring ancient ruins and uncovering lost knowledge.',
    skillProficiencies: ['history', 'survival'],
    toolProficiencies: ['cartographers_tools'],
    languages: ['One ancient or exotic language of your choice'],
    equipment: ['brush', 'measuring_tape', 'old_book', 'common_clothes', '25_gp'],
    feature: {
      name: 'Dust Digger',
      description: 'You can search for hidden passages and secret compartments, and you have advantage on Intelligence (History) checks related to ancient ruins.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I love a good mystery', 'I am methodical and precise', 'I am fascinated by the past'],
      ideals: ['Knowledge is the greatest treasure', 'The past holds secrets that can change the future', 'Preservation is key'],
      bonds: ['My archaeological society', 'A particular ancient civilization', 'My collection of artifacts'],
      flaws: ['I am obsessed with ancient artifacts', 'I take unnecessary risks in ruins', 'I am dismissive of "primitive" cultures']
    }
  },

  cloisteredScholar: {
    id: 'cloistered-scholar',
    name: 'Cloistered Scholar',
    description: 'You have spent years in secluded study, mastering a particular field of knowledge.',
    skillProficiencies: ['history', 'plus_one_from_arcana_history_nature_religion'],
    toolProficiencies: ['calligraphers_supplies'],
    languages: ['Two additional languages of your choice'],
    equipment: ['bottle_of_ink', 'quill', 'small_knife', 'letter_from_a_colleague', 'common_clothes', '10_gp'],
    feature: {
      name: 'Library Access',
      description: 'You have access to academic libraries and can conduct research, gaining advantage on Intelligence checks related to your field of study.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am bookish and studious', 'I am precise in my speech', 'I am curious about everything'],
      ideals: ['Knowledge is power', 'Education is the path to enlightenment', 'I will share my knowledge with others'],
      bonds: ['My library', 'My mentor', 'My field of study'],
      flaws: ['I am socially awkward', 'I am pedantic', 'I am reckless in pursuit of knowledge']
    }
  },

  courtier: {
    id: 'courtier',
    name: 'Courtier',
    description: 'You are skilled in the art of courtly intrigue and social maneuvering.',
    skillProficiencies: ['insight', 'persuasion'],
    toolProficiencies: ['one_gaming_set'],
    languages: ['Two additional languages of your choice'],
    equipment: ['signet_ring', 'scroll_of_pedigree', 'fine_clothes', '25_gp'],
    feature: {
      name: 'Courtly Bearing',
      description: 'You can gain access to noble courts and have advantage on Charisma (Persuasion) checks when dealing with nobility.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am charming and diplomatic', 'I am always politically aware', 'I am skilled at reading people'],
      ideals: ['Power through influence', 'The court is a game, and I play to win', 'Loyalty to my patron'],
      bonds: ['My noble patron', 'My courtly position', 'My network of contacts'],
      flaws: ['I am ambitious and ruthless', 'I am vain about my appearance', 'I am overly concerned with status']
    }
  },

  gladiator: {
    id: 'gladiator',
    name: 'Gladiator',
    description: 'You are a former gladiator who fought for glory and gold in the arena.',
    skillProficiencies: ['athletics', 'performance'],
    toolProficiencies: ['disguise_kit', 'one_artisans_tool'],
    equipment: ['unusual_weapon', 'show_armor', 'trophy_from_battle', 'common_clothes', '15_gp'],
    feature: {
      name: 'Arena Veteran',
      description: 'You can find work as a gladiator or bodyguard, and you have advantage on Charisma (Performance) checks in combat situations.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am boastful about my victories', 'I am physically imposing', 'I am loyal to my friends'],
      ideals: ['Glory in battle', 'Strength and skill win the day', 'I fight for honor'],
      bonds: ['My gladiatorial troupe', 'My signature weapon', 'My greatest victory'],
      flaws: ['I am arrogant and overconfident', 'I am quick to anger', 'I am reckless in combat']
    }
  },

  hermit: {
    id: 'hermit',
    name: 'Hermit',
    description: 'You lived in seclusion, either by choice or necessity, developing a deep connection with nature or the divine.',
    skillProficiencies: ['medicine', 'religion'],
    toolProficiencies: ['herbalism_kit'],
    languages: ['One additional language of your choice'],
    equipment: ['scroll_case_of_notes', 'winter_blanket', 'common_clothes', 'herbalism_kit', '5_gp'],
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

  inheritor: {
    id: 'inheritor',
    name: 'Inheritor',
    description: 'You have inherited a family heirloom that carries great significance and possibly magical power.',
    skillProficiencies: ['history', 'plus_one_from_arcana_investigation_religion'],
    toolProficiencies: ['one_artisans_tool'],
    languages: ['One additional language of your choice'],
    equipment: ['family_heirloom', 'travelers_clothes', 'poor_journal', '10_gp'],
    feature: {
      name: 'Inheritance',
      description: 'You have inherited a magical heirloom that provides you with unique abilities or insights.'
    },
    ageAppropriate: 'any',
    suggestedCharacteristics: {
      personalityTraits: ['I am proud of my heritage', 'I am curious about my ancestry', 'I am protective of my heirloom'],
      ideals: ['Family legacy is everything', 'The past shapes the future', 'I will honor my ancestors'],
      bonds: ['My family heirloom', 'My ancestral home', 'My family legacy'],
      flaws: ['I am obsessed with my inheritance', 'I am suspicious of those who ask about my heirloom', 'I am reckless when my heritage is insulted']
    }
  },

  mercenary: {
    id: 'mercenary',
    name: 'Mercenary',
    description: 'You fought as a hired soldier, selling your skills to the highest bidder.',
    skillProficiencies: ['athletics', 'intimidation'],
    toolProficiencies: ['one_gaming_set', 'land_vehicles'],
    equipment: ['uniform_of_your_company', 'rank_insignia', 'common_clothes', '10_gp'],
    feature: {
      name: 'Mercenary Life',
      description: 'You can find mercenary work easily and have contacts in military circles.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am disciplined and professional', 'I am cynical about motives', 'I am loyal to my contracts'],
      ideals: ['A contract is sacred', 'Money solves most problems', 'I fight for those who pay me'],
      bonds: ['My mercenary company', 'My current contract', 'My battle companions'],
      flaws: ['I am greedy and materialistic', 'I am suspicious of altruism', 'I break promises when offered more money']
    }
  },

  outlander: {
    id: 'outlander',
    name: 'Outlander',
    description: 'You grew up in the wilds, far from civilization, learning to survive in harsh environments.',
    skillProficiencies: ['athletics', 'survival'],
    toolProficiencies: ['one_musical_instrument'],
    languages: ['One additional language of your choice'],
    equipment: ['staff', 'hunting_trap', 'trophy_from_animal', 'travelers_clothes', '10_gp'],
    feature: {
      name: 'Wanderer',
      description: 'You can find food and fresh water for yourself and up to 5 others each day, and you have advantage on Intelligence checks to recall geography.'
    },
    ageAppropriate: 'adult',
    suggestedCharacteristics: {
      personalityTraits: ['I am suspicious of cities and civilization', 'I am resourceful and self-reliant', 'I am in tune with nature'],
      ideals: ['Nature is the only reliable ally', 'Cities are corrupt and dangerous', 'I will protect the wild places'],
      bonds: ['My homeland', 'My tribe or clan', 'The natural world'],
      flaws: ['I am xenophobic toward city folk', 'I am impulsive and reckless', 'I have difficulty following laws']
    }
  },

  sailor: {
    id: 'sailor',
    name: 'Sailor',
    description: 'You spent your youth at sea, learning the ways of ships and sailors.',
    skillProficiencies: ['athletics', 'perception'],
    toolProficiencies: ['navigators_tools', 'water_vehicles'],
    equipment: ['sailors_knife', 'friendship_tattoo', 'playing_cards', 'common_clothes', '10_gp'],
    feature: {
      name: 'Bad Reputation',
      description: 'You have a reputation among sailors and can gather information in port cities.'
    },
    ageAppropriate: 'young', // Sailors can start young
    suggestedCharacteristics: {
      personalityTraits: ['I am always ready for adventure', 'I am superstitious about the sea', 'I am loyal to my shipmates'],
      ideals: ['The sea is freedom', 'Ships are my home', 'I will explore every shore'],
      bonds: ['My ship', 'My captain', 'My shipmates'],
      flaws: ['I am reckless and impulsive', 'I am superstitious', 'I drink too much']
    }
  },

  // Additional classic and homebrew backgrounds
  shipwright: {
    id: 'shipwright',
    name: 'Shipwright',
    description: 'You are skilled in the construction and repair of ships, having worked in dockyards and shipyards.',
    skillProficiencies: ['history', 'persuasion'],
    toolProficiencies: ['carpenters_tools', 'water_vehicles'],
    languages: ['One additional language of your choice'],
    equipment: ['hammer', 'saw', 'adzes', 'wooden_model_ship', 'common_clothes', '15_gp'],
    feature: {
      name: 'I Know a Guy',
      description: 'You have contacts among ship captains and dockworkers, and can arrange passage on ships or find ship-related work.'
    },
    ageAppropriate: 'young', // Shipwrights can apprentice young
    suggestedCharacteristics: {
      personalityTraits: ['I am meticulous about craftsmanship', 'I love the smell of fresh-cut wood', 'I am knowledgeable about maritime lore'],
      ideals: ['Quality craftsmanship endures', 'The sea is a harsh mistress', 'I will build vessels that last centuries'],
      bonds: ['My shipyard', 'My master craftsman', 'The ship I built with my own hands'],
      flaws: ['I am obsessed with perfection', 'I am dismissive of "landlubbers"', 'I take unnecessary risks at sea']
    }
  },

  spy: {
    id: 'spy',
    name: 'Spy',
    description: 'You worked as an intelligence gatherer, using stealth and deception to uncover secrets.',
    skillProficiencies: ['deception', 'investigation'],
    toolProficiencies: ['disguise_kit', 'forgery_kit'],
    languages: ['One additional language of your choice'],
    equipment: ['disguise_kit', 'forgery_kit', 'coded_message', 'fine_clothes', '15_gp'],
    feature: {
      name: 'Shadow Network',
      description: 'You have access to a network of informants and can gather information about criminal or political activities.'
    },
    ageAppropriate: 'adult', // Espionage requires maturity
    suggestedCharacteristics: {
      personalityTraits: ['I am always observing others', 'I never reveal my true motives', 'I am skilled at blending in'],
      ideals: ['Information is power', 'The ends justify the means', 'I serve a greater cause'],
      bonds: ['My spymaster', 'My nation or organization', 'A fellow agent who saved my life'],
      flaws: ['I am paranoid about surveillance', 'I cannot trust anyone', 'I am addicted to intrigue']
    }
  },

  knightOfTheOrder: {
    id: 'knight-of-the-order',
    name: 'Knight of the Order',
    description: 'You are a member of a knightly order, sworn to uphold chivalric ideals and protect the realm.',
    skillProficiencies: ['history', 'persuasion'],
    toolProficiencies: ['one_artisans_tool'],
    languages: ['One additional language of your choice'],
    equipment: ['heraldic_signet', 'scroll_of_lineage', 'fine_clothes', '25_gp'],
    feature: {
      name: 'Knightly Regard',
      description: 'Members of your order recognize you and will provide aid, shelter, and information when needed.'
    },
    ageAppropriate: 'young', // Knights can be initiated young
    suggestedCharacteristics: {
      personalityTraits: ['I am honorable and just', 'I am disciplined in my training', 'I am protective of the weak'],
      ideals: ['Honor above all', 'I will protect the innocent', 'Chivalry is not dead'],
      bonds: ['My knightly order', 'My code of honor', 'The person I swore to protect'],
      flaws: ['I am bound by my oath, even when inconvenient', 'I am judgmental of those who don\'t follow my code', 'I am reckless when honor demands it']
    }
  },

  tribalWarrior: {
    id: 'tribal-warrior',
    name: 'Tribal Warrior',
    description: 'You grew up in a tribal society, learning the ways of your people and the spirits of the land.',
    skillProficiencies: ['survival', 'intimidation'],
    toolProficiencies: ['one_musical_instrument'],
    languages: ['One additional language of your choice'],
    equipment: ['hunting_trap', 'totem_token', 'hide_armor', 'common_clothes', '10_gp'],
    feature: {
      name: 'Tribal Knowledge',
      description: 'You can identify natural hazards and find safe paths through wilderness areas, and can communicate with tribal peoples.'
    },
    ageAppropriate: 'young', // Tribal warriors train from youth
    suggestedCharacteristics: {
      personalityTraits: ['I am connected to nature', 'I respect the traditions of my people', 'I am wary of outsiders'],
      ideals: ['The tribe comes first', 'Nature provides for those who respect it', 'Strength comes from unity'],
      bonds: ['My tribe', 'My tribal totem', 'The spirits of the land'],
      flaws: ['I am suspicious of city folk', 'I follow tribal customs rigidly', 'I am quick to anger when traditions are mocked']
    }
  },

  beastMaster: {
    id: 'beast-master',
    name: 'Beast Master',
    description: 'You have a special bond with animals and have trained a loyal beast companion.',
    skillProficiencies: ['animal_handling', 'nature'],
    toolProficiencies: ['one_artisans_tool'],
    languages: [],
    equipment: ['leash', 'small_knife', 'explorers_pack', 'animal_feed', 'common_clothes', '10_gp'],
    feature: {
      name: 'Beast Companion',
      description: 'You have a loyal beast companion that aids you in combat and exploration. Choose a CR 1/4 or lower beast.'
    },
    ageAppropriate: 'any', // Beast masters can be any age
    suggestedCharacteristics: {
      personalityTraits: ['I am more comfortable with animals than people', 'I am protective of my beast companion', 'I am in tune with nature'],
      ideals: ['Animals are purer than humans', 'The wild places must be protected', 'Strength comes from harmony with nature'],
      bonds: ['My beast companion', 'The natural world', 'The druid or ranger who taught me'],
      flaws: ['I am distrustful of civilized folk', 'I am reckless when my companion is threatened', 'I have difficulty relating to non-animals']
    }
  },

  elementalAdept: {
    id: 'elemental-adept',
    name: 'Elemental Adept',
    description: 'You have studied elemental magic and can harness the power of one of the four classical elements.',
    skillProficiencies: ['arcana', 'survival'],
    toolProficiencies: ['alchemists_supplies'],
    languages: ['Primordial'],
    equipment: ['elemental_focus', 'spellbook', 'component_pouch', 'common_clothes', '15_gp'],
    feature: {
      name: 'Elemental Affinity',
      description: 'You have resistance to one elemental damage type (acid, cold, fire, or lightning) and can cast elemental spells with advantage.'
    },
    ageAppropriate: 'adult', // Elemental study requires dedication
    suggestedCharacteristics: {
      personalityTraits: ['I am fascinated by elemental forces', 'I am methodical in my studies', 'I am passionate about my element'],
      ideals: ['Elements are the building blocks of reality', 'Balance between elements must be maintained', 'I will master my elemental affinity'],
      bonds: ['My elemental studies', 'My mentor in elemental magic', 'A place of elemental power'],
      flaws: ['I am obsessed with elemental phenomena', 'I am dismissive of non-elemental magic', 'I take reckless risks to study elements']
    }
  },

  gravekeeper: {
    id: 'gravekeeper',
    name: 'Gravekeeper',
    description: 'You tend to the dead, maintaining cemeteries and performing burial rites in your community.',
    skillProficiencies: ['history', 'religion'],
    toolProficiencies: ['shovel', 'holy_water'],
    languages: ['One additional language of your choice'],
    equipment: ['shovel', 'holy_symbol', 'prayer_book', 'common_clothes', '15_gp'],
    feature: {
      name: 'Keeper of the Dead',
      description: 'You have access to burial records and can research local history, and undead creatures have disadvantage on attacks against you.'
    },
    ageAppropriate: 'adult', // Gravekeeping requires maturity
    suggestedCharacteristics: {
      personalityTraits: ['I am solemn and respectful', 'I am knowledgeable about death customs', 'I am comforting to the bereaved'],
      ideals: ['Death is a natural part of life', 'The dead deserve respect', 'I will protect the living from the undead'],
      bonds: ['My cemetery', 'The community I serve', 'Ancient burial traditions'],
      flaws: ['I am morbidly fascinated by death', 'I am socially awkward at celebrations', 'I am suspicious of resurrection magic']
    }
  },

  revolutionary: {
    id: 'revolutionary',
    name: 'Revolutionary',
    description: 'You have fought against oppressive regimes or systems, working to bring about political change.',
    skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ['disguise_kit', 'forgery_kit'],
    languages: ['One additional language of your choice'],
    equipment: ['leaflet_of_propaganda', 'disguise_kit', 'common_clothes', '10_gp'],
    feature: {
      name: 'Revolutionary Contacts',
      description: 'You have contacts among dissidents and rebels, and can find safe houses and information in areas of political unrest.'
    },
    ageAppropriate: 'young', // Revolutions attract the young and idealistic
    suggestedCharacteristics: {
      personalityTraits: ['I am passionate about justice', 'I am skilled at blending in', 'I am distrustful of authority'],
      ideals: ['Freedom for all', 'The current system must change', 'Power to the people'],
      bonds: ['My revolutionary cell', 'The cause I fight for', 'Fellow revolutionaries who have died'],
      flaws: ['I am reckless in pursuit of my goals', 'I am paranoid about informants', 'I cannot compromise my ideals']
    }
  }
};

export const AGE_APPROPRIATE_BACKGROUNDS = {
  child: ['child-of-the-streets', 'urchin', 'apprentice', 'acolyte', 'entertainer', 'folk-hero', 'noble', 'sage', 'inheritor', 'beast-master'],
  young: ['apprentice', 'acolyte', 'entertainer', 'folk-hero', 'guild-artisan', 'noble', 'sage', 'sailor', 'inheritor', 'shipwright', 'knight-of-the-order', 'tribal-warrior', 'beast-master', 'revolutionary'],
  adult: ['acolyte', 'criminal', 'entertainer', 'faction-agent', 'far-traveler', 'folk-hero', 'guild-artisan', 'noble', 'sage', 'soldier', 'archaeologist', 'cloistered-scholar', 'courtier', 'gladiator', 'hermit', 'inheritor', 'mercenary', 'outlander', 'shipwright', 'spy', 'tribal-warrior', 'beast-master', 'elemental-adept', 'gravekeeper']
} as const;
