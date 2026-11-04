/**
 * @file InventoryList.tsx
 * This component displays a list of inventory items with their details and actions.
 * It's used within the CharacterSheetModal.
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Removed redundant 'as any' casts
 * when accessing 'rarity' and simplified the 'isContainerItem' type
 * guard by removing unnecessary type assertions, improving type safety
 * and code readability.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 06:54:54
 * Dependents: components/CharacterSheet/Overview/index.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {objectLightDetails} from '../../../systems/gameplay/objectLightCasting';
import React, { useMemo, useState } from 'react';
import { getPartyFundsGp } from '../../../systems/economy/partyFunds';
import { gpToCoins, isCurrencyItemId } from '../../../utils/character/coinPurseUtils';
import { useOptionalGameState } from '../../../state/GameContext';
import { PartyMealConfirmation } from './PartyMealConfirmation';
import { AdventuringPackReview } from './AdventuringPackReview';
import { getFoodExpirationState } from '../../../utils/items/foodFreshness';
import { inventoryWeight } from '../../../systems/travel/provisionEncumbrance';
import { ChevronRight, ChevronDown, FilterX, AlertTriangle } from 'lucide-react';
import { PlayerCharacter, Item, Action, ItemContainer, InventoryEntry, EquipmentSlotType, ItemType } from '../../../types';
import { canEquipItem, calculatePotentialAcChange, isTwoHandedWeapon, getCharacterEncumbrance } from '../../../utils/character';
import { ENV } from '../../../config/env';
import { resolveItemAssetSrc, resolveItemVisual } from '../../../utils/visuals/visualUtils';
import { slotAcceptsItem, slotRejectionReason } from './EquipmentMannequin';
import Tooltip from '../../ui/Tooltip';
import { ItemComparisonPanel } from './ItemComparisonPanel';
import {activeCarriedTorches, torchUseError} from '../../../systems/underdark/carriedItemLight';
import { CoinBadge } from '../../ui/CoinPurseDisplay';
// GG-378: shared button style and control roles.
import { BTN_FOCUS_VISIBLE, BTN_ICON } from '../../../styles/buttonStyles';

/**
 * This file displays a list of the items carried by a character, including bags and currency.
 *
 * It renders the inventory column on the right side of the character sheet overview.
 * It supports:
 * - Currency breakdown (Coin Pouch) showing physical coin items and liquid gold.
 * - Filtering items by type and equipment slot compatibility.
 * - Storing items inside nested containers (e.g. bags within bags) and calculating weight recursively.
 * - Quick action triggers for equipping, using, or dropping items.
 *
 * Called by: CharacterSheetModal.tsx (Overview tab, column 3)
 * Depends on: utility functions for item equipping and visuals, and the CoinBadge display component.
 */

// ============================================================================
// Types & Container Guards
// ============================================================================
// Defines props for the inventory list and handles a type-guard function
// to safely identify when an item can contain other items (like a backpack or pouch).
// ============================================================================

interface InventoryListProps {
  inventory: Item[];
  gold: number;
  character: PlayerCharacter;
  onAction: (action: Action) => void;
  filterBySlot?: EquipmentSlotType | null;
  onClearFilter?: () => void;
}

/**
 * Lightweight discriminated type-guard used throughout the UI to
 * determine if an inventory entry can behave like a bag/container.
 */
const isContainerItem = (item: InventoryEntry): item is ItemContainer =>
  item.isContainer === true ||
  typeof item.capacitySlots === 'number' ||
  typeof item.capacityWeight === 'number';

/**
 * Item types that can be worn/wielded and therefore expect a defined
 * equipment `slot`. Some data authored items are equippable by type but
 * lack a slot; those must not be silently hidden (see GAPS G9).
 */
const isEquippableItemType = (item: InventoryEntry): boolean =>
  item.type === 'armor' || item.type === 'weapon' || item.type === 'accessory';

/**
 * Dev-only dedup guard so we warn once per offending item id rather than
 * on every render pass of the slot-filtered inventory view.
 */
const _warnedSlotlessEquippable = new Set<string>();

/**
 * Where an EQUIP_ITEM dispatch would actually put `item`, or `null` when the
 * reducer would find no target and silently drop the action.
 *
 * This mirrors the slot resolution in `characterReducer.ts` (`case 'EQUIP_ITEM'`)
 * on purpose: the button must not promise an equip the reducer will not perform,
 * and must not hide one it would. Two consequences the old `item.slot` check got
 * wrong:
 *  - a SLOTLESS one-handed weapon IS equippable (the reducer routes it to the
 *    free hand), yet the Equip button was hidden for it entirely;
 *  - a one-handed weapon's authored `slot` is IGNORED by the reducer, so the
 *    hand it lands in - not the authored slot - is what the slot rules must
 *    validate.
 * Preserved: slotless armor / two-handed weapons still resolve to `null` here,
 * exactly as the reducer treats them; they now surface a disabled button with a
 * reason instead of no button at all.
 */
const resolveEquipTargetSlot = (
  character: PlayerCharacter,
  item: InventoryEntry
): EquipmentSlotType | null => {
  const isOneHandedWeapon = item.type === 'weapon' && !isTwoHandedWeapon(item);
  if (isOneHandedWeapon) {
    if (isTwoHandedWeapon(character.equippedItems?.MainHand)) return 'MainHand';
    if (!character.equippedItems?.MainHand) return 'MainHand';
    if (!character.equippedItems?.OffHand) return 'OffHand';
    return 'MainHand'; // both hands full: the reducer swaps out the main hand
  }
  return item.slot ?? null;
};

// Container browsing lives below (buckets, nesting, move-to-container); the equipped-vs-candidate
// comparison is ItemComparisonPanel, shown while an equippable item is hovered (agora-d1c7.13).
// ============================================================================
// Item Tooltip Generator
// ============================================================================
// Generates detailed, user-friendly HTML summaries for all types of items.
// Shows weapons damage, armor class values, consumables effects, and weight.
// ============================================================================

const getItemTooltipContent = (item: Item, warning?: string): React.ReactNode => {
  let details = `${item.description}\nType: ${item.type}`;
  if (item.slot) details += `\nSlot: ${item.slot}`;

  if (item.type === 'armor') {
    details += `\nCategory: ${item.armorCategory || 'N/A'}`;
    if (item.baseArmorClass) details += ` | Base AC: ${item.baseArmorClass}`;
    if (item.armorClassBonus) details += ` | AC Bonus: +${item.armorClassBonus}`;
    if (item.strengthRequirement) details += ` | Str Req: ${item.strengthRequirement}`;
    if (item.stealthDisadvantage) details += ` | Stealth Disadvantage`;
    if (item.addsDexterityModifier) details += ` | Adds Dex Mod (Max: ${item.maxDexterityBonus === undefined ? 'Unlimited' : item.maxDexterityBonus})`;
  } else if (item.type === 'weapon') {
    if (item.damageDice) details += `\nDamage: ${item.damageDice} ${item.damageType || ''}`;
    if (item.properties?.length) details += `\nProperties: ${item.properties.join(', ')}`;
  } else if (item.type === 'consumable' && item.effect) {
    // Type guard: item.effect should be string, but some items may have object/array
    if (typeof item.effect === 'string') {
      details += `\nEffect: ${item.effect.replace(/_/g, ' ')}`;
    } else {
      // Handle non-string effects (likely from spell items with effects array)
      details += `\nEffect: ${JSON.stringify(item.effect)}`;
    }
  } else if (item.type === 'food_drink') {
    if (item.shelfLife) details += `\nShelf Life: ${item.shelfLife}`;
    if (item.nutritionValue) details += ` | Nutrition: ${item.nutritionValue}/10`;
    if (item.perishable) details += ` | Perishable`;
  } else if (item.type === 'reagent') {
    // Display detailed reagent info for herbalism/alchemy
    if (item.rarity) {
      const r = item.rarity;
      details += `\nRarity: ${r.charAt(0).toUpperCase() + r.slice(1)}`;
    }
    if (item.properties?.length) {
      const props = item.properties.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
      details += `\nProperties: ${props}`;
    }
  }

  if (item.statBonuses) {
    const bonuses = Object.entries(item.statBonuses)
      .map(([stat, val]) => `${stat} ${val && val > 0 ? '+' : ''}${val}`)
      .join(', ');
    if (bonuses) details += `\nBonuses: ${bonuses}`;
  }

  if (item.requirements) {
    const reqs = [];
    if (item.requirements.minLevel) reqs.push(`Lvl ${item.requirements.minLevel}`);
    if (item.requirements.classId) reqs.push(`Class: ${item.requirements.classId.join('/')}`);
    if (item.requirements.minStrength) reqs.push(`Str ${item.requirements.minStrength}`);
    if (item.requirements.minDexterity) reqs.push(`Dex ${item.requirements.minDexterity}`);
    // ... add others as needed
    if (reqs.length > 0) details += `\nRequires: ${reqs.join(', ')}`;
  }

  if (item.weight) details += `\nWeight: ${item.weight} lbs`;
  if (item.cost) details += `\nCost: ${item.cost}`;

  if (warning) {
    details += `\n\n⚠️ ${warning}`;
  }

  return <pre className="text-xs whitespace-pre-wrap">{details}</pre>;
};

const ROOT_CONTAINER_ID = 'root-backpack';
/**
 * Virtual bucket id for Service items (bought information). Service items have no
 * physical form, so they are listed apart from the carried containers under an
 * "Information" heading instead of sitting in the backpack.
 */
const INFORMATION_BUCKET_ID = 'information-bucket';

/** Item type filter categories for the inventory UI */
type ItemTypeFilter = 'all' | 'armor' | 'weapons' | 'consumables' | 'tools' | 'accessories' | 'other';

const ITEM_TYPE_FILTERS: { id: ItemTypeFilter; label: string; icon: string; types: string[] }[] = [
  { id: 'all', label: 'All', icon: 'inventory_2', types: [] },
  { id: 'armor', label: 'Armor', icon: 'shield', types: ['armor'] },
  { id: 'weapons', label: 'Weapons', icon: 'swords', types: ['weapon'] },
  { id: 'consumables', label: 'Consumables', icon: 'local_drink', types: ['consumable', 'potion', 'food_drink', 'scroll'] },
  { id: 'tools', label: 'Tools', icon: 'construction', types: ['tool', 'light_source'] },
  // GG-576: spellcasting foci are worn or held like accessories; mounts,
  // vehicles and livestock have no other group yet.
  { id: 'accessories', label: 'Accessories', icon: 'diamond', types: ['accessory', 'clothing', 'spellcasting_focus'] },
  { id: 'other', label: 'Other', icon: 'category', types: ['note', 'book', 'map', 'key', 'spell_component', 'crafting_material', 'treasure', 'reagent', 'ammunition', 'trap', 'service', 'mount', 'vehicle', 'livestock'] },
];

// ============================================================================
// Perishable Food Timing
// ============================================================================
// Converts the descriptive shelf-life field into real milliseconds so the
// inventory can compare durable acquisition timestamps against the current time.
// Existing unstamped food is treated as unknown freshness rather than spoiled,
// which keeps legacy saves playable until their inventories are migrated by an
// acquisition or save-load path.
// ============================================================================

// ============================================================================
// Main Inventory List Component
// ============================================================================
// Organizes the character's coin purse, filtering controls, backpack contents,
// and recursively renders nested containers.
// ============================================================================

const InventoryList: React.FC<InventoryListProps> = ({ inventory, gold, character, onAction, filterBySlot, onClearFilter }) => {
  const gameContext = useOptionalGameState();
  // The normal sheet passes the party's actual shared inventory. Keep personal
  // previews honest too: do not rename an unrelated supplied inventory as shared.
  const sharedInventory=Boolean(gameContext&&gameContext.state.inventory===inventory);
  const rootLabel=sharedInventory?'Party supplies':'Backpack';
  const [mealIndex, setMealIndex] = useState<number | null>(null);
  const [torchFeedback, setTorchFeedback] = useState<string | null>(null);
  /**
   * Count every carried unit with the existing provision-weight helper.
   * Flat inventory entries count once; nesting only changes presentation.
   * Carrying ownership, equipped gear and movement rules remain separate.
   */
  const totalInventoryWeight = useMemo(() => {
    // Ignition moves a torch into its fuel record, not out of the carried load.
    const burningItems = gameContext ? activeCarriedTorches(gameContext.state).map(source => source.sourceItem!) : [];
    return inventoryWeight([...inventory, ...burningItems]).toFixed(2);
  }, [inventory, gameContext?.state.underdark.activeLightSources, gameContext?.state.gameTime, gameContext?.state.party]);

  /**
   * agora-bf91 (GG-459/GG-6): surface the 5e variant-encumbrance tier on the
   * backpack header. We reuse the tested carrying-capacity helper rather than a
   * second capacity formula, so size, Strength, and Powerful Build all resolve
   * exactly as the travel speed gate (encumbranceSpeedFactor) already treats
   * them. The numeric weight is derived from the single sum above, not re-added.
   */
  const encumbrance = useMemo(
    () => getCharacterEncumbrance(character, Number(totalInventoryWeight)),
    [character, totalInventoryWeight],
  );
  const encumbranceTone =
    encumbrance.level === 'heavy' ? 'text-red-400'
      : encumbrance.level === 'medium' ? 'text-amber-400'
        : encumbrance.level === 'light' ? 'text-sky-400'
          : 'text-gray-400';
  const encumbranceLabel =
    encumbrance.level === 'none' ? 'Unencumbered'
      : `${encumbrance.level[0].toUpperCase()}${encumbrance.level.slice(1)} encumbered`;

  // Find all equipped items that require attunement
  const equippedAttunementItems = useMemo(() => {
    return Object.entries(character.equippedItems)
      .filter(([slot, item]) => item && item.requiresAttunement)
      .map(([slot, item]) => ({ slot: slot as EquipmentSlotType, item: item! }));
  }, [character.equippedItems]);

  // Compute total number of attuned magic items
  const totalAttunedCount = useMemo(() => {
    const equippedAttuned = Object.values(character.equippedItems).filter(
      item => item && item.requiresAttunement && item.isAttuned && item.attunedCharacterId === character.id
    ).length;
    const inventoryAttuned = inventory.filter(
      item => item && item.requiresAttunement && item.isAttuned && item.attunedCharacterId === character.id
    ).length;
    return equippedAttuned + inventoryAttuned;
  }, [character.equippedItems, character.id, inventory]);

  // Count stacked currency at face value, using the same total as checkout.
  // Electrum contributes five silver; no earned coin is credited twice on load.
  const currency = useMemo(() => {
    const coins = gpToCoins(getPartyFundsGp({ gold, inventory }));
    return { PP: coins.pp, GP: coins.gp, SP: coins.sp, CP: coins.cp };
  }, [inventory, gold]);

  const nonCoinInventory = useMemo(() => inventory.filter(item => !isCurrencyItemId(item.id)), [inventory]);

  // State for item type filtering
  const [activeTypeFilter, setActiveTypeFilter] = useState<ItemTypeFilter>('all');

  // Apply slot-based filtering if active
  const filteredInventory = useMemo(() => {
    if (!filterBySlot) return nonCoinInventory;

    return nonCoinInventory.filter(item => {
      // Check if item has a slot that matches the filter
      if (!item.slot) {
        // G9: equippable items (weapons/armor/accessories) that lack a
        // defined slot were previously dropped here, silently hiding valid
        // gear whenever a slot filter was active. Surface them instead so
        // the player can still see them, and warn in dev so the missing
        // slot data can be fixed at the source. Non-equippable slotless
        // items (consumables, reagents, etc.) still correctly match no slot.
        if (isEquippableItemType(item)) {
          if (ENV.DEV && !_warnedSlotlessEquippable.has(item.id)) {
            _warnedSlotlessEquippable.add(item.id);
            console.warn(
              `[InventoryList] Equippable item "${item.name}" (id: ${item.id}, type: ${item.type}) has no defined slot; ` +
              `surfacing it in the slot filter rather than dropping it. Define an EquipmentSlotType for this item.`
            );
          }
          // Surface it only under a slot that could actually receive its item
          // kind. G9's intent (never silently hide the item) is preserved - a
          // slotless dagger still appears, under Main/Off Hand - while a slot
          // filter no longer shows gear the slot physically cannot take.
          return slotAcceptsItem(filterBySlot, item);
        }
        return false;
      }

      // Weapon vs armor slot rules: an item whose authored slot disagrees with
      // the slot's kind (a greatsword slotted to Torso, a breastplate slotted to
      // MainHand) must not be offered for that slot. The rule table lives on the
      // mannequin so both surfaces agree.
      if (!slotAcceptsItem(filterBySlot, item)) return false;

      // Special case: Ring1 and Ring2 both accept items with slot='Ring' or 'Ring1' or 'Ring2'
      if ((filterBySlot === 'Ring1' || filterBySlot === 'Ring2')) {
        if (item.slot === 'Ring' || item.slot === 'Ring1' || item.slot === 'Ring2') {
          // For armor/weapon, check proficiency
          if (item.type === 'armor' || item.type === 'weapon') {
            const { can } = canEquipItem(character, item);
            return can;
          }
          return true;
        }
        return false;
      }

      // Direct slot match
      if (item.slot === filterBySlot) {
        // Additional check: verify the item can actually be equipped by this character
        if (item.type === 'armor' || item.type === 'weapon') {
          const { can } = canEquipItem(character, item);
          return can;
        }
        return true;
      }

      return false;
    });
  }, [nonCoinInventory, filterBySlot, character]);

  // Apply type-based filtering
  const typeFilteredInventory = useMemo(() => {
    if (activeTypeFilter === 'all') return filteredInventory;

    const filterConfig = ITEM_TYPE_FILTERS.find(f => f.id === activeTypeFilter);
    if (!filterConfig || filterConfig.types.length === 0) return filteredInventory;

    return filteredInventory.filter(item => filterConfig.types.includes(item.type as string));
  }, [filteredInventory, activeTypeFilter]);

  /**
   * Containers introduce a hierarchy. Because duplicate items are allowed, we
   * fabricate an instanceId that disambiguates React keys and the collapse
   * toggles within one render pass.
   *
   * It is deliberately NOT the grouping identity: an index-derived key changes
   * whenever a filter changes or an item is gained, so it can never address the
   * same item across renders or across a save. The grouping identity is the
   * item's own id, which ADD_ITEM makes unique per acquired instance, and the
   * assignment itself now lives on `Item.containerId` in game state rather than
   * in local component state (agora-17eb).
   */
  const allInventoryInstances = useMemo(() => nonCoinInventory.map(item => {
    const sourceIndex = inventory.indexOf(item);
    return { ...item, sourceIndex, instanceId: `${item.id}-${sourceIndex}` };
  }), [nonCoinInventory, inventory]);

  const inventoryInstances = useMemo(() => {
    // A food filter may hide tools, but it must retain the bag containing the
    // visible food. Ancestors are display context, not extra matching supplies.
    const visible = new Set(typeFilteredInventory);
    const containers = new Map(nonCoinInventory.filter(isContainerItem).map(item => [item.id, item]));
    for (const item of typeFilteredInventory) {
      let parentId = item.containerId;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = containers.get(parentId);
        if (!parent) break;
        visible.add(parent);
        parentId = parent.containerId;
      }
    }
    return allInventoryInstances.filter(item => visible.has(inventory[item.sourceIndex]));
  }, [typeFilteredInventory, nonCoinInventory, allInventoryInstances, inventory]);

  const [collapsedContainers, setCollapsedContainers] = useState<Record<string, boolean>>({});
  // agora-d1c7.13: the item under the pointer, compared against what its slot holds.
  const [compareItem, setCompareItem] = useState<Item | null>(null);

  // Available carried destinations do not disappear when their item type is filtered out.
  const containerEntries = useMemo(() => allInventoryInstances.filter(isContainerItem), [allInventoryInstances]);

  type ContainerBucket = { containerItem?: InventoryEntry & { instanceId: string }; children: (InventoryEntry & { instanceId: string; sourceIndex: number })[] };

  const containerBuckets = useMemo(() => {
    const buckets = new Map<string, ContainerBucket>();
    buckets.set(ROOT_CONTAINER_ID, { children: [] });
    buckets.set(INFORMATION_BUCKET_ID, { children: [] });

    // Ensure every container has a bucket, then place all entries into their bucket.
    // Buckets are keyed by the container item's own id so a persisted
    // `containerId` resolves to the same bucket on every later render.
    inventoryInstances.forEach(instance => {
      if (isContainerItem(instance)) {
        buckets.set(instance.id, { containerItem: instance, children: [] });
      }
    });

    inventoryInstances.forEach(instance => {
      let assignedContainerId = instance.containerId || ROOT_CONTAINER_ID;
      // Unstowed Service items (bought information) collect under the Information heading.
      if (assignedContainerId === ROOT_CONTAINER_ID && instance.type === ItemType.Service) {
        assignedContainerId = INFORMATION_BUCKET_ID;
      }
      const targetBucket = buckets.get(assignedContainerId) || buckets.get(ROOT_CONTAINER_ID)!;
      targetBucket.children.push(instance);
    });

    return buckets;
  }, [inventoryInstances]);

  const calculateContainedWeight = (containerId: string, visited: Set<string> = new Set()): number => {
    // Defensive recursion guard against accidental self-assignment cycles.
    if (visited.has(containerId)) return 0;
    visited.add(containerId);

    // Capacity describes the actual load, including contents hidden by a filter.
    const contents = allInventoryInstances.filter(entry => entry.containerId === containerId);
    return contents.reduce((total, entry) => {
      const childWeight = inventoryWeight([entry]) + (isContainerItem(entry) ? calculateContainedWeight(entry.id, visited) : 0);
      return total + childWeight;
    }, 0);
  };

  /**
   * Stow `itemId` in a container, or return it to the root backpack. The root
   * bucket is a display-only heading, not an item, so it is sent as `null`.
   */
  const handleMoveToContainer = (item: InventoryEntry & { sourceIndex: number }, containerId: string) => {
    onAction({
      type: 'MOVE_ITEM_TO_CONTAINER',
      label: `Stow ${item.name}`,
      payload: { itemId: item.id, containerId: containerId === ROOT_CONTAINER_ID ? null : containerId,
        inventoryIndex: item.sourceIndex, sourceItem: inventory[item.sourceIndex] },
    });
  };

  const renderContainer = (bucketId: string, depth = 0): React.ReactNode => {
    const bucket = containerBuckets.get(bucketId);
    if (!bucket) return null;

    const containerItem = bucket.containerItem as (InventoryEntry & { instanceId: string }) | undefined;
    const containerName = containerItem ? containerItem.name : (bucketId === INFORMATION_BUCKET_ID ? 'Information' : rootLabel);
    const isCollapsed = collapsedContainers[bucketId];
    const availableCapacitySlots = containerItem?.capacitySlots;
    const availableCapacityWeight = containerItem?.capacityWeight;
    const usedWeight = calculateContainedWeight(bucketId);
    // Ritual components stay bundled inside this kit. Extra-item counts must
    // not imply that opening the pack erased those contents.
    const retainedRitualKit = containerItem?.unpackedFrom?.sourceItem.id === 'priests_pack';

    return (
      <div className={`${depth === 0 ? '' : 'mt-2'} bg-gray-800/70 rounded border border-gray-700/60 p-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {containerItem ? (
              <button
                className={`${BTN_ICON} min-h-11 min-w-11 text-amber-400 hover:text-amber-200`}
                onClick={() => setCollapsedContainers(prev => ({ ...prev, [bucketId]: !prev[bucketId] }))}
                aria-label={isCollapsed ? `Expand ${containerName}` : `Collapse ${containerName}`}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : null}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-200">{containerName}</span>
              <span className="text-[10px] text-gray-400">{bucket.children.length} {retainedRitualKit ? 'additional item(s)' : 'item(s)'}</span>
            </div>
          </div>
          <div className="flex gap-2 text-[10px] text-gray-400">
            {availableCapacitySlots !== undefined && (
              <span className={bucket.children.length > availableCapacitySlots ? 'text-red-300' : ''}>
                Slots: {bucket.children.length}/{availableCapacitySlots}
              </span>
            )}
            {availableCapacityWeight !== undefined && (
              <span className={usedWeight > availableCapacityWeight ? 'text-red-300' : ''}>
                {retainedRitualKit ? 'Additional load' : 'Weight'}: {usedWeight.toFixed(2)} / {availableCapacityWeight}
              </span>
            )}
          </div>
        </div>

        {retainedRitualKit && !isCollapsed && <p className="mt-2 text-sm text-slate-200">{containerItem.description}</p>}

        {!isCollapsed && (
          <ul className="mt-2 space-y-1.5">
            {[...bucket.children].sort((a, b) => {
              // Sort by proficiency: items the character can equip come first
              const aIsEquippable = (a.type === 'armor' || a.type === 'weapon') && a.slot;
              const bIsEquippable = (b.type === 'armor' || b.type === 'weapon') && b.slot;

              const aCanEquip = aIsEquippable ? canEquipItem(character, a).can : true;
              const bCanEquip = bIsEquippable ? canEquipItem(character, b).can : true;

              // Proficient items first, non-proficient at bottom
              if (aCanEquip && !bCanEquip) return -1;
              if (!aCanEquip && bCanEquip) return 1;
              return 0;
            }).map(child => {
              const key = child.instanceId;
              const isEquippableType = isEquippableItemType(child);
              // REVIEW Q13 (G9): slotless equippable items are no longer dropped
              // from the list — the slot filter surfaces them and warns in dev
              // (see filteredInventory above). They are now also validated the way
              // the reducer would actually treat them rather than being written
              // off wholesale: a slotless one-handed weapon resolves to a free
              // hand and IS equippable, while slotless armor and slotless
              // two-handed weapons resolve to no target and stay blocked.
              const equipTargetSlot = isEquippableType ? resolveEquipTargetSlot(character, child) : null;
              // Weapon vs armor slot rules run before the proficiency check: an
              // item whose resolved target slot cannot hold its kind is blocked
              // outright, no matter how proficient the character is.
              const slotRuleReason = equipTargetSlot ? slotRejectionReason(equipTargetSlot, child) : undefined;
              const { can: canBeEquipped, reason: cantEquipReason } =
                !isEquippableType || !equipTargetSlot
                  ? { can: false, reason: isEquippableType ? 'No equipment slot defined for this item.' : undefined }
                  : slotRuleReason
                    ? { can: false, reason: slotRuleReason }
                    : canEquipItem(character, child, equipTargetSlot);

              const isFood = child.type === 'food_drink';
              const foodExpiration = getFoodExpirationState(child);
              const isExpired = isFood && foodExpiration.isExpired;
              const childIsContainer = isContainerItem(child);

              // UX IMPROVEMENT: Distinguish between "Cannot Equip" (Blocked/Red) and "Warning" (Penalty/Amber)
              const hasWarning = !!cantEquipReason;
              const isBlocked = isEquippableType && !!equipTargetSlot && !canBeEquipped;
              const isWarningOnly = isEquippableType && !!equipTargetSlot && canBeEquipped && hasWarning;

              let rowStyle = 'bg-gray-700/70 border-gray-600/40';
              if (isBlocked) {
                rowStyle = 'bg-red-950/30 border-red-500/40 hover:bg-red-900/30';
              } else if (isWarningOnly) {
                rowStyle = 'bg-amber-950/30 border-amber-500/40 hover:bg-amber-900/30';
              } else if (isExpired) {
                rowStyle = 'bg-red-950/30 border-red-500/40 hover:bg-red-900/30';
              }

              // Calculate potential AC change for armor items
              const acChange = child.type === 'armor' ? calculatePotentialAcChange(character, child) : 0;
              const childVisual = resolveItemVisual(child);
              // Use the same base-aware URL resolver as equipped slots so an
              // item keeps one SVG while moving between backpack and mannequin.
              const childIconSrc = resolveItemAssetSrc(childVisual.src);
              const childFallbackIcon = childVisual.fallbackContent;
              const hasReadableReceipt = child.type === ItemType.Service && !child.readableContent && Boolean(child.description?.trim());
              // Show the same ignition refusal the action handler enforces, before a player commits.
              // Keep the source index: a partly burned torch must not resolve to a fresh stack.
              const torchError = child.id === 'torch' && gameContext
                ? torchUseError(gameContext.state, {itemId: child.id, characterId: character.id!, inventoryIndex: child.sourceIndex})
                : null;
              // Container controls must not squeeze names. The pane-width query
              // below puts them beside the name only when there is actual room.
              const hasContainerControls = containerEntries.length > 0;
              const objectLight=gameContext?objectLightDetails(gameContext.state,child):null;
              const equipLabel=`Equip ${child.name}${objectLight?` — Light by ${objectLight.casterName}`:''}`;
              const torchErrorId = torchError ? 'torch-eligibility-' + child.sourceIndex : undefined;
              const useVerb = child.id === 'torch' ? 'Light' : child.id === 'water-day' ? 'Drink' : isFood ? 'Eat' : 'Use';

              return (
                <React.Fragment key={key}>
                  <li className={`flex flex-col gap-2 rounded-md border p-2 transition-colors sm:flex-row sm:items-center sm:justify-between ${rowStyle} ${hasContainerControls || hasReadableReceipt || ['explorers_pack','priests_pack'].includes(child.id) ? 'sm:flex-wrap' : ''}`}>
                    <div className={`flex min-w-0 items-center gap-2 ${hasContainerControls ? 'inventory-container-identity w-full' : ''}`}>
                      {(childIconSrc || childFallbackIcon) && (
                        <span className="w-6 h-6 text-xl text-center flex items-center justify-center flex-shrink-0 filter drop-shadow-sm">
                          {childIconSrc ? (
                            <img
                              src={childIconSrc}
                              alt=""
                              className="w-5 h-5 object-contain"
                              loading="lazy"
                              aria-hidden="true"
                            />
                          ) : (
                            childFallbackIcon
                          )}
                        </span>
                      )}
                      <Tooltip content={getItemTooltipContent(child, cantEquipReason)}>
                        <div
                          className="flex flex-col min-w-0"
                          data-testid={`inventory-item-${child.id}`}
                          onMouseEnter={() => setCompareItem(resolveEquipTargetSlot(character, child) ? child : null)}
                          onMouseLeave={() => setCompareItem(null)}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`font-medium text-amber-200 text-sm cursor-help ${hasContainerControls ? 'min-w-0 whitespace-normal break-words' : 'truncate'}`} title={child.name}>{child.name}</span>
                            {/* A day-sized portion is not the size of the whole stack. */}
                            {(child.quantity ?? 1) > 1 && <span className="shrink-0 text-xs text-slate-200" aria-label={`${child.quantity} units`}>×{child.quantity}</span>}
                            {/* AC Upgrade Indicator */}
                            {acChange > 0 && (
                              <Tooltip content={`Equipping this would increase your AC by ${acChange}`}>
                                <span
                                  className="material-symbols-outlined text-green-400 text-sm flex-shrink-0"
                                  style={{ fontSize: '14px' }}
                                  aria-label={`+${acChange} AC upgrade`}
                                >
                                  arrow_upward
                                </span>
                              </Tooltip>
                            )}
                            {/* AC Downgrade Indicator */}
                            {acChange < 0 && (
                              <Tooltip content={`Equipping this would decrease your AC by ${Math.abs(acChange)}`}>
                                <span
                                  className="material-symbols-outlined text-red-400 text-sm flex-shrink-0"
                                  style={{ fontSize: '14px' }}
                                  aria-label={`${acChange} AC downgrade`}
                                >
                                  arrow_downward
                                </span>
                              </Tooltip>
                            )}
                            {isWarningOnly && <AlertTriangle size={12} className="text-amber-500" aria-label="Warning" />}
                            {isBlocked && <span className="text-[10px]" role="img" aria-label="Blocked">⛔</span>}
                            {child.isJunk && (
                              <span className="text-[9px] bg-amber-905/60 text-amber-300 border border-amber-500/40 rounded px-1 font-semibold uppercase flex-shrink-0" aria-label="Junk item">
                                Junk
                              </span>
                            )}
                          </div>
                          {objectLight&&<span className="whitespace-normal text-xs text-amber-200" data-testid="inventory-object-light">
                            Light by {objectLight.casterName} · {objectLight.remainingMinutes} min left · {objectLight.exposed?'shining':'concealed in pack'}
                          </span>}
                          {child.id === 'torch' && <span className="text-xs text-amber-200">Unlit · {Math.ceil(child.lightFuelMinutes ?? 60)} min fuel · 20 ft bright + 20 ft dim</span>}
                          {torchError && <span id={torchErrorId} className="text-xs text-amber-100">{torchError}</span>}
                          {child.perishable && (
                            <span className={`text-[10px] ${isExpired ? 'text-red-300 font-semibold' : 'text-orange-300'}`}>
                              {foodExpiration.label}
                            </span>
                          )}
                        </div>
                      </Tooltip>
                    </div>
                    <div className={`flex flex-wrap items-center justify-end gap-2 ${hasContainerControls ? 'inventory-container-actions w-full' : ''}`}>
                      {containerEntries.length > 0 && (
                        <select
                          className="min-h-11 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200"
                          value={child.containerId || ROOT_CONTAINER_ID}
                          onChange={e => handleMoveToContainer(child, e.target.value)}
                          aria-label={`Move ${child.name} to container`}
                        >
                          <option value={ROOT_CONTAINER_ID}>{rootLabel}</option>
                          {containerEntries.map(container => (
                            <option key={container.instanceId} value={container.id} disabled={container.id === child.id}>
                              {container.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {(child.type === 'consumable' || isFood) && (
                        /* Normalize consumable/use actions to the uppercase reducer contract used everywhere else. */
                        <button onClick={() => {
                          if (child.id === 'torch' && gameContext) {
                            const error = torchUseError(gameContext.state, {itemId: child.id, characterId: character.id!, inventoryIndex: child.sourceIndex});
                            setTorchFeedback(error);
                            if (error) return;
                          }
                          if (child.id === 'rations' || child.id === 'water-day') setMealIndex(child.sourceIndex);
                          else onAction({ type: 'USE_ITEM', label: `${useVerb} ${child.name}`, payload: { itemId: child.id, characterId: character.id!, inventoryIndex: child.sourceIndex } });
                        }}
                          disabled={isExpired || Boolean(torchError)}
                          aria-describedby={torchErrorId}
                          className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded bg-green-700 px-3 py-2 text-xs text-white shadow-sm transition-colors hover:bg-green-600 disabled:bg-gray-600`}
                          aria-label={`${useVerb} ${child.name}`}
                        >
                          {useVerb}
                        </button>
                      )}
                      {child.readableContent && (
                        /* Readable items (e.g. a pocketed broadsheet keepsake) open their frozen snapshot. */
                        <button onClick={() => onAction({ type: 'READ_ITEM', label: `Read ${child.name}`, payload: { itemId: child.id } })}
                          className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded bg-amber-700 px-3 py-2 text-xs text-white shadow-sm transition-colors hover:bg-amber-600`}
                          aria-label={`Read ${child.name}`}
                        >
                          Read
                        </button>
                      )}
                      {isEquippableType && (
                        <Tooltip content={canBeEquipped ? (cantEquipReason ? `Equip ${child.name}\n⚠️ ${cantEquipReason}` : `Equip ${child.name}`) : (cantEquipReason || "Cannot equip")}>
                          <button onClick={() => onAction({ type: 'EQUIP_ITEM', label: `Equip ${child.name}`, payload: { itemId: child.id, characterId: character.id!, inventoryIndex: child.sourceIndex, inventoryItem: inventory[child.sourceIndex] } })}
                            disabled={!canBeEquipped}
                            className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded bg-sky-700 px-3 py-2 text-xs text-white shadow-sm transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-gray-600`}
                            aria-label={equipLabel}
                          >
                            Equip
                          </button>
                        </Tooltip>
                      )}
                      <button onClick={() => onAction({ type: 'TOGGLE_ITEM_JUNK', label: `Toggle Junk ${child.name}`, payload: { itemId: child.id } })}
                        className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded px-3 py-2 text-xs shadow-sm transition-colors ${
                          child.isJunk
                            ? 'bg-amber-700 hover:bg-amber-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                        aria-label={`Toggle junk status for ${child.name}`}
                      >
                        {child.isJunk ? 'Junk' : 'Mark Junk'}
                      </button>
                      <button onClick={() => onAction({ type: 'DROP_ITEM', label: `Drop ${child.name}`, payload: { itemId: child.id, characterId: character.id! } })}
                        className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded bg-red-800 px-3 py-2 text-xs text-white shadow-sm transition-colors hover:bg-red-700`}
                        aria-label={`Drop ${child.name}`}
                      >
                        Drop
                      </button>
                    </div>
                    {/* Both authored bundles use the same guarded review. Custom
                        contents remain sealed by the transaction's catalog check. */}
                    {['explorers_pack','priests_pack'].includes(child.id) && (
                      <AdventuringPackReview item={inventory[child.sourceIndex]} inventoryIndex={child.sourceIndex}
                        characterId={character.id!} onAction={onAction} />
                    )}
                    {hasReadableReceipt && (
                      // Paid accounts already belong to the player. Reading the
                      // saved words stays local and never purchases or consumes
                      // them. Frozen broadsheets retain their existing reader.
                      <details className="w-full basis-full rounded-md border border-sky-900/60 bg-slate-950/50 px-3 py-2">
                        <summary aria-label={`Read ${child.name}`} className="cursor-pointer py-1 text-sm font-semibold text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
                          Read {child.name}
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{child.description}</p>
                      </details>
                    )}
                  </li>
                  {childIsContainer && (
                    <div className="mt-2 ml-4">
                      {renderContainer(child.id, depth + 1)}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full font-quattrocento" style={{containerType:'inline-size',containerName:'carried-inventory'}}>
      {/* The sheet is resizable and has three panes. Use this pane's actual
          room, so narrow names remain readable without doubling wide rows.
          Full-width receipts and pack reviews still wrap onto their own line. */}
      <style>{`
        @container carried-inventory (min-width: 640px) {
          .inventory-container-identity { width: auto; flex: 1 1 0%; min-width: 8rem; }
          .inventory-container-actions { width: auto; flex: 0 0 auto; max-width: calc(100% - 9rem); }
        }
      `}</style>

      {/* Currency Header */}
      {/* Renders the character's available currency across platinum, gold, silver, and copper denominations. */}
      <div className="mb-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700">
        {torchFeedback && <p role="status" className="mb-3 rounded border border-amber-500/40 bg-amber-950/40 p-2 text-sm text-amber-100">{torchFeedback}</p>}
        {gameContext && activeCarriedTorches(gameContext.state).filter(source => source.bearerId === character.id).map(source => (
          <div key={source.id} className="mb-3 flex items-center justify-between gap-2 text-sm text-amber-200">
            <span>Burning torch · {Math.ceil(source.durationRemaining)} min fuel</span>
            <button type="button" className={`${BTN_FOCUS_VISIBLE} rounded border border-amber-600 px-2 py-1`} onClick={() => onAction({
              type: 'USE_ITEM', label: 'Extinguish torch', payload: {itemId: 'torch', characterId: character.id!, light: {action: 'extinguish', sourceId: source.id}}
            })}>Extinguish torch</button>
          </div>
        ))}
        <h4 className="text-xs font-semibold font-cinzel text-amber-500 mb-2 uppercase tracking-widest border-b border-gray-700 pb-1">{sharedInventory?'Party funds':'Coin Pouch'}</h4>
        <div className="flex justify-start items-center gap-3 flex-wrap">
          <CoinBadge type="pp" amount={currency.PP} />
          <CoinBadge type="gp" amount={currency.GP} />
          <CoinBadge type="sp" amount={currency.SP} />
          <CoinBadge type="cp" amount={currency.CP} />
        </div>
      </div>

      {/* Equipped-versus-candidate comparison (agora-d1c7.13): hover an equippable item. */}
      {compareItem && (() => {
        const slot = resolveEquipTargetSlot(character, compareItem);
        const equipped = slot ? character.equippedItems?.[slot] ?? null : null;
        return <ItemComparisonPanel candidate={compareItem} equipped={equipped} slot={slot} />;
      })()}

      {/* Equipped Attunement Items */}
      {equippedAttunementItems.length > 0 && (
        <div className="mb-3 bg-gray-900/60 p-3 rounded-lg border border-purple-500/30">
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
            <h4 className="text-xs font-semibold font-cinzel text-purple-400 uppercase tracking-widest">
              Attunement ({totalAttunedCount}/3)
            </h4>
            {totalAttunedCount >= 3 && (
              <span className="text-[10px] text-amber-400 font-medium">Attunement limit reached</span>
            )}
          </div>
          <ul className="space-y-1.5">
            {equippedAttunementItems.map(({ slot, item }) => (
              <li key={item.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-gray-800/40 border border-gray-700/50">
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-amber-200 truncate">{item.name}</span>
                  <span className="text-[10px] text-gray-400 capitalize">{slot.replace(/([A-Z])/g, ' $1').trim()} slot</span>
                </div>
                <div>
                  {item.isAttuned && item.attunedCharacterId === character.id ? (
                    <button
                      onClick={() => onAction({
                        type: 'UNATTUNE_ITEM',
                        label: `Unattune ${item.name}`,
                        payload: { characterId: character.id!, itemId: item.id }
                      })}
                      className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded bg-purple-750 px-3 py-2 text-[10px] font-medium text-white shadow-sm transition-colors hover:bg-purple-650`}
                    >
                      Attuned
                    </button>
                  ) : item.isAttuned && item.attunedCharacterId ? (
                    <button
                      onClick={() => onAction({
                        type: 'ATTUNE_ITEM',
                        label: `Attune ${item.name}`,
                        payload: { characterId: character.id!, itemId: item.id }
                      })}
                      disabled={totalAttunedCount >= 3}
                      className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded bg-amber-800 px-3 py-2 text-[10px] font-medium text-amber-200 shadow-sm transition-all hover:bg-amber-700 hover:text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-50`}
                      title="Currently attuned to another party member. Click to attune to this character."
                    >
                      Re-attune
                    </button>
                  ) : (
                    <button
                      onClick={() => onAction({
                        type: 'ATTUNE_ITEM',
                        label: `Attune ${item.name}`,
                        payload: { characterId: character.id!, itemId: item.id }
                      })}
                      disabled={totalAttunedCount >= 3}
                      className={`${BTN_FOCUS_VISIBLE} min-h-11 rounded bg-gray-700 px-3 py-2 text-[10px] font-medium text-purple-200 shadow-sm transition-all hover:bg-purple-800 hover:text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-50`}
                    >
                      Attune
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter Indicator */}
      {filterBySlot && (
        <div className="mb-2 p-2 bg-amber-900/30 border border-amber-600/50 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-300 text-sm font-semibold">🔍 Filtering: {filterBySlot} slot</span>
            <span className="text-xs text-gray-400">({filteredInventory.length} compatible items)</span>
          </div>
          <button
            type="button"
            onClick={onClearFilter}
            className={`${BTN_FOCUS_VISIBLE} flex min-h-11 items-center gap-1 rounded bg-gray-700 px-3 py-2 text-xs text-white shadow-sm transition-colors hover:bg-gray-600`}
            aria-label="Clear filter"
          >
            <FilterX size={12} />
            Clear
          </button>
        </div>
      )}

      {/* Weight & List Header */}
      {/* Displays the inventory weight summary and standard item list section header. */}
      <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-2 px-1">
        <h3 className="font-semibold font-cinzel text-sky-400 text-sm">{sharedInventory?'Shared party supplies':'Backpack'}</h3>
        <span className="max-w-full shrink-0 text-xs text-gray-400" data-testid="inventory-encumbrance">
          Weight: {totalInventoryWeight} / {encumbrance.carrying.carryingCapacity.toFixed(0)} lbs
          <span className={`ml-2 font-semibold ${encumbranceTone}`}>{encumbranceLabel}</span>
        </span>
      </div>

      {sharedInventory&&<p className="mb-3 px-1 text-xs text-slate-300">These supplies and funds are shared by the party. Equipped items remain with each character.</p>}
      {mealIndex !== null && <PartyMealConfirmation key={mealIndex} inventory={inventory}
        party={gameContext?.state.party ?? [character]} selectedIndex={mealIndex} onAction={onAction} onCancel={() => setMealIndex(null)} />}

      {/* Type Filter Buttons */}
      <div className="mb-3 flex flex-wrap gap-1">
        {ITEM_TYPE_FILTERS.map(filter => {
          const isActive = activeTypeFilter === filter.id;
          // Count items matching this filter
          const count = filter.id === 'all'
            ? filteredInventory.length
            : filteredInventory.filter(item => filter.types.includes(item.type as string)).length;

          if (count === 0 && filter.id !== 'all') return null; // Hide empty categories

          return (
            <Tooltip key={filter.id} content={`${filter.label} (${count} items)`}>
              <button
                type="button"
                onClick={() => setActiveTypeFilter(filter.id)}
                className={`${BTN_FOCUS_VISIBLE} 
                  flex min-h-11 items-center gap-1 rounded-md border px-3 py-2 text-xs transition-all
                  ${isActive
                    ? 'bg-sky-700 border-sky-500 text-white shadow-md'
                    : 'bg-gray-800/70 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                  }
                `}
                aria-pressed={isActive}
                aria-label={`Filter by ${filter.label}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{filter.icon}</span>
                <span>{filter.label}</span>
                <span className={`text-[10px] ${isActive ? 'text-sky-200' : 'text-gray-400'}`}>({count})</span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {nonCoinInventory.length > 0 ? (
        <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto scrollable-content pr-1">
          {renderContainer(ROOT_CONTAINER_ID)}
          {(containerBuckets.get(INFORMATION_BUCKET_ID)?.children.length ?? 0) > 0 && renderContainer(INFORMATION_BUCKET_ID)}
        </div>
      ) : <p className="text-sm text-gray-400 italic p-4 text-center border border-dashed border-gray-700 rounded">{sharedInventory?'Party supplies are empty.':'Backpack is empty.'}</p>}
    </div>
  );
};

export default InventoryList;
