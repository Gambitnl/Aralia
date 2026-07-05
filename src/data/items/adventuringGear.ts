/**
 * @file src/data/items/adventuringGear.ts
 * Early-game adventuring gear: the spellcasting focuses, adventuring packs,
 * ammunition, kits, and starting clothes that the 2024 PHB class starting-
 * equipment packages (and several backgrounds) reference. Before this file,
 * none of these existed in the catalog, so class packages and background
 * equipment had nothing to resolve to and were silently dropped.
 *
 * Merged into ALL_ITEMS (see ./index.ts). Kept as its own module so the
 * starting-loadout system has one clearly-bounded source for "the basic kit."
 */
import { Item } from '../../types/index.js';

export const ADVENTURING_GEAR: Record<string, Item> = {
  // --- Spellcasting focuses & arcane gear ---
  'arcane_focus': {
    id: 'arcane_focus', name: 'Arcane Focus', icon: '🔮',
    description: 'A crystal, orb, rod, staff, or wand that channels arcane magic, serving as a spellcasting focus in place of most material components.',
    type: 'tool', weight: 1, cost: '10 GP',
  },
  'druidic_focus': {
    id: 'druidic_focus', name: 'Druidic Focus', icon: '🌿',
    description: 'A sprig of mistletoe, a totem, a wooden staff, or a yew wand that channels primal magic, serving as a spellcasting focus.',
    type: 'tool', weight: 1, cost: '1 GP',
  },
  'holy_symbol': {
    id: 'holy_symbol', name: 'Holy Symbol', icon: '✝️',
    description: 'An emblem or reliquary of a deity, worn or held. It channels divine magic as a spellcasting focus for clerics and paladins.',
    type: 'tool', weight: 1, cost: '5 GP',
  },
  'component_pouch': {
    id: 'component_pouch', name: 'Component Pouch', icon: '👝',
    description: 'A small watertight leather belt pouch holding the material components for spells that lack a costly component.',
    type: 'tool', weight: 2, cost: '25 GP',
  },
  'spellbook': {
    id: 'spellbook', name: 'Spellbook', icon: '📖',
    description: 'A leather-bound tome of 100 blank vellum pages. A wizard inscribes their spells here and prepares magic from it.',
    type: 'book', weight: 3, cost: '50 GP',
  },

  // --- Ammunition ---
  'arrows': {
    id: 'arrows', name: 'Arrows (20)', icon: '🏹',
    description: 'A bundle of twenty arrows for a shortbow or longbow, carried in a quiver.',
    type: 'ammunition', weight: 1, cost: '1 GP', quantity: 20,
  },
  'crossbow_bolts': {
    id: 'crossbow_bolts', name: 'Crossbow Bolts (20)', icon: '🎯',
    description: 'A case of twenty bolts for a crossbow.',
    type: 'ammunition', weight: 1.5, cost: '1 GP', quantity: 20,
  },

  // --- Adventuring packs (bundled kits; contents summarized in the description) ---
  'explorers_pack': {
    id: 'explorers_pack', name: "Explorer's Pack", icon: '🎒',
    description: 'A backpack with a bedroll, mess kit, tinderbox, 10 torches, 10 days of rations, a waterskin, and 50 feet of hempen rope. The all-purpose wilderness kit.',
    type: 'tool', weight: 55, cost: '10 GP',
  },
  'dungeoneers_pack': {
    id: 'dungeoneers_pack', name: "Dungeoneer's Pack", icon: '🎒',
    description: 'A backpack with a crowbar, hammer, 10 pitons, 10 torches, a tinderbox, 10 days of rations, and a waterskin, plus 50 feet of hempen rope. Built for delving.',
    type: 'tool', weight: 52, cost: '12 GP',
  },
  'priests_pack': {
    id: 'priests_pack', name: "Priest's Pack", icon: '🎒',
    description: 'A backpack with a blanket, a tinderbox, an alms box, 2 blocks of incense, a censer, vestments, 2 days of rations, and a waterskin.',
    type: 'tool', weight: 25, cost: '19 GP',
  },
  'scholars_pack': {
    id: 'scholars_pack', name: "Scholar's Pack", icon: '🎒',
    description: 'A backpack with a book of lore, a bottle of ink, an ink pen, 10 sheets of parchment, a little bag of sand, and a small knife.',
    type: 'tool', weight: 22, cost: '40 GP',
  },
  'burglars_pack': {
    id: 'burglars_pack', name: "Burglar's Pack", icon: '🎒',
    description: 'A backpack with a bag of 1,000 ball bearings, 10 feet of string, a bell, 5 candles, a crowbar, a hammer, 10 pitons, a hooded lantern, 2 flasks of oil, 5 days of rations, a tinderbox, a waterskin, and 50 feet of hempen rope.',
    type: 'tool', weight: 44, cost: '16 GP',
  },
  'entertainers_pack': {
    id: 'entertainers_pack', name: "Entertainer's Pack", icon: '🎒',
    description: 'A backpack with a bedroll, 2 costumes, 5 candles, 5 days of rations, a waterskin, and a disguise kit.',
    type: 'tool', weight: 38, cost: '40 GP',
  },

  // --- Kits & tools referenced by classes/backgrounds ---
  'herbalism_kit': {
    id: 'herbalism_kit', name: 'Herbalism Kit', icon: '🌱',
    description: 'Pouches, clippers, mortar and pestle, and glass jars for harvesting plants and brewing herbal remedies.',
    type: 'tool', weight: 3, cost: '5 GP',
  },
  'tinderbox': {
    id: 'tinderbox', name: 'Tinderbox', icon: '🔥',
    description: 'A small tin holding flint, fire steel, and tinder to kindle a flame.',
    type: 'tool', weight: 1, cost: '5 SP',
  },
  'musical_instrument': {
    id: 'musical_instrument', name: 'Musical Instrument', icon: '🎵',
    description: 'A well-loved instrument — a lute, flute, or drum — that a bard uses as a spellcasting focus and to earn a night\'s coin.',
    type: 'tool', weight: 3, cost: '20 GP',
  },

  // --- Starting clothes ---
  'common_clothes': {
    id: 'common_clothes', name: 'Common Clothes', icon: '👕',
    description: 'A simple, hard-wearing outfit — tunic, breeches, and a belt. What most folk wear day to day.',
    type: 'clothing', slot: 'Torso', weight: 3, cost: '5 SP',
  },
  'travelers_clothes': {
    id: 'travelers_clothes', name: "Traveler's Clothes", icon: '🧥',
    description: 'Sturdy boots, a wool coat, and layered garments made for the road and rough weather.',
    type: 'clothing', weight: 4, cost: '2 GP',
  },
};
