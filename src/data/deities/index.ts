import { Deity } from '../../types';

export const DEITIES: Deity[] = [
    {
        id: 'bahamut',
        name: 'Bahamut',
        titles: ['The Platinum Dragon', 'King of the Good Dragons'],
        alignment: 'Lawful Good',
        domains: ['Life', 'War'],
        symbol: 'Platinum dragon head in profile',
        description: 'Bahamut commands his followers to uphold the highest ideals of honor and justice.',
        commandments: [
            'Protect the weak and innocent.',
            'Smite evil where it stands, but show mercy to those who repent.',
            'Uphold justice and honor in all things.'
        ],
        favoredWeapon: 'Morningstar',
        approves: [
            { trigger: 'PROTECT_WEAK', description: 'Protect the innocent from harm', favorChange: 2 },
            { trigger: 'SMITE_EVIL', description: 'Defeat an evil creature', favorChange: 1 },
            { trigger: 'HONORABLE_COMBAT', description: 'Challenge a worthy foe singly', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'HARM_INNOCENT', description: 'Harm an innocent person', favorChange: -10 },
            { trigger: 'BETRAYAL', description: 'Betray an ally or oath', favorChange: -5 },
            { trigger: 'COWARDICE', description: 'Flee from a righteous battle', favorChange: -2 }
        ],
        relationships: [
            { targetDeityId: 'pelor', type: 'ally' },
            { targetDeityId: 'moradin', type: 'ally' }
        ]
    },
    {
        id: 'moradin',
        name: 'Moradin',
        titles: ['The Soul Forger', 'Dwarffather'],
        alignment: 'Lawful Good',
        domains: ['Forge', 'Knowledge'],
        symbol: 'Hammer and anvil',
        description: 'Moradin is the creator of dwarves and the patron of artisans and smiths.',
        commandments: [
            'Create enduring works of beauty and utility.',
            'Defend your clan and community with your life.',
            'Honor your ancestors through your deeds.'
        ],
        favoredWeapon: 'Warhammer',
        approves: [
            { trigger: 'CRAFT_MASTERWORK', description: 'Create an item of high quality', favorChange: 2 },
            { trigger: 'DEFEND_COMMUNITY', description: 'Defend a settlement from attack', favorChange: 2 },
            { trigger: 'TEACH_CRAFT', description: 'Teach a trade to another', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'DESTROY_CREATION', description: 'Wantonly destroy a useful object', favorChange: -5 },
            { trigger: 'ABANDON_CLAN', description: 'Abandon allies in need', favorChange: -10 },
            { trigger: 'USE_SHODDY_GEAR', description: 'Use poorly made equipment', favorChange: -1 }
        ],
        relationships: [
            { targetDeityId: 'bahamut', type: 'ally' },
            { targetDeityId: 'pelor', type: 'ally' }
        ]
    },
    {
        id: 'pelor',
        name: 'Pelor',
        titles: ['The Dawnfather', 'The Shining One'],
        alignment: 'Neutral Good',
        domains: ['Life', 'Light'],
        symbol: 'Sun face',
        description: 'Pelor represents the suns warmth and light, bringing healing and hope to the world.',
        commandments: [
            'Bring light into the darkness.',
            'Show kindness and compassion to all.',
            'Heal the sick and protect the downtrodden.'
        ],
        favoredWeapon: 'Mace',
        approves: [
            { trigger: 'HEAL_ALLY', description: 'Heal an ally below 50% HP', favorChange: 2 },
            { trigger: 'DESTROY_UNDEAD', description: 'Destroy an undead creature', favorChange: 1 },
            { trigger: 'GIVE_CHARITY', description: 'Donate gold to the poor', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'CAUSE_SUFFERING', description: 'Torture or cause unnecessary pain', favorChange: -10 },
            { trigger: 'USE_NECROMANCY', description: 'Cast a necromantic spell', favorChange: -5 },
            { trigger: 'IGNORE_PLAGUE', description: 'Ignore sickness or disease', favorChange: -2 }
        ],
        relationships: [
            { targetDeityId: 'raven_queen', type: 'rival' },
            { targetDeityId: 'bahamut', type: 'ally' }
        ]
    },
    {
        id: 'raven_queen',
        name: 'The Raven Queen',
        titles: ['Matron of Death', 'Queen of Shadows'],
        alignment: 'Lawful Neutral',
        domains: ['Death', 'Grave'],
        symbol: 'Raven head',
        description: 'The Raven Queen guides souls to the afterlife and ensures the natural order of death is respected.',
        commandments: [
            'Accept death as the natural end of life.',
            'Destroy the undead, for they are an abomination.',
            'Seek to understand the mysteries of fate.'
        ],
        favoredWeapon: 'Sickle',
        approves: [
            { trigger: 'DESTROY_UNDEAD', description: 'Destroy an undead creature', favorChange: 3 },
            { trigger: 'LAST_RITES', description: 'Perform rites for the fallen', favorChange: 1 },
            { trigger: 'ACCEPT_FATE', description: 'Accept a critical failure without complaint', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'CREATE_UNDEAD', description: 'Create an undead creature', favorChange: -20 },
            { trigger: 'CHEAT_DEATH', description: 'Resurrect a creature that has been dead for over a year', favorChange: -5 },
            { trigger: 'PROLONG_LIFE', description: 'Seek immortality (Lichdom)', favorChange: -100 }
        ],
        relationships: [
            { targetDeityId: 'pelor', type: 'rival' },
            { targetDeityId: 'lolth', type: 'enemy' }
        ]
    },
    {
        id: 'lolth',
        name: 'Lolth',
        titles: ['Spider Queen', 'Queen of the Demonweb Pits'],
        alignment: 'Chaotic Evil',
        domains: ['Trickery', 'War'],
        symbol: 'Spider',
        description: 'Lolth demands absolute obedience and ruthlessness from her drow followers.',
        commandments: [
            'Survival of the fittest is the only law.',
            'Betrayal is a tool to be used against enemies.',
            'Serve the Spider Queen above all others.'
        ],
        favoredWeapon: 'Whip',
        approves: [
            { trigger: 'BETRAY_ALLY', description: 'Successfully betray an ally for gain', favorChange: 5 },
            { trigger: 'SACRIFICE_FOLLOWER', description: 'Sacrifice a follower to Lolth', favorChange: 3 },
            { trigger: 'POISON_ENEMY', description: 'Defeat an enemy with poison', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'SHOW_MERCY', description: 'Spare a defeated enemy', favorChange: -5 },
            { trigger: 'PROTECT_WEAK', description: 'Defend someone unable to defend themselves', favorChange: -2 },
            { trigger: 'FAIL_TASK', description: 'Fail to complete a mission', favorChange: -5 }
        ],
        relationships: [
            { targetDeityId: 'raven_queen', type: 'enemy' }
        ]
    }
];
