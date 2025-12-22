
import { Temple, TempleService } from '../../types';

const STANDARD_SERVICES: Record<string, TempleService> = {
  BLESSING_MINOR: {
    id: 'blessing_minor',
    name: 'Minor Blessing',
    description: 'A brief prayer for guidance.',
    costGp: 5,
    minFavor: 0,
    effect: 'grant_blessing_minor'
  },
  HEALING_LIGHT: {
    id: 'healing_light',
    name: 'Healing Light',
    description: 'Restores 20 HP and cures non-magical diseases.',
    costGp: 50,
    minFavor: 10,
    effect: 'restore_hp_full'
  },
  REMOVE_CURSE: {
    id: 'remove_curse',
    name: 'Ritual of Cleansing',
    description: 'Attempts to remove a curse.',
    costGp: 150,
    minFavor: 30,
    effect: 'remove_curse'
  },
  DIVINE_INTERVENTION: {
    id: 'divine_intervention',
    name: 'Petition for Intervention',
    description: 'A desperate plea for direct aid.',
    costGp: 1000,
    minFavor: 90,
    effect: 'Divine Intervention'
  }
};

export const TEMPLES: Temple[] = [
  {
    id: 'temple_bahamut_generic',
    deityId: 'bahamut',
    name: 'Sanctuary of the Platinum Dragon',
    locationId: 'generic_city',
    description: 'A grand cathedral with platinum-inlaid statues. Paladins stand guard.',
    services: [
      STANDARD_SERVICES.BLESSING_MINOR,
      STANDARD_SERVICES.HEALING_LIGHT,
      {
        id: 'scales_of_justice',
        name: 'Scales of Justice',
        description: 'Grants advantage on Insight checks for 24 hours.',
        costGp: 25,
        minFavor: 20,
        effect: 'grant_blessing_scales_of_justice'
      }
    ]
  },
  {
    id: 'temple_moradin_generic',
    deityId: 'moradin',
    name: 'The Soul Forge',
    locationId: 'generic_mountain',
    description: 'A temple built into the mountain rock, echoing with the sound of hammers.',
    services: [
      STANDARD_SERVICES.BLESSING_MINOR,
      {
        id: 'artisans_blessing',
        name: 'Artisan\'s Blessing',
        description: 'Blesses a crafting attempt or repair.',
        costGp: 40,
        minFavor: 10,
        effect: 'grant_blessing_artisans_touch'
      }
    ]
  },
  {
    id: 'shrine_pelor_generic',
    deityId: 'pelor',
    name: 'Sun Shrine',
    locationId: 'generic_village',
    description: 'An open-air shrine facing the sunrise.',
    services: [
      STANDARD_SERVICES.BLESSING_MINOR,
      STANDARD_SERVICES.HEALING_LIGHT,
      STANDARD_SERVICES.REMOVE_CURSE
    ]
  },
  {
    id: 'crypt_raven_queen_generic',
    deityId: 'raven_queen',
    name: 'House of Silence',
    locationId: 'generic_graveyard',
    description: 'A somber mausoleum where the dead are prepared for their journey.',
    services: [
      {
        id: 'last_rites',
        name: 'Last Rites',
        description: 'Ensures a soul passes safely to the afterlife.',
        costGp: 10,
        minFavor: 0,
        effect: 'Prevent Undeath'
      },
      {
         id: 'speak_with_dead',
         name: 'Séance',
         description: 'Speak with a departed spirit.',
         costGp: 100,
         minFavor: 25,
         effect: 'Spell: Speak with Dead'
      }
    ]
  }
];
