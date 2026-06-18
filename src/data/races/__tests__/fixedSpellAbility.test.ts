import { describe, it, expect, beforeAll } from 'vitest';
import { FALLEN_AASIMAR_DATA } from '../fallen_aasimar';
import { PROTECTOR_AASIMAR_DATA } from '../protector_aasimar';
import { SCOURGE_AASIMAR_DATA } from '../scourge_aasimar';
import { ASTRAL_ELF_DATA } from '../astral_elf';
import {
  buildRacialTraitLibrary,
  setRacialTraitLibraryInstance,
  getRacialSpellCastingAbilityChoicesForRace,
} from '../racialTraits';

/**
 * A racial trait that pins a SINGLE spellcasting ability (e.g. Aasimar Light
 * Bearer: "Charisma is your spellcasting ability for it") is a FIXED assignment,
 * not a choice. It must not surface an ability chooser. Traits that name 2+
 * abilities or say "choose" (e.g. Astral Elf's Astral Fire) still do.
 */
describe('Fixed racial spellcasting ability (no phantom chooser)', () => {
  beforeAll(() => {
    setRacialTraitLibraryInstance(
      buildRacialTraitLibrary({
        fallen_aasimar: FALLEN_AASIMAR_DATA,
        protector_aasimar: PROTECTOR_AASIMAR_DATA,
        scourge_aasimar: SCOURGE_AASIMAR_DATA,
        astral_elf: ASTRAL_ELF_DATA,
      }),
    );
  });

  it.each([
    ['fallen_aasimar'],
    ['protector_aasimar'],
    ['scourge_aasimar'],
  ])('does not offer a spellcasting-ability choice for %s (Light Bearer is fixed Charisma)', (raceId) => {
    expect(getRacialSpellCastingAbilityChoicesForRace(raceId)).toHaveLength(0);
  });

  it('still offers a spellcasting-ability choice for a genuine multi-ability trait (Astral Elf)', () => {
    expect(getRacialSpellCastingAbilityChoicesForRace('astral_elf').length).toBeGreaterThan(0);
  });
});
