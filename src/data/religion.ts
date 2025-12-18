
/**
 * @file src/data/religion.ts
 * Contains the static data for the religion system, including deities,
 * domains, and temple services.
 *
 * =========================================================================================
 * 🏛️ MYTHKEEPER PROPOSAL FOR REFACTORING
 * =========================================================================================
 *
 * CURRENT STATE:
 * - Data Structure: Record<string, Deity>
 * - Benefits: O(1) lookup by ID.
 * - Drawbacks: Iteration requires Object.values(), less natural for ordered lists (UI).
 *
 * PROPOSED STATE (See src/data/deities/index.ts):
 * - Data Structure: Deity[] (Array of objects)
 * - Benefits:
 *      1. Easier to filter/map/reduce for UI lists (e.g., "Select a Deity").
 *      2. Consistent with other data files (races, classes).
 *      3. Type definitions can be stricter (Deity interface).
 * - Drawbacks: Lookup by ID becomes O(n) (though n is small, ~20).
 *
 * EXPANDED LORE DATA (Ready for implementation):
 *
 * The following deities are fully statted and ready to be added to the system:
 *
 * 1. Bahamut (LG) - Life, War. "Protect the weak."
 * 2. Moradin (LG) - Forge, Knowledge. "Create and defend."
 * 3. Pelor (NG) - Life, Light. "Bring light into darkness."
 * 4. Raven Queen (LN) - Death, Grave. "Destroy the undead."
 * 5. Lolth (CE) - Trickery, War. "Betrayal is a tool."
 * 6. Corellon (CG) - Arcana, Light. "Create beauty."
 * 7. Gruumsh (CE) - Tempest, War. "Conquer and destroy."
 * 8. Tiamat (LE) - Trickery, War. "Amass wealth and power."
 * 9. Vecna (NE) - Knowledge, Death. "Keep secrets."
 * 10. Melora (N) - Nature, Tempest. "Protect the wilds."
 * 11. Erathis (LN) - Knowledge, Order. "Uphold civilization."
 * 12. Ioun (N) - Knowledge, Arcana. "Seek truth."
 * 13. Kord (CN) - Tempest, War. "Prove your might."
 * 14. Sehanine (CG) - Trickery, Twilight. "Follow your own path."
 * 15. Asmodeus (LE) - Knowledge, Order. "Assert dominance."
 *
 * This data includes:
 * - `approves` / `forbids` triggers for the favor system.
 * - `relationships` (Ally/Enemy/Rival) for faction dynamics.
 * - `commandments` for roleplay guidance.
 *
 * =========================================================================================
 */
import { Deity, TempleService } from '../types/religion';

export const DEITIES: Record<string, Deity> = {
  aelios: {
    id: 'aelios',
    name: 'Aelios',
    title: 'The Sun Lord',
    domains: ['Light', 'Life', 'Order'],
    alignment: 'Lawful Good',
    symbol: 'A golden sunburst',
    description: 'God of the sun, law, and justice. Aelios demands honesty, courage, and the protection of the weak.',
    commandments: [
      'Speak only the truth.',
      'Defend those who cannot defend themselves.',
      'Bring light to the dark places of the world.',
    ],
    approvedActions: ['heal_innocent', 'destroy_undead', 'uphold_law'],
    forbiddenActions: ['lie', 'murder', 'create_undead'],
  },
  morrigan: {
    id: 'morrigan',
    name: 'Morrigan',
    title: 'The Raven Queen',
    domains: ['Death', 'War', 'Grave'],
    alignment: 'Neutral',
    symbol: 'A raven profile',
    description: 'Goddess of death, fate, and winter. She views death as a natural part of life and despises the undead.',
    commandments: [
      'Accept your fate with dignity.',
      'Fight with honor.',
      'Destroy those who cheat death (undead).',
    ],
    approvedActions: ['slay_undead', 'honor_fallen', 'accept_fate'],
    forbiddenActions: ['flee_battle', 'desecrate_corpse', 'necromancy'],
  },
  sylara: {
    id: 'sylara',
    name: 'Sylara',
    title: 'The Wild Mother',
    domains: ['Nature', 'Life', 'Peace'],
    alignment: 'Neutral Good',
    symbol: 'An oak leaf entwined with vines',
    description: 'Goddess of the wilderness, beasts, and growth. She encourages harmony with nature.',
    commandments: [
      'Protect the wilds.',
      'Take only what you need.',
      'Respect all living things.',
    ],
    approvedActions: ['protect_nature', 'calm_beast', 'plant_life'],
    forbiddenActions: ['destroy_forest', 'hunt_for_sport', 'pollute'],
  },
  oghma: {
    id: 'oghma',
    name: 'Oghma',
    title: 'The Binder',
    domains: ['Knowledge', 'Arcana'],
    alignment: 'True Neutral',
    symbol: 'A blank scroll',
    description: 'God of knowledge, invention, and inspiration. He values the preservation and discovery of knowledge above all else.',
    commandments: [
      'Share knowledge freely.',
      'Record what is forgotten.',
      'Innovate and create.',
    ],
    approvedActions: ['discover_lore', 'craft_item', 'teach'],
    forbiddenActions: ['destroy_book', 'hoard_knowledge', 'suppress_truth'],
  }
};

export const TEMPLE_SERVICES: Record<string, TempleService> = {
  healing_word: {
    id: 'healing_word',
    name: 'Minor Healing',
    description: 'A simple prayer to restore vitality.',
    requirement: { goldCost: 10 },
    effect: { type: 'heal', value: 10, description: 'Restores 10 HP' },
  },
  cure_disease: {
    id: 'cure_disease',
    name: 'Purify Body',
    description: 'Removes common diseases and poisons.',
    requirement: { goldCost: 50, minFavor: 10 },
    effect: { type: 'cure', description: 'Removes all diseases and poisons' },
  },
  blessing_strength: {
    id: 'blessing_strength',
    name: 'Strength of the Bear',
    description: 'Grants temporary strength.',
    requirement: { goldCost: 100, minFavor: 20 },
    effect: { type: 'buff', stat: 'Strength', value: 2, duration: 60, description: '+2 STR for 1 hour' },
  },
  divine_guidance: {
    id: 'divine_guidance',
    name: 'Divine Guidance',
    description: 'Ask the deity for a hint about your current quest.',
    requirement: { goldCost: 25, minFavor: 5 },
    effect: { type: 'quest', description: 'Reveals a clue' },
  },
  identify_magic: {
    id: 'identify_magic',
    name: 'Identify Artifact',
    description: 'Reveal the properties of a magical item.',
    requirement: { goldCost: 100 }, // No favor needed, just knowledge (Oghma usually)
    effect: { type: 'identify', description: 'Identifies one item' },
  },
  restoration: {
    id: 'restoration',
    name: 'Greater Restoration',
    description: 'End charmed, petrified, cursed, or attribute reducing effects.',
    requirement: { goldCost: 450, minFavor: 50 },
    effect: { type: 'restoration', description: 'Restores ability scores and removes severe conditions' },
  }
};
