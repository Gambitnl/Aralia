// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:50
 * Dependents: PreviewCombatSandbox.tsx
 * Imports: 10 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file quickCharacterGenerator.ts
 * Creates complete PlayerCharacter objects from minimal inputs for the Combat Sandbox.
 * This bypasses the full character creator for quick testing scenarios.
 */

// Use same import pattern as combatUtils.ts
import { PlayerCharacter } from '../../types';
import type { AbilityScores, AbilityScoreName, Skill } from '../../types/core';
import type { Class, Race } from '../../types/character';
import type { CombatCharacter } from '../../types/combat';
import { CLASSES_DATA } from '../../data/classes';
import { ALL_RACES_DATA } from '../../data/races';
import { createPlayerCombatCharacter } from '../combat/combatUtils';
import { SKILLS_DATA } from '../../data/skills';
import { getAbilityModifierValue } from '../character/statUtils';
import { buildHitPointDicePools } from '../character/characterUtils';

// ============================================================================
// Configuration Types
// ============================================================================

export interface QuickCharacterConfig {
    name?: string;
    raceId: string;
    classId: string;
    level: number;
    /** Point-buy style stats: [Str, Dex, Con, Int, Wis, Cha] */
    stats?: [number, number, number, number, number, number];
    /** Use class-recommended stat priorities if stats not provided */
    useRecommendedStats?: boolean;
}

// ============================================================================
// Stat Generation
// ============================================================================

const STANDARD_ARRAY: [number, number, number, number, number, number] = [15, 14, 13, 12, 10, 8];

const STAT_KEYS: AbilityScoreName[] = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

function buildAbilityScores(
    stats: [number, number, number, number, number, number],
    charClass: Class,
    race: Race
): { base: AbilityScores; final: AbilityScores } {
    // If using recommended priorities, rearrange standard array
    let orderedStats = stats;
    if (charClass.recommendedPointBuyPriorities) {
        orderedStats = [...STANDARD_ARRAY] as [number, number, number, number, number, number];
        // Sort standard array by class priorities
        const priorityMap = new Map(charClass.recommendedPointBuyPriorities.map((p, i) => [p, i]));
        const sortedStats = [...STANDARD_ARRAY].sort((a, b) => b - a); // Highest first

        orderedStats = STAT_KEYS.map(key => {
            const priorityIndex = priorityMap.get(key) ?? 5;
            return sortedStats[priorityIndex];
        }) as [number, number, number, number, number, number];
    }

    const base: AbilityScores = {
        Strength: orderedStats[0],
        Dexterity: orderedStats[1],
        Constitution: orderedStats[2],
        Intelligence: orderedStats[3],
        Wisdom: orderedStats[4],
        Charisma: orderedStats[5],
    };

    // Apply racial bonuses (simplified - just +2/+1 to first two stats if no bonuses defined)
    const final = { ...base };
    if (race.abilityBonuses && race.abilityBonuses.length > 0) {
        for (const bonus of race.abilityBonuses) {
            if (bonus.ability === 'Any') {
                continue;
            }
            final[bonus.ability] = (final[bonus.ability] || 10) + bonus.bonus;
        }
    } else {
        // Default: +2 to primary ability, +1 to secondary
        const primaryAbility = charClass.primaryAbility?.[0];
        if (primaryAbility) {
            final[primaryAbility] = (final[primaryAbility] || 10) + 2;
        }
        // +1 to Constitution if not already boosted
        if (primaryAbility !== 'Constitution') {
            final.Constitution = (final.Constitution || 10) + 1;
        }
    }

    return { base, final };
}

// ============================================================================
// HP Calculation
// ============================================================================

function calculateMaxHp(level: number, hitDie: number, conMod: number): number {
    // Level 1: max hit die + con mod
    // Subsequent levels: average hit die + con mod (simulated)
    const firstLevelHp = hitDie + conMod;
    const avgHitDie = Math.floor(hitDie / 2) + 1;
    const subsequentLevelsHp = Math.max(0, level - 1) * (avgHitDie + conMod);
    return Math.max(1, firstLevelHp + subsequentLevelsHp);
}

// ============================================================================
// Skills Generation
// ============================================================================

function generateSkills(charClass: Class, finalScores: AbilityScores): Skill[] {
    const allSkills = Object.values(SKILLS_DATA);
    const proficientSkillIds = charClass.skillProficienciesAvailable?.slice(0, charClass.numberOfSkillProficiencies || 2) || [];

    return allSkills.map(skill => ({
        ...skill,
        proficient: proficientSkillIds.includes(skill.id),
        modifier: getAbilityModifierValue(finalScores[skill.ability] || 10),
    }));
}

// ============================================================================
// Main Generator
// ============================================================================

export function createQuickCharacter(config: QuickCharacterConfig): PlayerCharacter | null {
    const charClass = CLASSES_DATA[config.classId];
    const race = ALL_RACES_DATA[config.raceId];

    if (!charClass || !race) {
        console.error(`Invalid class or race: ${config.classId}, ${config.raceId}`);
        return null;
    }

    // Build ability scores
    const inputStats = config.stats || (config.useRecommendedStats ? undefined : STANDARD_ARRAY);
    const { base, final } = buildAbilityScores(
        inputStats || STANDARD_ARRAY,
        charClass,
        race
    );

    const conMod = getAbilityModifierValue(final.Constitution);
    const dexMod = getAbilityModifierValue(final.Dexterity);
    const maxHp = calculateMaxHp(config.level, charClass.hitDie, conMod);
    const proficiencyBonus = 2 + Math.floor((config.level - 1) / 4);

    // Basic armor class (10 + Dex, or class feature if applicable)
    const baseAc = charClass.id === 'monk' || charClass.id === 'barbarian'
        ? 10 + dexMod + getAbilityModifierValue(charClass.id === 'monk' ? final.Wisdom : final.Constitution)
        : 10 + dexMod;

    const skills = generateSkills(charClass, final);

    // Determine spellcasting ability
    let spellcastingAbility: 'intelligence' | 'wisdom' | 'charisma' | undefined;
    if (charClass.spellcasting?.ability) {
        spellcastingAbility = charClass.spellcasting.ability.toLowerCase() as 'intelligence' | 'wisdom' | 'charisma';
    }

    // Track per-class levels to derive correct Hit Dice pools.
    const classLevels = { [charClass.id]: config.level };
    const character: PlayerCharacter = {
        id: `quick-${config.classId}-${config.level}`,
        name: config.name || `Test ${charClass.name}`,
        level: config.level,
        xp: 0,
        proficiencyBonus,
        race,
        class: charClass,
        classLevels,
        abilityScores: base,
        finalAbilityScores: final,
        skills,
	        savingThrowProficiencies: charClass.savingThrowProficiencies,
	        hp: maxHp,
	        maxHp,
	        // Hit Dice pools are computed after assembly to include class levels.
	        hitPointDice: undefined,
	        armorClass: baseAc,
	        speed: race.id === 'dwarf' || race.id === 'gnome' ? 25 : 30,
	        darkvisionRange: race.traits?.some(t => t.toLowerCase().includes('darkvision')) ? 60 : 0,
	        transportMode: 'foot',
        spellcastingAbility,
        statusEffects: [],
        equippedItems: {},
        spellbook: charClass.spellcasting ? {
            cantrips: charClass.spellcasting.spellList?.slice(0, charClass.spellcasting.knownCantrips) || [],
            knownSpells: charClass.spellcasting.spellList?.slice(charClass.spellcasting.knownCantrips, charClass.spellcasting.knownCantrips + (charClass.spellcasting.knownSpellsL1 || 0)) || [],
            preparedSpells: [],
        } : undefined,
    };
    character.hitPointDice = buildHitPointDicePools(character, { classLevels });

    return character;
}

// ============================================================================
// Convert to CombatCharacter
// ============================================================================

export function createQuickCombatCharacter(
    config: QuickCharacterConfig,
    allSpells: Record<string, unknown> = {}
): CombatCharacter | null {
    const playerChar = createQuickCharacter(config);
    if (!playerChar) return null;

    return createPlayerCombatCharacter(playerChar, allSpells as Record<string, any>);
}

// ============================================================================
// Available Options (for UI dropdowns)
// ============================================================================

export const AVAILABLE_CLASS_IDS = Object.keys(CLASSES_DATA);
export const AVAILABLE_RACE_IDS = Object.keys(ALL_RACES_DATA);

export function getClassDisplayName(classId: string): string {
    return CLASSES_DATA[classId]?.name || classId;
}

export function getRaceDisplayName(raceId: string): string {
    return ALL_RACES_DATA[raceId]?.name || raceId;
}
