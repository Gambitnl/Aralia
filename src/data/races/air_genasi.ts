
/**
 * @file air_genasi.ts
 * Defines the data for the Air Genasi race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 16.
 * This includes their ID, name, description, and unique traits.
 * ASIs are handled flexibly during character creation, not as fixed racial bonuses.
 */
import { Race } from '../../types.ts'; // Path relative to src/data/races/

// DATA FOR AIR GENASI
export const AIR_GENASI_DATA: Race = {
  id: 'air_genasi',
  name: 'Air Genasi',
  description:
    "Air genasi are descended from djinn, the genies of the Elemental Plane of Air. Embodying many of the airy traits of their otherworldly ancestors, air genasi can draw upon their connection to the winds. Their skin tones include many shades of blue, along with the full range of human skin tones, with bluish or ashen casts. Sometimes their skin is marked by lines that seem like cracks with bluish-white energy spilling out. An air genasi’s hair might blow in a phantom wind or be made entirely of clouds or vapor. A typical genasi has a life span of 120 years.",
  abilityBonuses: [], // Flexible ASIs: "increase one score by 2 and increase a different score by 1, or increase three different scores by 1." - handled in AbilityScoreAllocation step.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small (You choose when you select this race; defaults to Medium for now).',
    'Speed: 35 feet',
    'Darkvision: 60 feet',
    'Unending Breath: You can hold your breath indefinitely while you’re not incapacitated.',
    'Lightning Resistance: You have resistance to lightning damage.',
    // The string for this trait is parsed by RaceDetailModal.tsx to create a spell progression table.
    'Mingle with the Wind: You know the Shocking Grasp cantrip. Starting at 3rd level, you can cast the Feather Fall spell with this trait, without requiring a material component. Starting at 5th level, you can also cast the Levitate spell with this trait, without requiring a material component. Once you cast Feather Fall or Levitate with this trait, you can’t cast that spell with it again until you finish a Long Rest. You can also cast either of those spells using any spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells when you cast them with this trait (choose when you select this race).',
  ],
  imageUrl: 'https://i.ibb.co/HT3Vq8DY/Air-Genasi.png',
  racialSpellChoice: {
    traitName: 'Mingle with the Wind',
    traitDescription: 'Choose your spellcasting ability for Mingle with the Wind (Shocking Grasp, Feather Fall, Levitate).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'shocking-grasp' },
    { minLevel: 3, spellId: 'feather-fall' },
    { minLevel: 5, spellId: 'levitate' }
  ]
};
