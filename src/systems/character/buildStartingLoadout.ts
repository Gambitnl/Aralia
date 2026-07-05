/**
 * @file src/systems/character/buildStartingLoadout.ts
 * Builds a level-1 character's starting loadout — the inventory they carry, the
 * armor/shield/weapon they start EQUIPPED, and their starting gold — from their
 * class's 2024 PHB equipment package plus their background's equipment.
 *
 * Before this module, the character creator granted only the weapons a player
 * picked masteries for (plus rations/water) and equipped nothing, so every
 * character walked into the world unarmored at AC 10 and casters without a
 * mastery weapon started unarmed. This assembles the real kit.
 *
 * Pure and deterministic: same inputs → same loadout. The caller (character
 * assembly) applies `equippedItems`, recomputes AC via calculateArmorClass, and
 * threads `gold` into the new game.
 */
import { Item, EquipmentSlotType } from '../../types/index.js';
import { ALL_ITEMS } from '../../data/items/index.js';
import { CLASS_STARTING_EQUIPMENT } from '../../data/classes/startingEquipment.js';
import { BACKGROUNDS, Background } from '../../data/backgrounds.js';

export interface StartingLoadout {
  inventory: Item[];
  equippedItems: Partial<Record<EquipmentSlotType, Item>>;
  /** Starting gold in gold pieces (class package + background coin). */
  gold: number;
}

export interface BuildLoadoutOptions {
  classId: string;
  /** Background object or id; supplies extra equipment and coin. */
  background?: Background | string | null;
  /** Weapon ids the player chose masteries for — always carried. */
  weaponMasteryIds?: string[];
}

const COIN_TO_GP: Record<string, number> = { gp: 1, sp: 0.1, cp: 0.01, ep: 0.5, pp: 10 };

/** Parse a "15_gp" / "10_sp" style token into gold pieces, or null if not a coin. */
function parseCoinToken(token: string): number | null {
  const m = /^(\d+)_(gp|sp|cp|ep|pp)$/i.exec(token);
  if (!m) return null;
  return parseInt(m[1], 10) * COIN_TO_GP[m[2].toLowerCase()];
}

/** Turn an unmapped equipment id into a readable inventory keepsake, never a silent drop. */
function makeFlavorItem(id: string): Item {
  const name = id
    .split('_')
    .map(part => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
  return {
    id,
    name,
    description: 'A personal effect from your past.',
    type: 'treasure',
    icon: '🎒',
    weight: 0.5,
  };
}

/** The slot an item equips into: weapons to MainHand, armor to its declared slot. */
function equipSlotFor(item: Item): EquipmentSlotType | undefined {
  if (item.type === 'weapon') return 'MainHand';
  if (item.type === 'armor') return item.slot;
  return undefined;
}

/** Merge same-id inventory entries into single stacks, summing quantities. */
function mergeStacks(items: Item[]): Item[] {
  const byId = new Map<string, Item>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + (item.quantity ?? 1);
    } else {
      byId.set(item.id, { ...item, quantity: item.quantity ?? 1 });
    }
  }
  return [...byId.values()];
}

export function buildStartingLoadout(opts: BuildLoadoutOptions): StartingLoadout {
  const { classId, background, weaponMasteryIds = [] } = opts;

  const inventory: Item[] = [];
  const equippedItems: Partial<Record<EquipmentSlotType, Item>> = {};
  let gold = 0;

  const carry = (item: Item, quantity: number) => inventory.push({ ...item, quantity });

  // 1. Class starting-equipment package.
  const pkg = CLASS_STARTING_EQUIPMENT[classId];
  if (pkg) {
    gold += pkg.gold;
    for (const entry of pkg.items) {
      const item = ALL_ITEMS[entry.id];
      if (!item) {
        // Package ids are authored to exist; a miss is a real bug, not a
        // condition to silently swallow.
        if (typeof console !== 'undefined') {
          console.warn(`[buildStartingLoadout] class '${classId}' references unknown item '${entry.id}'`);
        }
        continue;
      }
      const slot = entry.equip ? equipSlotFor(item) : undefined;
      if (slot && !equippedItems[slot]) {
        equippedItems[slot] = { ...item };
      } else {
        carry(item, entry.quantity ?? item.quantity ?? 1);
      }
    }
  } else if (typeof console !== 'undefined') {
    console.warn(`[buildStartingLoadout] no starting-equipment package for class '${classId}'`);
  }

  // 2. Weapons the player chose masteries for — always in hand or pack.
  for (const weaponId of weaponMasteryIds) {
    const item = ALL_ITEMS[weaponId];
    if (!item) continue;
    const alreadyHave =
      Object.values(equippedItems).some(eq => eq?.id === weaponId) ||
      inventory.some(inv => inv.id === weaponId);
    if (!alreadyHave) carry(item, 1);
  }

  // 3. Background equipment: coin tokens become gold, real ids resolve from the
  // catalog, and anything unmapped becomes a named keepsake (never dropped).
  const bg: Background | undefined =
    typeof background === 'string' ? BACKGROUNDS[background] : background ?? undefined;
  if (bg?.equipment) {
    for (const eqId of bg.equipment) {
      const coin = parseCoinToken(eqId);
      if (coin != null) {
        gold += coin;
        continue;
      }
      const item = ALL_ITEMS[eqId] ?? makeFlavorItem(eqId);
      carry(item, item.quantity ?? 1);
    }
  }

  // 4. Baseline provisions so a new character can survive the first days of travel.
  if (ALL_ITEMS['rations']) carry(ALL_ITEMS['rations'], 5);
  if (ALL_ITEMS['water-day']) carry(ALL_ITEMS['water-day'], 5);

  return {
    inventory: mergeStacks(inventory),
    equippedItems,
    gold: Math.round(gold * 100) / 100,
  };
}
