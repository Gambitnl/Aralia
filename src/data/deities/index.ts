/**
 * @file src/data/deities/index.ts
 * =========================================================================================
 * 🏛️ MYTHKEEPER PROPOSAL: NEW DEITY DATA STRUCTURE
 * =========================================================================================
 *
 * This file represents the proposed new structure for deity data: an Array of Deity objects.
 * This contrasts with the legacy `Record<string, Deity>` found in `src/data/religion.ts`.
 *
 * RATIONALE:
 * - Arrays are easier to iterate over for UI selection lists.
 * - Consistent with `races` and `classes` data structures.
 * - Allows for stricter typing and easier expansion.
 *
 * USAGE:
 * This file is currently imported by `src/utils/religionUtils.ts` and `src/state/appState.ts`,
 * effectively making it the ACTIVE source of truth for the application's runtime.
 * `src/data/religion.ts` appears to be legacy/dead code but contains the original data.
 *
 * =========================================================================================
 */

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
            { targetDeityId: 'moradin', type: 'ally' },
            { targetDeityId: 'tiamat', type: 'enemy' }
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
            { targetDeityId: 'pelor', type: 'ally' },
            { targetDeityId: 'gruumsh', type: 'enemy' }
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
            { targetDeityId: 'lolth', type: 'enemy' },
            { targetDeityId: 'vecna', type: 'enemy' }
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
            { targetDeityId: 'corellon', type: 'enemy' },
            { targetDeityId: 'raven_queen', type: 'enemy' }
        ]
    },
    {
        id: 'corellon',
        name: 'Corellon Larethian',
        titles: ['The Archheart', 'First of the Seldarine'],
        alignment: 'Chaotic Good',
        domains: ['Arcana', 'Light', 'War'],
        symbol: 'Quarter moon or starburst',
        description: 'Corellon is the creator of the elves and the patron of magic, art, music, and warfare.',
        commandments: [
            'Create, inspire, and find beauty in all things.',
            'Vigilantly guard against the spread of evil.',
            'Wander the world and appreciate its wonders.'
        ],
        favoredWeapon: 'Longsword',
        approves: [
            { trigger: 'CAST_SPELL_HIGHEST', description: 'Cast a spell of your highest level', favorChange: 1 },
            { trigger: 'CREATE_ART', description: 'Create a work of art or song', favorChange: 2 },
            { trigger: 'DEFEAT_ORC', description: 'Defeat an orc or follower of Gruumsh', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'DESTROY_ART', description: 'Destroy a work of art or beauty', favorChange: -5 },
            { trigger: 'STAGNATE', description: 'Remain in one place for too long', favorChange: -1 },
            { trigger: 'AID_DROW', description: 'Aid a follower of Lolth', favorChange: -10 }
        ],
        relationships: [
            { targetDeityId: 'lolth', type: 'enemy' },
            { targetDeityId: 'gruumsh', type: 'enemy' },
            { targetDeityId: 'sehanine', type: 'ally' }
        ]
    },
    {
        id: 'gruumsh',
        name: 'Gruumsh',
        titles: ['The Ruiner', 'One-Eye'],
        alignment: 'Chaotic Evil',
        domains: ['Tempest', 'War'],
        symbol: 'Unblinking eye',
        description: 'Gruumsh commands the orc hordes to conquer, pillage, and destroy.',
        commandments: [
            'Conquer and destroy the weak.',
            'Take what you want; strength is the only right.',
            'Kill elves whenever possible.'
        ],
        favoredWeapon: 'Spear',
        approves: [
            { trigger: 'KILL_ELF', description: 'Kill an elf', favorChange: 3 },
            { trigger: 'PILLAGE_SETTLEMENT', description: 'Loot or destroy a settlement', favorChange: 2 },
            { trigger: 'SHOW_STRENGTH', description: 'Intimidate a foe successfully', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'SHOW_MERCY', description: 'Spare an enemy', favorChange: -5 },
            { trigger: 'FLEE_BATTLE', description: 'Flee from combat', favorChange: -10 },
            { trigger: 'MAKE_PEACE', description: 'Negotiate peace with an enemy', favorChange: -8 }
        ],
        relationships: [
            { targetDeityId: 'corellon', type: 'enemy' },
            { targetDeityId: 'moradin', type: 'enemy' }
        ]
    },
    {
        id: 'tiamat',
        name: 'Tiamat',
        titles: ['The Scaled Tyrant', 'Queen of Evil Dragons'],
        alignment: 'Lawful Evil',
        domains: ['Trickery', 'War'],
        symbol: 'Five-headed dragon',
        description: 'Tiamat seeks to conquer the world and enslave all other races to dragonkind.',
        commandments: [
            'Amass wealth and power above all else.',
            'Do not forgive slights; take vengeance.',
            'Dragons are superior; all others serve.'
        ],
        favoredWeapon: 'Scimitar', // Often claws, but scimitar is a common proxy
        approves: [
            { trigger: 'HOARD_WEALTH', description: 'Acquire a large sum of gold', favorChange: 2 },
            { trigger: 'DOMINATE_FOE', description: 'Force an enemy to surrender', favorChange: 2 },
            { trigger: 'KILL_METALLIC_DRAGON', description: 'Defeat a good dragon', favorChange: 10 }
        ],
        forbids: [
            { trigger: 'SHARE_WEALTH', description: 'Give away gold or items', favorChange: -5 },
            { trigger: 'FORGIVE_INSULT', description: 'Let an insult pass unpunished', favorChange: -2 },
            { trigger: 'AID_BAHAMUT', description: 'Aid a follower of Bahamut', favorChange: -10 }
        ],
        relationships: [
            { targetDeityId: 'bahamut', type: 'enemy' },
            { targetDeityId: 'asmodeus', type: 'ally' } // Sometimes tenuous
        ]
    },
    {
        id: 'asmodeus',
        name: 'Asmodeus',
        titles: ['The Lord of the Nine Hells', 'The Archdevil'],
        alignment: 'Lawful Evil',
        domains: ['Knowledge', 'Trickery', 'Order'], // Order is 2024, Trickery/Knowledge classical
        symbol: 'Three inverted triangles',
        description: 'Asmodeus is the supreme ruler of the Nine Hells, a master of contracts, tyranny, and domination.',
        commandments: [
            'Assert dominance through power and intellect.',
            'Honor your contracts, but exploit their wording.',
            'Bring order to the chaos of the world.'
        ],
        favoredWeapon: 'Mace', // Ruby Rod
        approves: [
            { trigger: 'MAKE_CONTRACT', description: 'Forge a binding agreement', favorChange: 2 },
            { trigger: 'SUBJUGATE_CHAOS', description: 'Defeat a chaotic outsider', favorChange: 2 },
            { trigger: 'EXPLOIT_LOOPHOLE', description: 'Gain advantage through technicality', favorChange: 3 }
        ],
        forbids: [
            { trigger: 'BREAK_CONTRACT', description: 'Break a signed agreement', favorChange: -20 },
            { trigger: 'FREE_SLAVE', description: 'Liberate a lawful prisoner', favorChange: -5 },
            { trigger: 'PROMOTE_ANARCHY', description: 'Act in a chaotic, unpredictable manner', favorChange: -5 }
        ],
        relationships: [
            { targetDeityId: 'tiamat', type: 'ally' }
        ]
    },
    {
        id: 'vecna',
        name: 'Vecna',
        titles: ['The Whispered One', 'The Undying King'],
        alignment: 'Neutral Evil',
        domains: ['Knowledge', 'Arcana', 'Death'],
        symbol: 'Hand with eye in palm',
        description: 'Vecna is the god of evil secrets, magic, and hidden knowledge.',
        commandments: [
            'Acquire knowledge, for knowledge is power.',
            'Keep your secrets; reveal nothing to the unworthy.',
            'Death is but a transformation.'
        ],
        favoredWeapon: 'Dagger',
        approves: [
            { trigger: 'LEARN_SECRET', description: 'Uncover a hidden truth or secret', favorChange: 2 },
            { trigger: 'CAST_NECROMANCY', description: 'Cast a necromancy spell', favorChange: 1 },
            { trigger: 'BETRAY_TRUST', description: 'Use a secret to betray someone', favorChange: 3 }
        ],
        forbids: [
            { trigger: 'REVEAL_SECRET', description: 'Reveal a secret without gain', favorChange: -10 },
            { trigger: 'DESTROY_KNOWLEDGE', description: 'Burn a book or destroy lore', favorChange: -20 },
            { trigger: 'SHOW_COMPASSION', description: 'Spare an enemy due to pity', favorChange: -2 }
        ],
        relationships: [
            { targetDeityId: 'raven_queen', type: 'enemy' },
            { targetDeityId: 'ioun', type: 'enemy' }
        ]
    },
    {
        id: 'melora',
        name: 'Melora',
        titles: ['The Wildmother', 'Queen of the Wilderness'],
        alignment: 'Neutral',
        domains: ['Nature', 'Tempest'],
        symbol: 'Spiral pattern',
        description: 'Melora protects the wild places of the world from the encroachment of civilization.',
        commandments: [
            'Protect the wild places from destruction.',
            'Hunt only what you need to survive.',
            'Respect the power of nature.'
        ],
        favoredWeapon: 'Quarterstaff',
        approves: [
            { trigger: 'PROTECT_BEAST', description: 'Save a natural beast', favorChange: 1 },
            { trigger: 'RESTORE_NATURE', description: 'Plant trees or clean corruption', favorChange: 2 },
            { trigger: 'SURVIVE_WILDS', description: 'Travel safely through dangerous terrain', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'SPOIL_NATURE', description: 'Needlessly destroy nature', favorChange: -10 },
            { trigger: 'HUNT_SPORT', description: 'Kill an animal for sport alone', favorChange: -5 },
            { trigger: 'BUILD_CITY', description: 'Establish civilization in wild lands', favorChange: -2 }
        ],
        relationships: [
            { targetDeityId: 'erathis', type: 'rival' },
            { targetDeityId: 'kord', type: 'ally' }
        ]
    },
    {
        id: 'erathis',
        name: 'Erathis',
        titles: ['The Lawbearer', 'Goddess of Civilization'],
        alignment: 'Lawful Neutral',
        domains: ['Knowledge', 'Order'], // Order 2024
        symbol: 'Upper half of a cog',
        description: 'Erathis brings order, law, and civilization to the chaotic world.',
        commandments: [
            'Work with others to achieve shared goals.',
            'Uphold the laws of the land.',
            'Tame the wilderness to make it safe.'
        ],
        favoredWeapon: 'Longsword',
        approves: [
            { trigger: 'ENFORCE_LAW', description: 'Apprehend a criminal', favorChange: 2 },
            { trigger: 'BUILD_STRUCTURE', description: 'Help construct a building', favorChange: 1 },
            { trigger: 'ESTABLISH_ORDER', description: 'Organize a group or settlement', favorChange: 2 }
        ],
        forbids: [
            { trigger: 'BREAK_LAW', description: 'Violate local laws', favorChange: -5 },
            { trigger: 'CAUSE_CHAOS', description: 'Incite a riot or disorder', favorChange: -10 },
            { trigger: 'DESTROY_CIVILIZATION', description: 'Destroy a building or road', favorChange: -5 }
        ],
        relationships: [
            { targetDeityId: 'melora', type: 'rival' },
            { targetDeityId: 'pelor', type: 'ally' }
        ]
    },
    {
        id: 'ioun',
        name: 'Ioun',
        titles: ['The Knowing Mistress', 'Goddess of Knowledge'],
        alignment: 'Neutral',
        domains: ['Knowledge', 'Arcana'],
        symbol: 'Eye within a star',
        description: 'Ioun reveres knowledge, prophecy, and the study of the arcane.',
        commandments: [
            'Seek the truth in all things.',
            'Share knowledge with those who seek it.',
            'Oppose those who would hide or destroy the truth.'
        ],
        favoredWeapon: 'Quarterstaff',
        approves: [
            { trigger: 'DISCOVER_LORE', description: 'Find ancient text or lore', favorChange: 2 },
            { trigger: 'TEACH_OTHERS', description: 'Share knowledge with an NPC', favorChange: 1 },
            { trigger: 'SOLVE_PUZZLE', description: 'Solve a complex riddle', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'DESTROY_BOOK', description: 'Destroy a source of knowledge', favorChange: -10 },
            { trigger: 'SPREAD_LIE', description: 'Knowingly speak a falsehood', favorChange: -2 },
            { trigger: 'HIDE_TRUTH', description: 'Conceal critical information', favorChange: -5 }
        ],
        relationships: [
            { targetDeityId: 'vecna', type: 'enemy' },
            { targetDeityId: 'pelor', type: 'ally' }
        ]
    },
    {
        id: 'kord',
        name: 'Kord',
        titles: ['The Storm Lord', 'Lord of Battle'],
        alignment: 'Chaotic Neutral',
        domains: ['Tempest', 'War'],
        symbol: 'Sword with a lightning bolt crossguard',
        description: 'Kord delights in strength, athletic prowess, and storms.',
        commandments: [
            'Be strong, but do not use your strength for wanton destruction.',
            'Be brave and scorn cowardice in any form.',
            'Prove your might in battle.'
        ],
        favoredWeapon: 'Greatsword',
        approves: [
            { trigger: 'WIN_DUEL', description: 'Win a single combat', favorChange: 2 },
            { trigger: 'FEAT_STRENGTH', description: 'Succeed on a high DC Strength check', favorChange: 1 },
            { trigger: 'BRAVE_STORM', description: 'Endure severe weather without shelter', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'SHOW_COWARDICE', description: 'Flee from a challenge', favorChange: -5 },
            { trigger: 'USE_TRICKERY', description: 'Win through deceit rather than might', favorChange: -2 },
            { trigger: 'DISRESPECT_STORM', description: 'Complain about the weather', favorChange: -1 }
        ],
        relationships: [
            { targetDeityId: 'bahamut', type: 'ally' },
            { targetDeityId: 'melora', type: 'ally' }
        ]
    },
    {
        id: 'sehanine',
        name: 'Sehanine Moonbow',
        titles: ['The Moon Weaver', 'Lady of Dreams'],
        alignment: 'Chaotic Good',
        domains: ['Trickery', 'Twilight'], // Twilight 2024
        symbol: 'Crescent moon',
        description: 'Sehanine watches over lovers, illusions, and those who travel by night.',
        commandments: [
            'Follow your own path; let no one control you.',
            'Seek the hidden beauty in the shadows.',
            'Protect those who love.'
        ],
        favoredWeapon: 'Longbow',
        approves: [
            { trigger: 'USE_ILLUSION', description: 'Successfully deceive with magic', favorChange: 1 },
            { trigger: 'TRAVEL_NIGHT', description: 'Travel under the moonlight', favorChange: 1 },
            { trigger: 'AID_LOVERS', description: 'Help a romantic couple', favorChange: 2 }
        ],
        forbids: [
            { trigger: 'EXPOSE_SECRET', description: 'Reveal a benign secret', favorChange: -2 },
            { trigger: 'HARM_DREAMER', description: 'Attack a sleeping creature', favorChange: -5 },
            { trigger: 'DESTROY_ILLUSION', description: 'Dispel a harmless illusion', favorChange: -1 }
        ],
        relationships: [
            { targetDeityId: 'corellon', type: 'ally' },
            { targetDeityId: 'lolth', type: 'enemy' }
        ]
    },
    {
        id: 'avandra',
        name: 'Avandra',
        titles: ['The Changebringer', 'Lady of Luck'],
        alignment: 'Chaotic Good',
        domains: ['Trickery', 'Freedom'], // Freedom isn't standard 5e domain, maybe Peace/Life/Trickery. Stick to Trickery.
        symbol: 'Woman’s profile, coin',
        description: 'Avandra champions freedom, travel, and adventure.',
        commandments: [
            'Luck favors the bold. Take your fate into your own hands.',
            'Change is inevitable, but righteous change must be fought for.',
            'Defend the freedom of others.'
        ],
        favoredWeapon: 'Rapier', // Or none
        approves: [
            { trigger: 'TAKE_RISK', description: 'Attempt a risky action', favorChange: 1 },
            { trigger: 'FREE_CAPTIVE', description: 'Liberate a prisoner', favorChange: 3 },
            { trigger: 'EXPLORE_NEW', description: 'Visit a new location', favorChange: 1 }
        ],
        forbids: [
            { trigger: 'IMPRISON', description: 'Lock someone up', favorChange: -5 },
            { trigger: 'STIFLE_CHANGE', description: 'Prevent something from changing', favorChange: -2 },
            { trigger: 'PLAY_SAFE', description: 'Avoid adventure', favorChange: -1 }
        ],
        relationships: [
            { targetDeityId: 'melora', type: 'ally' },
            { targetDeityId: 'erathis', type: 'rival' }
        ]
    }
];
