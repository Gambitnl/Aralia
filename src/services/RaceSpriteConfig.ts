/**
 * @file RaceSpriteConfig.ts
 * Maps races to their visual sprite families for the character creator preview.
 *
 * ARCHITECTURE:
 * The character preview in Step 4 (Appearance) composites multiple sprite layers
 * to build a full character image. This config tells the system WHICH sprite
 * assets to load for each race.
 *
 * VISUAL FAMILIES:
 * Races are grouped into "visual families" — races that share the same body
 * proportions and can use the same base sprite. For example, all elven sub-races
 * share the "elf" visual family because they have the same body shape (just
 * different skin tones / lore).
 *
 * SPRITE TYPES:
 * 1. LAYERED races — humanoid-proportioned races where the existing clothing
 *    and hair sprite layers align correctly on top of a race-specific skin sprite.
 *    These races only need a custom "body" sprite; hair + clothing are overlaid.
 *
 * 2. COMPOSITE races — non-humanoid races (dragonborn, goblin, aarakocra, etc.)
 *    where body proportions differ so much that standard clothing/hair layers
 *    don't align. These get a single complete character sprite per gender.
 *
 * HOW TO ADD A NEW RACE'S SPRITES:
 *   1. Generate the sprite image(s) and save to public/assets/images/race-sprites/
 *   2. Add the race's visual family entry below
 *   3. Map the race ID to the family in RACE_TO_FAMILY
 *
 * Depends on: nothing (pure data config)
 * Used by: VisualsSelection.tsx
 */

// ============================================================================
// Types
// ============================================================================

/**
 * How the sprite is rendered in the preview:
 *   layered   = race-specific skin + standard clothing + standard hair
 *   composite = single complete character image (no layering)
 */
export type SpriteMode = 'layered' | 'composite';

export interface RaceVisualFamily {
    /** Unique family ID (e.g. 'elf', 'dragonborn', 'goblin') */
    id: string;

    /** Display label for this family */
    label: string;

    /** Whether this family uses layered or composite sprites */
    mode: SpriteMode;

    /**
     * For LAYERED mode: paths to race-specific skin sprites.
     * These replace the default human skin layer. The clothing/hair layers
     * still overlay on top.
     * Key format: "Male" | "Female" → skin variant number → path
     *
     * For COMPOSITE mode: paths to complete character sprites.
     * Key format: "Male" | "Female" → path
     * Skin/hair/clothing options are cosmetic only (stored in state but not
     * visually reflected).
     */
    sprites: {
        Male: string;
        Female: string;
    };

    /**
     * Optional: available skin tone variants for layered mode.
     * If provided, the skin tone selector cycles through these instead
     * of the default human tones. Each entry maps a tone index to a path.
     */
    skinVariants?: {
        Male: Record<number, string>;
        Female: Record<number, string>;
    };
}

// ============================================================================
// Asset base path — all race sprites live under this public directory
// ============================================================================
const RACE_SPRITE_DIR = 'assets/images/race-sprites';

/** Helper to build a full asset path for race sprites */
function raceSprite(filename: string): string {
    return `${RACE_SPRITE_DIR}/${filename}`;
}

// ============================================================================
// Visual Family Definitions
// ============================================================================
// Each family defines the sprite(s) used by all races in that family.
// Races with 'composite' mode get a single character image per gender.
// Races with 'layered' mode get a skin layer that clothing/hair overlay on.
// ============================================================================

export const VISUAL_FAMILIES: Record<string, RaceVisualFamily> = {
    // ----- Standard humanoid (uses the existing sprite system as-is) -----
    human: {
        id: 'human',
        label: 'Human',
        mode: 'layered',
        sprites: {
            Male: raceSprite('human_male.png'),
            Female: raceSprite('human_female.png'),
        },
    },

    // ----- Elves — same body proportions as human but with pointed ears -----
    elf: {
        id: 'elf',
        label: 'Elf',
        mode: 'layered',
        sprites: {
            Male: raceSprite('elf_male.png'),
            Female: raceSprite('elf_female.png'),
        },
    },

    // ----- Drow — dark-skinned elves -----
    drow: {
        id: 'drow',
        label: 'Drow',
        mode: 'layered',
        sprites: {
            Male: raceSprite('drow_male.png'),
            Female: raceSprite('drow_female.png'),
        },
    },

    // ----- Dwarves — shorter, stockier build -----
    dwarf: {
        id: 'dwarf',
        label: 'Dwarf',
        mode: 'composite',
        sprites: {
            Male: raceSprite('dwarf_male.png'),
            Female: raceSprite('dwarf_female.png'),
        },
    },

    // ----- Halflings — very short -----
    halfling: {
        id: 'halfling',
        label: 'Halfling',
        mode: 'composite',
        sprites: {
            Male: raceSprite('halfling_male.png'),
            Female: raceSprite('halfling_female.png'),
        },
    },

    // ----- Orcs / Half-Orcs — muscular, green-ish skin, tusks -----
    orc: {
        id: 'orc',
        label: 'Orc',
        mode: 'layered',
        sprites: {
            Male: raceSprite('orc_male.png'),
            Female: raceSprite('orc_female.png'),
        },
    },

    // ----- Greenskins (goblin) — small, green, huge ears -----
    goblin: {
        id: 'goblin',
        label: 'Goblin',
        mode: 'composite',
        sprites: {
            Male: raceSprite('goblin_male.png'),
            Female: raceSprite('goblin_female.png'),
        },
    },

    // ----- Hobgoblin — larger than goblin, orange-brown -----
    hobgoblin: {
        id: 'hobgoblin',
        label: 'Hobgoblin',
        mode: 'composite',
        sprites: {
            Male: raceSprite('hobgoblin_male.png'),
            Female: raceSprite('hobgoblin_female.png'),
        },
    },

    // ----- Bugbear — hulking, furry -----
    bugbear: {
        id: 'bugbear',
        label: 'Bugbear',
        mode: 'composite',
        sprites: {
            Male: raceSprite('bugbear_male.png'),
            Female: raceSprite('bugbear_female.png'),
        },
    },

    // ----- Dragonborn — reptilian head, scaled body -----
    dragonborn: {
        id: 'dragonborn',
        label: 'Dragonborn',
        mode: 'composite',
        sprites: {
            Male: raceSprite('dragonborn_male.png'),
            Female: raceSprite('dragonborn_female.png'),
        },
    },

    // ----- Tiefling — horns, tail, infernal features -----
    tiefling: {
        id: 'tiefling',
        label: 'Tiefling',
        mode: 'layered',
        sprites: {
            Male: raceSprite('tiefling_male.png'),
            Female: raceSprite('tiefling_female.png'),
        },
    },

    // ----- Aasimar — celestial glow, angelic features -----
    aasimar: {
        id: 'aasimar',
        label: 'Aasimar',
        mode: 'layered',
        sprites: {
            Male: raceSprite('aasimar_male.png'),
            Female: raceSprite('aasimar_female.png'),
        },
    },

    // ----- Gnome — small, big nose -----
    gnome: {
        id: 'gnome',
        label: 'Gnome',
        mode: 'composite',
        sprites: {
            Male: raceSprite('gnome_male.png'),
            Female: raceSprite('gnome_female.png'),
        },
    },

    // ----- Goliath — very tall, grey skin -----
    goliath: {
        id: 'goliath',
        label: 'Goliath',
        mode: 'layered',
        sprites: {
            Male: raceSprite('goliath_male.png'),
            Female: raceSprite('goliath_female.png'),
        },
    },

    // ----- Genasi — elemental-touched humanoid -----
    genasi: {
        id: 'genasi',
        label: 'Genasi',
        mode: 'layered',
        sprites: {
            Male: raceSprite('genasi_male.png'),
            Female: raceSprite('genasi_female.png'),
        },
    },

    // ----- Tabaxi — cat-folk -----
    tabaxi: {
        id: 'tabaxi',
        label: 'Tabaxi',
        mode: 'composite',
        sprites: {
            Male: raceSprite('tabaxi_male.png'),
            Female: raceSprite('tabaxi_female.png'),
        },
    },

    // ----- Kenku — crow-folk -----
    kenku: {
        id: 'kenku',
        label: 'Kenku',
        mode: 'composite',
        sprites: {
            Male: raceSprite('kenku_male.png'),
            Female: raceSprite('kenku_female.png'),
        },
    },

    // ----- Warforged — mechanical construct -----
    warforged: {
        id: 'warforged',
        label: 'Warforged',
        mode: 'composite',
        sprites: {
            Male: raceSprite('warforged_male.png'),
            Female: raceSprite('warforged_female.png'),
        },
    },

    // ----- Firbolg — gentle giant, fey-touched -----
    firbolg: {
        id: 'firbolg',
        label: 'Firbolg',
        mode: 'layered',
        sprites: {
            Male: raceSprite('firbolg_male.png'),
            Female: raceSprite('firbolg_female.png'),
        },
    },

    // ----- Lizardfolk — reptilian -----
    lizardfolk: {
        id: 'lizardfolk',
        label: 'Lizardfolk',
        mode: 'composite',
        sprites: {
            Male: raceSprite('lizardfolk_male.png'),
            Female: raceSprite('lizardfolk_female.png'),
        },
    },

    // ----- Aarakocra — bird-folk -----
    aarakocra: {
        id: 'aarakocra',
        label: 'Aarakocra',
        mode: 'composite',
        sprites: {
            Male: raceSprite('aarakocra_male.png'),
            Female: raceSprite('aarakocra_female.png'),
        },
    },

    // ----- Shifter — beast-touched humanoid -----
    shifter: {
        id: 'shifter',
        label: 'Shifter',
        mode: 'layered',
        sprites: {
            Male: raceSprite('shifter_male.png'),
            Female: raceSprite('shifter_female.png'),
        },
    },

    // ----- Half-Elf — blend of human and elf -----
    half_elf: {
        id: 'half_elf',
        label: 'Half-Elf',
        mode: 'layered',
        sprites: {
            Male: raceSprite('half_elf_male.png'),
            Female: raceSprite('half_elf_female.png'),
        },
    },

    // ----- Eladrin — seasonal fey elves -----
    eladrin: {
        id: 'eladrin',
        label: 'Eladrin',
        mode: 'layered',
        sprites: {
            Male: raceSprite('eladrin_male.png'),
            Female: raceSprite('eladrin_female.png'),
        },
    },

    // ----- Gith — githyanki/githzerai -----
    gith: {
        id: 'gith',
        label: 'Gith',
        mode: 'layered',
        sprites: {
            Male: raceSprite('gith_male.png'),
            Female: raceSprite('gith_female.png'),
        },
    },

    // ----- Changeling — blank/featureless humanoid -----
    changeling: {
        id: 'changeling',
        label: 'Changeling',
        mode: 'layered',
        sprites: {
            Male: raceSprite('changeling_male.png'),
            Female: raceSprite('changeling_female.png'),
        },
    },

    // ----- Minotaur — bull-headed humanoid -----
    minotaur: {
        id: 'minotaur',
        label: 'Minotaur',
        mode: 'composite',
        sprites: {
            Male: raceSprite('minotaur_male.png'),
            Female: raceSprite('minotaur_female.png'),
        },
    },

    // ----- Centaur — horse body -----
    centaur: {
        id: 'centaur',
        label: 'Centaur',
        mode: 'composite',
        sprites: {
            Male: raceSprite('centaur_male.png'),
            Female: raceSprite('centaur_female.png'),
        },
    },

    // ----- Fairy — tiny, winged -----
    fairy: {
        id: 'fairy',
        label: 'Fairy',
        mode: 'composite',
        sprites: {
            Male: raceSprite('fairy_male.png'),
            Female: raceSprite('fairy_female.png'),
        },
    },

    // ----- Satyr — goat legs, horns -----
    satyr: {
        id: 'satyr',
        label: 'Satyr',
        mode: 'composite',
        sprites: {
            Male: raceSprite('satyr_male.png'),
            Female: raceSprite('satyr_female.png'),
        },
    },

    // ----- Kobold — tiny draconic -----
    kobold: {
        id: 'kobold',
        label: 'Kobold',
        mode: 'composite',
        sprites: {
            Male: raceSprite('kobold_male.png'),
            Female: raceSprite('kobold_female.png'),
        },
    },
};

// ============================================================================
// Race ID → Visual Family Mapping
// ============================================================================
// Maps every race.id to its visual family. Sub-races inherit their parent
// family's sprites. This is the core lookup table that VisualsSelection uses.
// ============================================================================

export const RACE_TO_FAMILY: Record<string, string> = {
    // ----- Humans -----
    human: 'human',
    beastborn_human: 'human',
    forgeborn_human: 'human',
    guardian_human: 'human',
    wayfarer_human: 'human',

    // ----- Elves -----
    elf: 'elf',
    high_elf: 'elf',
    wood_elf: 'elf',
    astral_elf: 'elf',
    sea_elf: 'elf',
    pallid_elf: 'elf',
    shadar_kai: 'elf',
    shadowveil_elf: 'elf',

    // ----- Drow -----
    drow: 'drow',

    // ----- Half-Elves -----
    half_elf: 'half_elf',
    half_elf_aquatic: 'half_elf',
    half_elf_drow: 'half_elf',
    half_elf_high: 'half_elf',
    half_elf_wood: 'half_elf',
    seersight_half_elf: 'half_elf',
    stormborn_half_elf: 'half_elf',

    // ----- Eladrin -----
    eladrin: 'eladrin',
    spring_eladrin: 'eladrin',
    summer_eladrin: 'eladrin',
    autumn_eladrin: 'eladrin',
    winter_eladrin: 'eladrin',

    // ----- Dwarves -----
    hill_dwarf: 'dwarf',
    mountain_dwarf: 'dwarf',
    duergar: 'dwarf',
    runeward_dwarf: 'dwarf',

    // ----- Gnomes -----
    rock_gnome: 'gnome',
    forest_gnome: 'gnome',
    deep_gnome: 'gnome',
    wordweaver_gnome: 'gnome',

    // ----- Halflings -----
    halfling: 'halfling',
    lightfoot_halfling: 'halfling',
    stout_halfling: 'halfling',
    lotusden_halfling: 'halfling',
    hearthkeeper_halfling: 'halfling',
    mender_halfling: 'halfling',

    // ----- Orcs & Half-Orcs -----
    orc: 'orc',
    half_orc: 'orc',
    pathfinder_half_orc: 'orc',

    // ----- Greenskins -----
    goblin: 'goblin',
    hobgoblin: 'hobgoblin',
    bugbear: 'bugbear',
    verdan: 'goblin',

    // ----- Dragonborn / Draconic -----
    dragonborn: 'dragonborn',
    black_dragonborn: 'dragonborn',
    blue_dragonborn: 'dragonborn',
    brass_dragonborn: 'dragonborn',
    bronze_dragonborn: 'dragonborn',
    copper_dragonborn: 'dragonborn',
    gold_dragonborn: 'dragonborn',
    green_dragonborn: 'dragonborn',
    red_dragonborn: 'dragonborn',
    silver_dragonborn: 'dragonborn',
    white_dragonborn: 'dragonborn',
    draconblood_dragonborn: 'dragonborn',
    ravenite_dragonborn: 'dragonborn',
    kobold: 'kobold',

    // ----- Tieflings -----
    tiefling: 'tiefling',
    abyssal_tiefling: 'tiefling',
    chthonic_tiefling: 'tiefling',
    infernal_tiefling: 'tiefling',

    // ----- Aasimar -----
    protector_aasimar: 'aasimar',
    scourge_aasimar: 'aasimar',
    fallen_aasimar: 'aasimar',

    // ----- Genasi -----
    air_genasi: 'genasi',
    earth_genasi: 'genasi',
    fire_genasi: 'genasi',
    water_genasi: 'genasi',

    // ----- Goliath -----
    goliath: 'goliath',
    cloud_giant_goliath: 'goliath',
    fire_giant_goliath: 'goliath',
    frost_giant_goliath: 'goliath',
    hill_giant_goliath: 'goliath',
    stone_giant_goliath: 'goliath',
    storm_giant_goliath: 'goliath',

    // ----- Shifters -----
    beasthide_shifter: 'shifter',
    longtooth_shifter: 'shifter',
    swiftstride_shifter: 'shifter',
    wildhunt_shifter: 'shifter',

    // ----- Beast-folk -----
    tabaxi: 'tabaxi',
    kenku: 'kenku',
    lizardfolk: 'lizardfolk',
    aarakocra: 'aarakocra',
    minotaur: 'minotaur',
    centaur: 'centaur',
    leonin: 'tabaxi', // Lion-folk → cat-folk family
    loxodon: 'goliath', // Elephant-folk → big humanoid
    hadozee: 'shifter', // Monkey-folk → beast-touched
    harengon: 'halfling', // Rabbit-folk → small humanoid
    giff: 'goliath', // Hippo-folk → big humanoid
    tortle: 'lizardfolk', // Turtle-folk → reptilian
    thri_kreen: 'kenku', // Insect-folk → non-humanoid
    yuan_ti: 'lizardfolk', // Snake-folk → reptilian

    // ----- Fey -----
    fairy: 'fairy',
    firbolg: 'firbolg',
    satyr: 'satyr',

    // ----- Gith -----
    githyanki: 'gith',
    githzerai: 'gith',

    // ----- Shapeshifters / Constructs -----
    changeling: 'changeling',
    warforged: 'warforged',
    autognome: 'warforged', // Mechanical gnome → constructed
    plasmoid: 'changeling', // Amorphous → shapeshifter

    // ----- Planar Travelers -----
    kalashtar: 'human', // Psionic human
    kender: 'halfling',
    simic_hybrid: 'human',
    triton: 'elf', // Aquatic elf-like
    vedalken: 'elf', // Blue-skinned elf-like

    // ----- Lineages -----
    lineage_dhampir: 'human',
    lineage_hexblood: 'human',
    lineage_reborn: 'human',
};

// ============================================================================
// Lookup Helper
// ============================================================================

/**
 * Gets the visual family config for a given race ID.
 * Falls back to 'human' if the race isn't mapped (safest default).
 */
export function getVisualFamily(raceId: string | null | undefined): RaceVisualFamily {
    if (!raceId) return VISUAL_FAMILIES['human'];

    const familyId = RACE_TO_FAMILY[raceId] ?? 'human';
    return VISUAL_FAMILIES[familyId] ?? VISUAL_FAMILIES['human'];
}

/**
 * Resolves the full URL to a race sprite image.
 * Prepends the Vite base URL for correct asset serving.
 */
export function resolveRaceSpritePath(relativePath: string): string {
    const base = import.meta.env.BASE_URL || '/';
    return `${base}${relativePath}`;
}
