/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/provenanceUtils.ts
 * Utility functions for managing item history and provenance.
 * "If they don't remember, it didn't happen." - Recorder
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: utils/world/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Item } from '../../types/items';
import { ItemType } from '../../types/items';
import { ItemProvenance, ProvenanceEvent, ProvenanceEventType } from '../../types/provenance';
import { GameDate } from '../../types/memory';
import { SeededRandom } from '../random/seededRandom';
import { RACE_NAMES } from '../../data/names/raceNames';
import { FACTIONS } from '../../data/factions';

/**
 * Creates an empty provenance record for a newly created item.
 * @param creator The ID of the creator (e.g., "player_1", "npc_blacksmith").
 * @param date The current game date.
 * @param originalName Optional original name of the item when crafted.
 * @returns A new ItemProvenance object.
 */
export function createProvenance(creator: string, date: GameDate, originalName?: string): ItemProvenance {
  return {
    creator,
    createdDate: date,
    originalName,
    previousOwners: [creator],
    history: [
      {
        date,
        type: 'CRAFTED',
        description: `Created by ${creator}`,
        actorId: creator
      }
    ]
  };
}

/**
 * Adds a new event to an item's history.
 * @param item The item to update.
 * @param type The type of event.
 * @param description What happened.
 * @param date The current game date.
 * @param actorId Optional ID of the actor involved.
 * @param locationId Optional ID of where the event happened.
 * @returns A new Item object with the updated provenance.
 */
export function addProvenanceEvent(
  item: Item,
  type: ProvenanceEventType,
  description: string,
  date: GameDate,
  actorId?: string,
  locationId?: string
): Item {
  const newEvent = {
    date,
    type,
    description,
    actorId,
    locationId
  };

  if (!item.provenance) {
      // FIX: Do NOT use createProvenance here, as it assumes a CRAFTED event.
      // Instead, initialize a fresh provenance object with just this new event.
      const inferredCreator = actorId ?? 'Unknown';
      const initialProvenance: ItemProvenance = {
          creator: inferredCreator,
          createdDate: date, // Best guess
          originalName: item.name,
          previousOwners: inferredCreator ? [inferredCreator] : [],
          history: [newEvent]
      };

      return {
          ...item,
          provenance: initialProvenance
      };
  }

  return {
    ...item,
    provenance: {
      ...item.provenance,
      history: [...item.provenance.history, newEvent]
    }
  };
}

// -----------------------------------------------------------------------------
// Legendary history generation (agora-7c9e)
// -----------------------------------------------------------------------------
//
// WHAT CHANGED: `generateLegendaryHistory` used to return one fixed story —
// creator 'Ancient Smith', owners 'The Lost King' and 'General Thorne', three
// hardcoded events. Every legendary item in the world had the same past. It now
// draws a history from the item's own type, the race name banks in
// `src/data/names/raceNames.ts`, and the real faction roster in
// `src/data/factions.ts`, so a dwarven-forged axe and an elven-wrought amulet
// no longer share a biography.
//
// WHY DETERMINISTIC: an item's past must not change when it is re-rendered or
// reloaded. The stream is seeded from the item's identity and the date, so the
// same item at the same date always has the same history. `SeededRandom` is
// used, never Math.random.
//
// WHAT IS PRESERVED: the signature and return shape are unchanged, the history
// still runs CRAFTED -> ... -> FOUND, and `createdDate` is still deep in the
// past relative to `date`.

/** One in-game year in the GameDate millisecond scale used across this file. */
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

/** How far back a legendary item's forging sits, in years. */
const FORGING_AGE_MIN_YEARS = 80;
const FORGING_AGE_MAX_YEARS = 400;

/**
 * A forging tradition: who made the thing, and how that culture talks about
 * making it. `raceId` keys into RACE_NAMES so creator and owner names sound like
 * the culture that produced the item.
 */
interface ForgeTradition {
  raceId: string;
  /** Title placed after the creator's name, e.g. "Durin Balderk, Forgemaster". */
  title: string;
  /** How the CRAFTED event reads for this tradition. */
  craftedDescriptions: string[];
}

const FORGE_TRADITIONS: Record<string, ForgeTradition> = {
  deepforge: {
    raceId: 'dwarf',
    title: 'Forgemaster',
    craftedDescriptions: [
      'Hammered out over a deep-earth forge, quenched in mountain meltwater.',
      'Struck from a single billet of star-iron and sung over for nine days.',
      'Forged in a clan hall whose fires have never once gone cold.',
    ],
  },
  moonwright: {
    raceId: 'elf',
    title: 'Moonwright',
    craftedDescriptions: [
      'Shaped slowly under moonlight, a decade of work for a single piece.',
      'Woven rather than beaten, in the patient manner of the old groves.',
      'Made as a gift, and made too well to ever be given away.',
    ],
  },
  hedgecraft: {
    raceId: 'halfling',
    title: 'Hedge-Maker',
    craftedDescriptions: [
      'Put together in a village workshop by someone who never sought fame.',
      'Made plainly, mended often, and carried further than anyone expected.',
    ],
  },
  scriptorium: {
    raceId: 'human',
    title: 'Archivist',
    craftedDescriptions: [
      'Copied out by hand in a scriptorium that later burned to its foundations.',
      'Inked in a cold tower, the last work its author ever finished.',
    ],
  },
  reliquary: {
    raceId: 'human',
    title: 'Reliquarist',
    craftedDescriptions: [
      'Set into its mounting for a temple that no longer keeps its name.',
      'Cut and polished as tribute, then quietly kept back from the tribute.',
    ],
  },
};

/**
 * Which traditions can plausibly have made which kind of item. An item type that
 * is not listed falls to `DEFAULT_TRADITIONS` — a real choice for "some maker
 * worked this", not a hidden stand-in for missing data.
 */
const TRADITIONS_BY_ITEM_TYPE: Partial<Record<ItemType, string[]>> = {
  [ItemType.Weapon]: ['deepforge', 'moonwright'],
  [ItemType.Armor]: ['deepforge', 'moonwright'],
  [ItemType.Ammunition]: ['deepforge', 'moonwright'],
  [ItemType.Accessory]: ['moonwright', 'reliquary'],
  [ItemType.Treasure]: ['reliquary', 'deepforge'],
  [ItemType.Book]: ['scriptorium'],
  [ItemType.Scroll]: ['scriptorium'],
  [ItemType.Note]: ['scriptorium'],
  [ItemType.Map]: ['scriptorium', 'hedgecraft'],
  [ItemType.Tool]: ['deepforge', 'hedgecraft'],
  [ItemType.LightSource]: ['deepforge', 'hedgecraft'],
  [ItemType.SpellComponent]: ['reliquary', 'scriptorium'],
  [ItemType.Potion]: ['hedgecraft', 'reliquary'],
  [ItemType.Consumable]: ['hedgecraft', 'reliquary'],
};

const DEFAULT_TRADITIONS = ['hedgecraft', 'scriptorium'];

/** Middle-of-life events, drawn after CRAFTED and before the closing FOUND. */
const MIDDLE_EVENTS: { type: ProvenanceEventType; templates: string[]; namesOwner: boolean }[] = [
  {
    type: 'USED_IN_COMBAT',
    namesOwner: true,
    templates: [
      'Carried by {owner} through the war {faction} started and lost.',
      'Turned against {faction} at a river crossing nobody has mapped since.',
      'Held by {owner} on the night the {faction} banners came down.',
    ],
  },
  {
    type: 'STOLEN',
    namesOwner: true,
    templates: [
      'Lifted from {owner} by an agent of {faction}, who was never named.',
      'Taken out of a {faction} strongroom during the inventory of a dead year.',
    ],
  },
  {
    type: 'GIFTED',
    namesOwner: true,
    templates: [
      'Given to {owner} to settle a debt {faction} preferred to forget.',
      'Pressed on {owner} as an apology, and accepted as one.',
    ],
  },
  {
    type: 'SOLD',
    namesOwner: true,
    templates: [
      'Sold to {owner} for far less than it was worth, in a hurry.',
      'Traded through {faction} three times in a single season.',
    ],
  },
  {
    type: 'ENCHANTED',
    namesOwner: true,
    templates: [
      'Warded by {owner}, who charged {faction} for the privilege.',
      'Bound with a working that {faction} has since declared unlawful.',
    ],
  },
  {
    type: 'DAMAGED',
    namesOwner: false,
    templates: [
      'Cracked through when its bearer fell, and left where it lay.',
      'Scorched past recognition and buried with the rest of the ruin.',
    ],
  },
  {
    type: 'REPAIRED',
    namesOwner: true,
    templates: [
      'Made whole again by {owner}, whose seam still shows.',
      'Patched by a {faction} armourer who signed the work in a hidden place.',
    ],
  },
];

/** How the item comes back into the world at the end of its recorded history. */
const FOUND_TEMPLATES = [
  'Recovered from the ruin by a scavenger who did not know what it was.',
  'Dug out of a collapsed vault and sold on the same week.',
  'Found among the effects of someone who had no right to it.',
  'Turned up in a border market with its provenance filed off.',
];

/** Number of middle events between the forging and the finding. */
const MIN_MIDDLE_EVENTS = 2;
const MAX_MIDDLE_EVENTS = 4;

/** Stable 32-bit hash so the same item and date always seed the same history. */
function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash | 0) + 1;
}

/** Builds a full name from a race's name bank, plus an optional title. */
function makePersonName(rng: SeededRandom, raceId: string, title?: string): string {
  const bank = RACE_NAMES[raceId] ?? RACE_NAMES.human;
  const givenNames = rng.next() > 0.5 ? bank.male : bank.female;
  const name = `${rng.pick(givenNames)} ${rng.pick(bank.surnames)}`;
  return title ? `${name}, ${title}` : name;
}

/**
 * Generates a legendary history for a found item.
 *
 * Deterministic: the same item and date always produce the same history. Pass
 * `seed` to place the item on a caller-owned stream instead (for example, one
 * keyed to the dungeon that produced it).
 *
 * @param item The item to generate history for.
 * @param date The current game date (to backtrack from).
 * @param seed Optional explicit seed; defaults to a hash of the item and date.
 * @returns A new Item object with a rich history.
 */
export function generateLegendaryHistory(item: Item, date: GameDate, seed?: number): Item {
  const rng = new SeededRandom(seed ?? hashSeed(`${item.id}|${item.name}|${date}`));

  // 1. Who made it, and in what tradition.
  const traditionIds = TRADITIONS_BY_ITEM_TYPE[item.type] ?? DEFAULT_TRADITIONS;
  const tradition = FORGE_TRADITIONS[rng.pick(traditionIds)];
  const creator = makePersonName(rng, tradition.raceId, tradition.title);

  // 2. When it was made.
  const ageYears = rng.nextInt(FORGING_AGE_MIN_YEARS, FORGING_AGE_MAX_YEARS + 1);
  const createdDate = date - ONE_YEAR_MS * ageYears;

  // 3. The powers that handled it. Drawn from the live faction roster so the
  //    item's past names factions the player can actually meet.
  const factionNames = Object.values(FACTIONS).map((faction) => faction.name);

  const history: ProvenanceEvent[] = [
    {
      date: createdDate,
      type: 'CRAFTED',
      description: rng.pick(tradition.craftedDescriptions),
      actorId: creator,
    },
  ];
  const previousOwners: string[] = [creator];

  // 4. The middle of its life: events spread evenly across the span between the
  //    forging and the present, so the chronology always reads forward.
  const middleCount = rng.nextInt(MIN_MIDDLE_EVENTS, MAX_MIDDLE_EVENTS + 1);
  const span = date - createdDate;
  const usedEventTypes = new Set<ProvenanceEventType>();

  for (let i = 0; i < middleCount; i++) {
    let event = rng.pick(MIDDLE_EVENTS);
    // Prefer an event type this item has not seen yet; a life that repeats the
    // same beat reads as generated.
    for (let attempt = 0; attempt < MIDDLE_EVENTS.length && usedEventTypes.has(event.type); attempt++) {
      event = rng.pick(MIDDLE_EVENTS);
    }
    usedEventTypes.add(event.type);

    const owner = makePersonName(rng, tradition.raceId);
    const faction = rng.pick(factionNames);
    const description = rng
      .pick(event.templates)
      .replace('{owner}', owner)
      .replace('{faction}', faction);

    history.push({
      date: createdDate + Math.floor((span * (i + 1)) / (middleCount + 2)),
      type: event.type,
      description,
      actorId: event.namesOwner ? owner : undefined,
    });

    if (event.namesOwner && !previousOwners.includes(owner)) {
      previousOwners.push(owner);
    }
  }

  // 5. How it reached the player's hands.
  history.push({
    date: createdDate + Math.floor((span * (middleCount + 1)) / (middleCount + 2)),
    type: 'FOUND',
    description: rng.pick(FOUND_TEMPLATES),
  });

  const provenance: ItemProvenance = {
    creator,
    createdDate,
    originalName: item.name,
    previousOwners,
    history,
  };

  return {
    ...item,
    provenance,
  };
}
