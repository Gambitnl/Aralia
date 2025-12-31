// [Architect] Extracted from src/utils/character/ to separate concerns
import { PlayerCharacter } from '../../types';
import { ALL_RACES_DATA as RACES_DATA, RACE_DATA_BUNDLE } from '../../data/races';

const {
  dragonbornAncestries: DRAGONBORN_ANCESTRIES,
  goliathGiantAncestries: GIANT_ANCESTRIES,
  tieflingLegacies: TIEFLING_LEGACIES,
} = RACE_DATA_BUNDLE;

/**
 * DraconicAncestryInfo type definition to satisfy type safety in the switch case.
 */
interface DraconicAncestryInfo {
    id: string;
    type: string;
    damageType: string;
    breathWeapon: string;
    description: string;
}

/**
 * Generates a descriptive race display string for a character.
 * e.g., "Drow Elf", "Black Dragonborn", "Stone Goliath", "Human".
 * @param {PlayerCharacter} character - The player character object.
 * @returns {string} The formatted race display string.
 */
export function getCharacterRaceDisplayString(character: PlayerCharacter): string {
  const { race, racialSelections } = character;

  if (!race) return 'Unknown Race';

  const getSelectionName = <T extends { id: string }>(
    data: T[] | undefined,
    id: string | undefined,
    nameKey: keyof T,
    suffixToRemove: string
  ): string | null => {
    if (!id || !data) return null;
    const found = data.find(item => item.id === id);
    const value = found ? found[nameKey] : null;
    if (typeof value === 'string') {
        return value.replace(suffixToRemove, '').trim();
    }
    return null;
  }

  switch (race.id) {
    case 'elf': {
      const lineageName = getSelectionName(RACES_DATA.elf?.elvenLineages, racialSelections?.['elf']?.choiceId, 'name', 'Lineage');
      return lineageName ? `${lineageName}` : race.name;
    }
    case 'dragonborn': {
      const ancestryId = racialSelections?.['dragonborn']?.choiceId;
      const ancestry = ancestryId ? (DRAGONBORN_ANCESTRIES as Record<string, DraconicAncestryInfo>)[ancestryId] : null;
      return ancestry ? `${ancestry.type} ${race.name}` : race.name;
    }
    case 'gnome': {
      const subraceName = getSelectionName(RACES_DATA.gnome?.gnomeSubraces, racialSelections?.['gnome']?.choiceId, 'name', '');
      return subraceName ? subraceName : race.name;
    }
    case 'goliath': {
      // GIANT_ANCESTRIES has 'id' like 'Fire', 'Stone', and 'name' like 'Fire Giant Ancestry'
      // The original code used 'id' for the display name prefix (e.g. "Fire Goliath").
      const ancestryName = getSelectionName(GIANT_ANCESTRIES, racialSelections?.['goliath']?.choiceId, 'id', '');
      return ancestryName ? `${ancestryName} ${race.name}` : race.name;
    }
    case 'tiefling': {
      const legacyName = getSelectionName(TIEFLING_LEGACIES, racialSelections?.['tiefling']?.choiceId, 'name', 'Legacy');
      return legacyName ? `${legacyName} ${race.name}` : race.name;
    }
    default:
      return race.name;
  }
}
