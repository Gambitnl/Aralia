// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 00:45:56
 * Dependents: components/CharacterSheet/Overview/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, FilterX, AlertTriangle } from 'lucide-react';
import { PlayerCharacter, Item, Action, ItemContainer, InventoryEntry, EquipmentSlotType, ItemType as _ItemType } from '../../../types';
import { canEquipItem, calculatePotentialAcChange } from '../../../utils/characterUtils';
import { ENV } from '../../../config/env';
import { resolveItemVisual } from '../../../utils/visuals/visualUtils';
import Tooltip from '../../ui/Tooltip';
import { CoinBadge } from '../../ui/CoinPurseDisplay';

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

// TODO(FEATURES): Add container browsing UI and item comparison panels for inventory entries (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
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

/** Item type filter categories for the inventory UI */
type ItemTypeFilter = 'all' | 'armor' | 'weapons' | 'consumables' | 'tools' | 'accessories' | 'other';

const ITEM_TYPE_FILTERS: { id: ItemTypeFilter; label: string; icon: string; types: string[] }[] = [
  { id: 'all', label: 'All', icon: 'inventory_2', types: [] },
  { id: 'armor', label: 'Armor', icon: 'shield', types: ['armor'] },
  { id: 'weapons', label: 'Weapons', icon: 'swords', types: ['weapon'] },
  { id: 'consumables', label: 'Consumables', icon: 'local_drink', types: ['consumable', 'potion', 'food_drink', 'scroll'] },
  { id: 'tools', label: 'Tools', icon: 'construction', types: ['tool', 'light_source'] },
  { id: 'accessories', label: 'Accessories', icon: 'diamond', types: ['accessory', 'clothing'] },
  { id: 'other', label: 'Other', icon: 'category', types: ['note', 'book', 'map', 'key', 'spell_component', 'crafting_material', 'treasure', 'reagent', 'ammunition', 'trap'] },
];

/**
 * Inventory item visuals may come from Vite-served public assets or from
 * absolute/external URLs. Relative public paths need the app base URL so
 * `/Aralia/` preview builds and localhost roots both resolve correctly.
 */
const resolveInventoryAssetSrc = (src?: string): string | undefined => {
  if (!src) return undefined;
  if (src.startsWith('/') || src.startsWith('http') || src.startsWith('data:')) return src;
  return `${ENV.BASE_URL}${src}`;
};

// ============================================================================
// Perishable Food Timing
// ============================================================================
// Converts the descriptive shelf-life field into real milliseconds so the
// inventory can compare durable acquisition timestamps against the current time.
// Existing unstamped food is treated as unknown freshness rather than spoiled,
// which keeps legacy saves playable until their inventories are migrated by an
// acquisition or save-load path.
// ============================================================================

const SHELF_LIFE_UNIT_MS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

const parseShelfLifeToMs = (shelfLife?: string): number | null => {
  if (!shelfLife) return null;

  // Shelf life is authored as phrases like "3 days" or "1 week".
  // The first supported number+unit pair is enough for the current item data.
  const match = shelfLife.trim().toLowerCase().match(/(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/);
  if (!match) return null;

  const amount = Number(match[1]);
  const normalizedUnit = match[2].replace(/s$/, '');
  const unitMs = SHELF_LIFE_UNIT_MS[normalizedUnit];

  // If authored data drifts into an unsupported unit, keep the food usable
  // and visible instead of silently declaring it expired.
  if (!Number.isFinite(amount) || !unitMs) return null;

  return amount * unitMs;
};

const getFoodExpirationState = (item: Item, now = Date.now()): { isExpired: boolean; label: string } => {
  if (!item.perishable) return { isExpired: false, label: '' };

  const shelfLifeMs = parseShelfLifeToMs(item.shelfLife);
  if (typeof item.acquiredAt !== 'number' || !shelfLifeMs) {
    return { isExpired: false, label: `Expires: ${item.shelfLife || 'Unknown'}` };
  }

  const expiresAt = item.acquiredAt + shelfLifeMs;
  if (now >= expiresAt) {
    return { isExpired: true, label: `Expired: ${item.shelfLife || 'Unknown'} shelf life elapsed` };
  }

  return { isExpired: false, label: `Expires: ${item.shelfLife || 'Unknown'}` };
};
// ============================================================================
// Main Inventory List Component
// ============================================================================
// Organizes the character's coin purse, filtering controls, backpack contents,
// and recursively renders nested containers.
// ============================================================================

const InventoryList: React.FC<InventoryListProps> = ({ inventory, gold, character, onAction, filterBySlot, onClearFilter }) => {
  /**
   * The weight computation still sums the raw inventory to keep parity
   * with the existing encumbrance rules while the nested UI only affects
   * presentation.
   */
  const totalInventoryWeight = useMemo(() => {
    return inventory.reduce((total, item) => total + (item.weight || 0), 0).toFixed(2);
  }, [inventory]);

  // Find all equipped items that require attunement
  const equippedAttunementItems = useMemo(() => {
    return Object.entries(character.equippedItems)
      .filter(([slot, item]) => item && item.requiresAttunement)
      .map(([slot, item]) => ({ slot: slot as EquipmentSlotType, item: item! }));
  }, [character.equippedItems]);

  // Compute total number of attuned magic items
  const totalAttunedCount = useMemo(() => {
    const equippedAttuned = Object.values(character.equippedItems).filter(
      item => item && item.requiresAttunement && item.isAttuned
    ).length;
    const inventoryAttuned = inventory.filter(
      item => item && item.requiresAttunement && item.isAttuned && item.attunedCharacterId === character.id
    ).length;
    return equippedAttuned + inventoryAttuned;
  }, [character.equippedItems, character.id, inventory]);

  // Calculate unified currency breakdown
  // Combines the "liquid" gold variable (which handles fractional GP from sales) 
  // with physical coin items found in inventory.
  const currency = useMemo(() => {
    const counts = {
      PP: inventory.filter(i => i.id === 'platinum_piece').length,
      GP: inventory.filter(i => i.id === 'gold_piece').length,
      SP: inventory.filter(i => i.id === 'silver_piece').length,
      CP: inventory.filter(i => i.id === 'copper_piece').length,
    };

    // Breakdown abstract gold variable
    // integer part -> GP
    // 1st decimal -> SP
    // 2nd decimal -> CP
    const abstractGP = Math.floor(gold);
    const remainderAfterGP = gold - abstractGP;
    const abstractSP = Math.floor(remainderAfterGP * 10);
    const remainderAfterSP = remainderAfterGP - (abstractSP / 10);
    // Use round to avoid floating point precision errors (e.g. 0.0099999)
    const abstractCP = Math.round(remainderAfterSP * 100);

    return {
      PP: counts.PP,
      GP: counts.GP + abstractGP,
      SP: counts.SP + abstractSP,
      CP: counts.CP + abstractCP
    };
  }, [inventory, gold]);

  // Filter out physical coins from the main list to avoid clutter, since they are shown in the header
  const nonCoinInventory = useMemo(() => {
    const coinIds = ['platinum_piece', 'gold_piece', 'silver_piece', 'copper_piece'];
    return inventory.filter(item => !coinIds.includes(item.id));
  }, [inventory]);

  // State for item type filtering
  const [activeTypeFilter, setActiveTypeFilter] = useState<ItemTypeFilter>('all');

  // Apply slot-based filtering if active
  const filteredInventory = useMemo(() => {
    if (!filterBySlot) return nonCoinInventory;

    return nonCoinInventory.filter(item => {
      // Check if item has a slot that matches the filter
      if (!item.slot) return false;

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
   * Containers introduce a hierarchy. Because duplicate items are allowed,
   * we fabricate a stable instanceId for rendering and for in-component
   * grouping state. The grouping state lives locally because reducers have
   * not yet been expanded to persist container assignments globally.
   */
  const inventoryInstances = useMemo(() => {
    return typeFilteredInventory.map((item, index) => ({ ...item, instanceId: `${item.id}-${index}` }));
  }, [typeFilteredInventory]);

  const [containerAssignments, setContainerAssignments] = useState<Record<string, string>>({});
  const [collapsedContainers, setCollapsedContainers] = useState<Record<string, boolean>>({});

  // Keep local container assignments in sync with incoming inventory payloads
  useEffect(() => {
    setContainerAssignments(prev => {
      const nextAssignments: Record<string, string> = {};
      inventoryInstances.forEach(instance => {
        nextAssignments[instance.instanceId] = prev[instance.instanceId] || instance.containerId || ROOT_CONTAINER_ID;
      });
      return nextAssignments;
    });
  }, [inventoryInstances]);

  const containerEntries = useMemo(() => inventoryInstances.filter(isContainerItem), [inventoryInstances]);

  type ContainerBucket = { containerItem?: InventoryEntry & { instanceId: string }; children: (InventoryEntry & { instanceId: string })[] };

  const containerBuckets = useMemo(() => {
    const buckets = new Map<string, ContainerBucket>();
    buckets.set(ROOT_CONTAINER_ID, { children: [] });

    // Ensure every container has a bucket, then place all entries into their bucket.
    inventoryInstances.forEach(instance => {
      if (isContainerItem(instance)) {
        buckets.set(instance.instanceId, { containerItem: instance, children: [] });
      }
    });

    inventoryInstances.forEach(instance => {
      const assignedContainerId = containerAssignments[instance.instanceId] || instance.containerId || ROOT_CONTAINER_ID;
      const targetBucket = buckets.get(assignedContainerId) || buckets.get(ROOT_CONTAINER_ID)!;
      targetBucket.children.push(instance);
    });

    return buckets;
  }, [containerAssignments, inventoryInstances]);

  const calculateContainedWeight = (containerId: string, visited: Set<string> = new Set()): number => {
    // Defensive recursion guard against accidental self-assignment cycles.
    if (visited.has(containerId)) return 0;
    visited.add(containerId);

    const bucket = containerBuckets.get(containerId);
    if (!bucket) return 0;

    return bucket.children.reduce((total, entry) => {
      const childWeight = (entry.weight || 0) + (isContainerItem(entry) ? calculateContainedWeight(entry.instanceId, visited) : 0);
      return total + childWeight;
    }, 0);
  };

  const handleMoveToContainer = (itemInstanceId: string, containerId: string) => {
    setContainerAssignments(prev => ({ ...prev, [itemInstanceId]: containerId }));
  };

  const renderContainer = (bucketId: string, depth = 0): React.ReactNode => {
    const bucket = containerBuckets.get(bucketId);
    if (!bucket) return null;

    const containerItem = bucket.containerItem as (InventoryEntry & { instanceId: string }) | undefined;
    const containerName = containerItem ? containerItem.name : 'Backpack';
    const isCollapsed = collapsedContainers[bucketId];
    const availableCapacitySlots = containerItem?.capacitySlots;
    const availableCapacityWeight = containerItem?.capacityWeight;
    const usedWeight = calculateContainedWeight(bucketId);

    return (
      <div className={`${depth === 0 ? '' : 'mt-2'} bg-gray-800/70 rounded border border-gray-700/60 p-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {containerItem ? (
              <button
                className="text-amber-400 hover:text-amber-200 transition-colors p-0.5 rounded focus:ring-1 focus:ring-amber-400/50"
                onClick={() => setCollapsedContainers(prev => ({ ...prev, [bucketId]: !prev[bucketId] }))}
                aria-label={isCollapsed ? `Expand ${containerName}` : `Collapse ${containerName}`}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : null}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-amber-200">{containerName}</span>
              <span className="text-[10px] text-gray-400">{bucket.children.length} item(s)</span>
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
                Weight: {usedWeight.toFixed(2)} / {availableCapacityWeight}
              </span>
            )}
          </div>
        </div>

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
              const isEquippableType = child.type === 'armor' || child.type === 'weapon' || child.type === 'accessory';
              // REVIEW Q13: The canEquipItem check is only called if isEquippableType AND child.slot exist.
              // What if an equippable item doesn't have a slot defined? It would get { can: false, reason: undefined }.
              // Is this intentional to skip slotless equippable items?
              // ANSWER: This could hide valid items. Should log a warning for equippable items without slots.
              const { can: canBeEquipped, reason: cantEquipReason } =
                isEquippableType && child.slot ?
                  canEquipItem(character, child) : { can: false, reason: undefined };

              const isFood = child.type === 'food_drink';
              const foodExpiration = getFoodExpirationState(child);
              const isExpired = isFood && foodExpiration.isExpired;
              const childIsContainer = isContainerItem(child);

              // UX IMPROVEMENT: Distinguish between "Cannot Equip" (Blocked/Red) and "Warning" (Penalty/Amber)
              const hasWarning = !!cantEquipReason;
              const isBlocked = isEquippableType && child.slot && !canBeEquipped;
              const isWarningOnly = isEquippableType && child.slot && canBeEquipped && hasWarning;

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
              const childIconSrc = resolveInventoryAssetSrc(childVisual.src);
              const childFallbackIcon = childVisual.fallbackContent;

              return (
                <React.Fragment key={key}>
                  <li className={`p-2 rounded-md border flex items-center justify-between transition-colors ${rowStyle}`}>
                    <div className="flex items-center gap-2 min-w-0">
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
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-amber-200 text-sm cursor-help truncate" title={child.name}>{child.name}</span>
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
                          {child.perishable && (
                            <span className={`text-[10px] ${isExpired ? 'text-red-300 font-semibold' : 'text-orange-300'}`}>
                              {foodExpiration.label}
                            </span>
                          )}
                        </div>
                      </Tooltip>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      {containerEntries.length > 0 && (
                        <select
                          className="text-xs bg-gray-800 border border-gray-600 text-gray-200 rounded px-1 py-0.5"
                          value={containerAssignments[child.instanceId] || ROOT_CONTAINER_ID}
                          onChange={e => handleMoveToContainer(child.instanceId, e.target.value)}
                          aria-label={`Move ${child.name} to container`}
                        >
                          <option value={ROOT_CONTAINER_ID}>Backpack</option>
                          {containerEntries.map(container => (
                            <option key={container.instanceId} value={container.instanceId} disabled={container.instanceId === child.instanceId}>
                              {container.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {(child.type === 'consumable' || isFood) && (
                        /* Normalize consumable/use actions to the uppercase reducer contract used everywhere else. */
                        <button onClick={() => onAction({ type: 'USE_ITEM', label: isFood ? `Eat ${child.name}` : `Use ${child.name}`, payload: { itemId: child.id, characterId: character.id! } })}
                          disabled={isExpired}
                          className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded disabled:bg-gray-600 transition-colors shadow-sm"
                          aria-label={isFood ? `Eat ${child.name}` : `Use ${child.name}`}
                        >
                          {isFood ? 'Eat' : 'Use'}
                        </button>
                      )}
                      {child.readableContent && (
                        /* Readable items (e.g. a pocketed broadsheet keepsake) open their frozen snapshot. */
                        <button onClick={() => onAction({ type: 'READ_ITEM', label: `Read ${child.name}`, payload: { itemId: child.id } })}
                          className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-2 py-1 rounded transition-colors shadow-sm"
                          aria-label={`Read ${child.name}`}
                        >
                          Read
                        </button>
                      )}
                      {isEquippableType && child.slot && (
                        <Tooltip content={canBeEquipped ? (cantEquipReason ? `Equip ${child.name}\n⚠️ ${cantEquipReason}` : `Equip ${child.name}`) : (cantEquipReason || "Cannot equip")}>
                          <button onClick={() => onAction({ type: 'EQUIP_ITEM', label: `Equip ${child.name}`, payload: { itemId: child.id, characterId: character.id! } })}
                            disabled={!canBeEquipped}
                            className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2 py-1 rounded disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors shadow-sm"
                            aria-label={`Equip ${child.name}`}
                          >
                            Equip
                          </button>
                        </Tooltip>
                      )}
                      <button onClick={() => onAction({ type: 'TOGGLE_ITEM_JUNK', label: `Toggle Junk ${child.name}`, payload: { itemId: child.id } })}
                        className={`text-xs px-2 py-1 rounded transition-colors shadow-sm ${
                          child.isJunk
                            ? 'bg-amber-700 hover:bg-amber-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                        aria-label={`Toggle junk status for ${child.name}`}
                      >
                        {child.isJunk ? 'Junk' : 'Mark Junk'}
                      </button>
                      <button onClick={() => onAction({ type: 'DROP_ITEM', label: `Drop ${child.name}`, payload: { itemId: child.id, characterId: character.id! } })}
                        className="text-xs bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors shadow-sm"
                        aria-label={`Drop ${child.name}`}
                      >
                        Drop
                      </button>
                    </div>
                  </li>
                  {childIsContainer && (
                    <div className="mt-2 ml-4">
                      {renderContainer(child.instanceId, depth + 1)}
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
    <div className="flex flex-col h-full font-quattrocento">

      {/* Currency Header */}
      {/* Renders the character's available currency across platinum, gold, silver, and copper denominations. */}
      <div className="mb-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700">
        <h4 className="text-xs font-semibold font-cinzel text-amber-500 mb-2 uppercase tracking-widest border-b border-gray-700 pb-1">Coin Pouch</h4>
        <div className="flex justify-start items-center gap-3 flex-wrap">
          <CoinBadge type="pp" amount={currency.PP} />
          <CoinBadge type="gp" amount={currency.GP} />
          <CoinBadge type="sp" amount={currency.SP} />
          <CoinBadge type="cp" amount={currency.CP} />
        </div>
      </div>

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
                  {item.isAttuned ? (
                    <button
                      onClick={() => onAction({
                        type: 'UNATTUNE_ITEM',
                        label: `Unattune ${item.name}`,
                        payload: { characterId: character.id!, itemId: item.id }
                      })}
                      className="px-2 py-1 bg-purple-750 hover:bg-purple-650 text-white rounded text-[10px] font-medium transition-colors shadow-sm"
                    >
                      Attuned
                    </button>
                  ) : (
                    <button
                      onClick={() => onAction({
                        type: 'ATTUNE_ITEM',
                        label: `Attune ${item.name}`,
                        payload: { characterId: character.id!, itemId: item.id }
                      })}
                      disabled={totalAttunedCount >= 3}
                      className="px-2 py-1 bg-gray-700 hover:bg-purple-800 text-purple-200 hover:text-white rounded disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 text-[10px] font-medium transition-all shadow-sm"
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
            className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors shadow-sm focus:ring-1 focus:ring-gray-400"
            aria-label="Clear filter"
          >
            <FilterX size={12} />
            Clear
          </button>
        </div>
      )}

      {/* Weight & List Header */}
      {/* Displays the inventory weight summary and standard item list section header. */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className="font-semibold font-cinzel text-sky-400 text-sm">Backpack</h3>
        <span className="text-xs text-gray-400">Weight: {totalInventoryWeight} lbs</span>
      </div>

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
                className={`
                  flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-all
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
        </div>
      ) : <p className="text-sm text-gray-400 italic p-4 text-center border border-dashed border-gray-700 rounded">Backpack is empty.</p>}
    </div>
  );
};

export default InventoryList;
