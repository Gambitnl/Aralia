// [Architect] Extracted from src/utils/character/ to separate concerns
import { PlayerCharacter, TempPartyMember, AbilityScores } from '../../types';
import { CLASSES_DATA } from '../../data/classes';
import { ALL_RACES_DATA as RACES_DATA } from '../../data/races';
import { calculateFixedRacialBonuses, calculateArmorClass, getAbilityModifierValue } from '../statUtils';

/**
 * Creates a full PlayerCharacter object from a simplified TempPartyMember object.
 * @param {TempPartyMember} tempMember - The temporary member data.
 * @returns {PlayerCharacter} A complete PlayerCharacter object.
 */
export const createPlayerCharacterFromTemp = (tempMember: TempPartyMember): PlayerCharacter => {
  const classData = CLASSES_DATA[tempMember.classId] || CLASSES_DATA['fighter'];
  const raceData = RACES_DATA['human']; // Default to Human for simplicity
  const baseAbilityScores: AbilityScores = { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 };
  const finalAbilityScores = calculateFixedRacialBonuses(baseAbilityScores, raceData);
  const maxHp = classData.hitDie + getAbilityModifierValue(finalAbilityScores.Constitution);

  const newChar: PlayerCharacter = {
    id: tempMember.id,
    name: `${classData.name} ${tempMember.level}`,
    level: tempMember.level,
    xp: 0,
    race: raceData,
    class: classData,
    abilityScores: baseAbilityScores,
    finalAbilityScores,
    skills: [],
    hp: maxHp,
    maxHp: maxHp,
    armorClass: 10 + getAbilityModifierValue(finalAbilityScores.Dexterity),
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {},
    proficiencyBonus: Math.floor((tempMember.level - 1) / 4) + 2,
  };
  newChar.armorClass = calculateArmorClass(newChar, newChar.activeEffects);
  return newChar;
};
